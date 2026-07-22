/**
 * backend-ts: the TypeScript implementation of the iota-terminal API contract.
 */
import crypto from 'crypto';
import path from 'path';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import express from 'express';
import type {
  GuestbookCreateRequest,
  GuestbookCreateResponse,
  GuestbookDeleteRequest,
  GuestbookDeleteResponse,
  GuestbookEntry,
  GuestbookListResponse,
  GuestbookUpdateRequest,
  GuestbookUpdateResponse
} from '@iota/types';

// Local dev only: load the repo root .env (apps/backend-ts/src|dist -> ../../../.env).
// In production, docker-compose injects these vars directly, so a missing
// file here is a silent no-op.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  // Honeypot field: real users never fill this in. A non-empty value means
  // the request is treated as spam.
  company?: string;
}

interface ContactResponse {
  ok: boolean;
}

interface GuestbookEntryRow {
  id: number;
  name: string;
  message: string;
  edit_token_hash: string;
  created_at: string;
  updated_at: string;
}

const app = express();
const port = 8082;
const dbPath =
  process.env.IOTA_DB_PATH ?? path.resolve(__dirname, '../../../shared/db/iota.sqlite');
const db = new Database(dbPath);

// Ensure the tables this backend queries exist before any statements below
// are prepared (better-sqlite3 prepares — and fails immediately — at import
// time, so a fresh/unmigrated db would otherwise crash the process on boot).
// Mirrors shared/db/migrations/schema.sql; keep the two in sync. `make
// db-init` remains the source of truth for local dev, but production/CI
// deployments start from an empty named volume with no migration step, so
// this backend needs to be able to bootstrap its own schema.
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      description TEXT,
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS guestbook_entries (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      message         TEXT NOT NULL,
      edit_token_hash TEXT NOT NULL,
      created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

app.use(express.json());

db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

// Behind Cloudflare Tunnel, req.ip reflects the tunnel connection rather
// than the real visitor, so prefer Cloudflare's CF-Connecting-IP header
// (falling back to req.ip for local dev, where there's no Cloudflare proxy).
function clientIp(req: express.Request): string {
  const header = req.headers['cf-connecting-ip'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }
  return req.ip ?? 'unknown';
}

app.get('/api/ts/system/status', (_req, res) => {
  res.json({
    backend: 'ts',
    status: 'online',
    version: '1.0.0'
  });
});

const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return false;
}

function mapGuestbookEntry(row: GuestbookEntryRow): GuestbookEntry {
  return {
    id: row.id,
    name: row.name,
    message: row.message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function hashEditToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function parseGuestbookId(idParam: string): number | null {
  if (!/^\d+$/.test(idParam)) {
    return null;
  }

  const id = Number(idParam);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeRequiredText(
  value: unknown,
  minLength: number,
  maxLength: number
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  if (normalized.length < minLength || normalized.length > maxLength) {
    return null;
  }

  return normalized;
}

const listGuestbookEntriesStmt = db.prepare(`
  SELECT id, name, message, edit_token_hash, created_at, updated_at
  FROM guestbook_entries
  ORDER BY created_at ASC, id ASC
`);

const selectGuestbookEntryByIdStmt = db.prepare<[number], GuestbookEntryRow>(`
  SELECT id, name, message, edit_token_hash, created_at, updated_at
  FROM guestbook_entries
  WHERE id = ?
`);

const insertGuestbookEntryStmt = db.prepare(`
  INSERT INTO guestbook_entries (name, message, edit_token_hash)
  VALUES (?, ?, ?)
`);

const pruneGuestbookEntriesStmt = db.prepare(`
  DELETE FROM guestbook_entries
  WHERE id NOT IN (
    SELECT id
    FROM guestbook_entries
    ORDER BY created_at DESC, id DESC
    LIMIT 50
  )
`);

const updateGuestbookEntryStmt = db.prepare(`
  UPDATE guestbook_entries
  SET message = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  WHERE id = ?
`);

const deleteGuestbookEntryStmt = db.prepare(`
  DELETE FROM guestbook_entries
  WHERE id = ?
`);

const createGuestbookEntry = db.transaction(
  (name: string, message: string, editTokenHash: string) => {
    const result = insertGuestbookEntryStmt.run(name, message, editTokenHash);
    pruneGuestbookEntriesStmt.run();

    return selectGuestbookEntryByIdStmt.get(Number(result.lastInsertRowid));
  }
);

async function sendContactSms(submission: ContactSubmission): Promise<boolean> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER } =
    process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_FROM_NUMBER || !TWILIO_TO_NUMBER) {
    console.error('backend-ts: Twilio env vars are not fully configured; skipping SMS send');
    return false;
  }

  const body = new URLSearchParams({
    From: TWILIO_FROM_NUMBER,
    To: TWILIO_TO_NUMBER,
    Body: `New contact form submission from ${submission.name} (${submission.email}): ${submission.message}`
  });

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    }
  );
  return res.ok;
}

