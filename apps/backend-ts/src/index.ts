/**
 * backend-ts: the TypeScript implementation of the iota-terminal API contract.
 */
import path from 'path';
import dotenv from 'dotenv';
import express from 'express';

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

const app = express();
const port = 8082;

app.use(express.json());

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

async function sendContactSms(submission: ContactSubmission): Promise<boolean> {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER, TWILIO_TO_NUMBER } = process.env;
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

  const ip = req.ip ?? 'unknown';
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

app.listen(port, () => {
  console.log(`backend-ts listening on :${port}`);
});