app.post('/api/ts/contact', async (req, res) => {
  const submission = req.body as Partial<ContactSubmission>;
  const { name, email, message, company } = submission;

  if (!name || !email || !message) {
    res.status(400).json({ ok: false } satisfies ContactResponse);
    return;
  }

  // Honeypot: real users never fill this in. Pretend success without
  // sending an SMS or doing further work.
  if (company) {
    res.status(200).json({ ok: true } satisfies ContactResponse);
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false } satisfies ContactResponse);
    return;
  }

  try {
    const sent = await sendContactSms({ name, email, message });
    if (!sent) {
      res.status(502).json({ ok: false } satisfies ContactResponse);
      return;
    }
    res.status(200).json({ ok: true } satisfies ContactResponse);
  } catch (err) {
    console.error('backend-ts: failed to send contact SMS', err);
    res.status(502).json({ ok: false } satisfies ContactResponse);
  }
});

app.get('/api/ts/guestbook', (_req, res) => {
  const entries = listGuestbookEntriesStmt
    .all()
    .map((row) => mapGuestbookEntry(row as GuestbookEntryRow));

  res.status(200).json({ entries } satisfies GuestbookListResponse);
});

app.post('/api/ts/guestbook', (req, res) => {
  const submission = req.body as Partial<GuestbookCreateRequest>;
  const name = normalizeRequiredText(submission.name, 1, 40);
  const message = normalizeRequiredText(submission.message, 1, 280);

  if (!name || !message) {
    res.status(400).json({ ok: false } satisfies GuestbookCreateResponse);
    return;
  }

  // Honeypot: real users never fill this in. Pretend success without
  // writing to the guestbook or doing further work.
  if (typeof submission.company === 'string' && submission.company.trim().length > 0) {
    res.status(200).json({ ok: true } satisfies GuestbookCreateResponse);
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false } satisfies GuestbookCreateResponse);
    return;
  }

  const editToken = crypto.randomBytes(32).toString('base64url');
  const entry = createGuestbookEntry(name, message, hashEditToken(editToken));

  if (!entry) {
    res.status(500).json({ ok: false } satisfies GuestbookCreateResponse);
    return;
  }

  res.status(201).json({
    ok: true,
    entry: mapGuestbookEntry(entry),
    editToken
  } satisfies GuestbookCreateResponse);
});

app.patch('/api/ts/guestbook/:id', (req, res) => {
  const id = parseGuestbookId(req.params.id);
  if (id === null) {
    res.status(404).json({ ok: false } satisfies GuestbookUpdateResponse);
    return;
  }

  const submission = req.body as Partial<GuestbookUpdateRequest>;
  const message = normalizeRequiredText(submission.message, 1, 280);
  if (!message || typeof submission.editToken !== 'string' || submission.editToken.length === 0) {
    res.status(400).json({ ok: false } satisfies GuestbookUpdateResponse);
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false } satisfies GuestbookUpdateResponse);
    return;
  }

  const existingEntry = selectGuestbookEntryByIdStmt.get(id);
  if (!existingEntry) {
    res.status(404).json({ ok: false } satisfies GuestbookUpdateResponse);
    return;
  }

  if (existingEntry.edit_token_hash !== hashEditToken(submission.editToken)) {
    res.status(403).json({ ok: false } satisfies GuestbookUpdateResponse);
    return;
  }

  updateGuestbookEntryStmt.run(message, id);
  const updatedEntry = selectGuestbookEntryByIdStmt.get(id);

  res.status(200).json({
    ok: true,
    entry: updatedEntry ? mapGuestbookEntry(updatedEntry) : undefined
  } satisfies GuestbookUpdateResponse);
});

app.delete('/api/ts/guestbook/:id', (req, res) => {
  const id = parseGuestbookId(req.params.id);
  if (id === null) {
    res.status(404).json({ ok: false } satisfies GuestbookDeleteResponse);
    return;
  }

  const submission = req.body as Partial<GuestbookDeleteRequest>;
  if (typeof submission.editToken !== 'string' || submission.editToken.length === 0) {
    res.status(400).json({ ok: false } satisfies GuestbookDeleteResponse);
    return;
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    res.status(429).json({ ok: false } satisfies GuestbookDeleteResponse);
    return;
  }

  const existingEntry = selectGuestbookEntryByIdStmt.get(id);
  if (!existingEntry) {
    res.status(404).json({ ok: false } satisfies GuestbookDeleteResponse);
    return;
  }

  if (existingEntry.edit_token_hash !== hashEditToken(submission.editToken)) {
    res.status(403).json({ ok: false } satisfies GuestbookDeleteResponse);
    return;
  }

  deleteGuestbookEntryStmt.run(id);
  res.status(200).json({ ok: true } satisfies GuestbookDeleteResponse);
});

app.listen(port, () => {
  console.log(`backend-ts listening on :${port}`);
});
