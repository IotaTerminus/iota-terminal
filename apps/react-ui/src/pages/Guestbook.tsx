import { useEffect, useState, type FormEvent } from 'react';
import type {
  GuestbookCreateRequest,
  GuestbookCreateResponse,
  GuestbookEntry,
  GuestbookListResponse,
  GuestbookUpdateResponse
} from '@iota/types';
import { getApiBaseUrl } from '../backend';

const TOKEN_STORAGE_KEY = 'guestbook_edit_tokens';
const NAME_MAX_LENGTH = 40;
const MESSAGE_MAX_LENGTH = 280;

type SubmitState = 'idle' | 'sending';
type EntryAction = 'idle' | 'saving' | 'deleting';
type Feedback = { kind: 'success' | 'error'; text: string } | null;
type TokenMap = Record<string, string>;

// Reads the id->editToken map from localStorage, tolerating missing,
// malformed, or partially-invalid JSON by falling back to an empty map.
function readTokenMap(): TokenMap {
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string] =>
          typeof entry[0] === 'string' && typeof entry[1] === 'string'
      )
    );
  } catch {
    return {};
  }
}

// Persists the id->editToken map to localStorage as JSON.
function writeTokenMap(tokens: TokenMap) {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokens));
}

// Renders a guestbook entry's createdAt as an ISO timestamp, falling back
// to the raw string if it isn't a parseable date.
function formatTimestamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export default function Guestbook() {
  const [entries, setEntries] = useState<GuestbookEntry[]>([]);
  const [tokens, setTokens] = useState<TokenMap>(() => readTokenMap());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<Required<GuestbookCreateRequest>>({
    name: '',
    message: '',
    company: ''
  });
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [submitFeedback, setSubmitFeedback] = useState<Feedback>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const [entryActionId, setEntryActionId] = useState<number | null>(null);
  const [entryAction, setEntryAction] = useState<EntryAction>('idle');
  const [entryFeedback, setEntryFeedback] = useState<{ id: number; text: string } | null>(null);

  // Fetches the guestbook entry list on mount, ignoring the result if the
  // component unmounts before the request resolves.
  useEffect(() => {
    let isMounted = true;

    async function loadEntries() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/guestbook`);
        if (!res.ok) {
          throw new Error('bad-response');
        }

        const data = (await res.json()) as GuestbookListResponse;
        if (!isMounted) {
          return;
        }

        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setLoadError(null);
      } catch {
        if (!isMounted) {
          return;
        }

        setLoadError('couldn’t load guestbook entries from the active backend.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadEntries();

    return () => {
      isMounted = false;
    };
  }, []);

  // Stores a newly-issued edit token for an entry, both in state and
  // localStorage, so this browser can later edit/delete that entry.
  function storeToken(id: number, token: string) {
    setTokens((current) => {
      const nextTokens = { ...current, [String(id)]: token };
      writeTokenMap(nextTokens);
      return nextTokens;
    });
  }

  // Removes an entry's edit token from state and localStorage (e.g. after
  // deletion or a server-rejected/stale token).
  function clearToken(id: number) {
    setTokens((current) => {
      const nextTokens = { ...current };
      delete nextTokens[String(id)];
      writeTokenMap(nextTokens);
      return nextTokens;
    });
  }

  // Handles a 403 from the server (token no longer valid): clears the
  // stale token, exits any active edit/delete UI for the entry, and shows
  // an explanatory message.
  function handleStaleToken(id: number, message: string) {
    clearToken(id);
    setEditingId((current) => (current === id ? null : current));
    setPendingDeleteId((current) => (current === id ? null : current));
    setEntryAction('idle');
    setEntryActionId(null);
    setEntryFeedback({ id, text: message });
  }

  // Validates and submits the new-entry form, storing the returned edit
  // token and appending the created entry to the list on success.
  async function handleCreate(e: FormEvent) {
    e.preventDefault();

    const name = form.name.trim();
    const message = form.message.trim();
    if (
      name.length < 1 ||
      name.length > NAME_MAX_LENGTH ||
      message.length < 1 ||
      message.length > MESSAGE_MAX_LENGTH
    ) {
      setSubmitFeedback({
        kind: 'error',
        text: 'validation failed — name/message length is out of bounds.'
      });
      return;
    }

    setSubmitState('sending');
    setSubmitFeedback(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          message,
          company: form.company
        } satisfies GuestbookCreateRequest)
      });

      if (res.status === 400) {
        setSubmitFeedback({
          kind: 'error',
          text: 'validation failed — check the field lengths and try again.'
        });
        return;
      }

      if (res.status === 429) {
        setSubmitFeedback({ kind: 'error', text: 'slow down — try again in a few minutes.' });
        return;
      }

      if (!res.ok) {
        setSubmitFeedback({
          kind: 'error',
          text: 'couldn’t add entry — the guestbook backend returned an error.'
        });
        return;
      }

      const data = (await res.json()) as GuestbookCreateResponse;
      if (!data.ok || !data.entry) {
        setSubmitFeedback({
          kind: 'error',
          text: 'couldn’t add entry — the guestbook backend returned an invalid response.'
        });
        return;
      }

      const createdEntry = data.entry;
      setEntries((current) => [...current, createdEntry]);
      if (data.editToken) {
        storeToken(createdEntry.id, data.editToken);
      }

      setForm({ name: '', message: '', company: '' });
      setSubmitFeedback({ kind: 'success', text: 'entry added.' });
    } catch {
      setSubmitFeedback({
        kind: 'error',
        text: 'couldn’t add entry — is the active backend reachable?'
      });
    } finally {
      setSubmitState('idle');
    }
  }

  // Validates and submits an edited message for an owned entry, updating
  // local state with the server's fresh entry on success.
  async function handleSave(entry: GuestbookEntry) {
    const token = tokens[String(entry.id)];
    if (!token) {
      handleStaleToken(entry.id, 'saved token missing — edit controls hidden for this entry.');
      return;
    }

    const message = editingMessage.trim();
    if (message.length < 1 || message.length > MESSAGE_MAX_LENGTH) {
      setEntryFeedback({
        id: entry.id,
        text: 'validation failed — message must be between 1 and 280 characters.'
      });
      return;
    }

    setEntryActionId(entry.id);
    setEntryAction('saving');
    setEntryFeedback(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/guestbook/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, editToken: token })
      });

      if (res.status === 403) {
        handleStaleToken(
          entry.id,
          'edit token expired on the server — edit controls hidden for this entry.'
        );
        return;
      }

      if (res.status === 429) {
        setEntryFeedback({ id: entry.id, text: 'slow down — try again in a few minutes.' });
        return;
      }

      if (res.status === 400) {
        setEntryFeedback({
          id: entry.id,
          text: 'validation failed — message must be between 1 and 280 characters.'
        });
        return;
      }

      if (!res.ok) {
        setEntryFeedback({
          id: entry.id,
          text: 'couldn’t save entry — the guestbook backend returned an error.'
        });
        return;
      }

      const data = (await res.json()) as GuestbookUpdateResponse;
      if (!data.ok || !data.entry) {
        setEntryFeedback({
          id: entry.id,
          text: 'couldn’t save entry — the guestbook backend returned an invalid response.'
        });
        return;
      }

      const updatedEntry = data.entry;
      setEntries((current) => current.map((item) => (item.id === entry.id ? updatedEntry : item)));
      setEditingId(null);
      setEditingMessage('');
    } catch {
      setEntryFeedback({
        id: entry.id,
        text: 'couldn’t save entry — is the active backend reachable?'
      });
    } finally {
      setEntryAction('idle');
      setEntryActionId(null);
    }
  }

  // Deletes an owned entry after confirmation, removing it (and its
  // stored token) from local state on success.
  async function handleDelete(id: number) {
    const token = tokens[String(id)];
    if (!token) {
      handleStaleToken(id, 'saved token missing — delete controls hidden for this entry.');
      return;
    }

    setEntryActionId(id);
    setEntryAction('deleting');
    setEntryFeedback(null);

    try {
      const res = await fetch(`${getApiBaseUrl()}/guestbook/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editToken: token })
      });

      if (res.status === 403) {
        handleStaleToken(
          id,
          'edit token expired on the server — delete controls hidden for this entry.'
        );
        return;
      }

      if (res.status === 429) {
        setEntryFeedback({ id, text: 'slow down — try again in a few minutes.' });
        return;
      }

      if (!res.ok) {
        setEntryFeedback({
          id,
          text: 'couldn’t delete entry — the guestbook backend returned an error.'
        });
        return;
      }

      setEntries((current) => current.filter((entry) => entry.id !== id));
      clearToken(id);
      setPendingDeleteId(null);
      setEditingId((current) => (current === id ? null : current));
      setEditingMessage('');
    } catch {
      setEntryFeedback({ id, text: 'couldn’t delete entry — is the active backend reachable?' });
    } finally {
      setEntryAction('idle');
      setEntryActionId(null);
    }
  }

  return (
    <iota-window title="~/guestbook">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1 text-sm text-terminal-dim">
          <p>leave a note in the shared terminal log.</p>
          <p>
            entries are listed oldest-first; tokens saved in this browser unlock inline edits and
            deletes.
          </p>
        </div>

        <form className="flex flex-col gap-4 max-w-2xl" onSubmit={handleCreate}>
          <label className="flex flex-col gap-1 text-sm">
            name
            <input
              required
              maxLength={NAME_MAX_LENGTH}
              className="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            />
          </label>
          <label className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
            company
            <input
              tabIndex={-1}
              autoComplete="off"
              value={form.company}
              onChange={(e) => setForm((current) => ({ ...current, company: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            message
            <textarea
              required
              rows={4}
              maxLength={MESSAGE_MAX_LENGTH}
              className="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
              value={form.message}
              onChange={(e) => setForm((current) => ({ ...current, message: e.target.value }))}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <button
              type="submit"
              disabled={submitState === 'sending'}
              className="border border-terminal-fg text-terminal-fg rounded px-3 py-1 w-fit hover:bg-terminal-fg/10"
            >
              {submitState === 'sending' ? 'writing...' : 'add entry'}
            </button>
            <span className="text-terminal-dim">
              {form.message.length}/{MESSAGE_MAX_LENGTH}
            </span>
          </div>
          {submitFeedback && (
            <p
              className={
                submitFeedback.kind === 'error'
                  ? 'text-terminal-red text-sm'
                  : 'text-terminal-fg text-sm'
              }
            >
              {submitFeedback.text}
            </p>
          )}
        </form>

        <section className="flex flex-col gap-3">
          <p className="text-sm text-terminal-dim">$ cat guestbook.txt</p>

          {loading && <p className="text-terminal-dim">loading entries...</p>}

          {!loading && loadError && <p className="text-terminal-red text-sm">{loadError}</p>}

          {!loading && !loadError && entries.length === 0 && (
            <p className="text-terminal-dim">no entries yet — be the first to write one.</p>
          )}

          {!loading && !loadError && entries.length > 0 && (
            <ul className="flex flex-col gap-4">
              {entries.map((entry) => {
                const isOwned = Boolean(tokens[String(entry.id)]);
                const isEditing = editingId === entry.id;
                const isConfirmingDelete = pendingDeleteId === entry.id;
                const isSaving = entryActionId === entry.id && entryAction === 'saving';
                const isDeleting = entryActionId === entry.id && entryAction === 'deleting';

                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-2 border-l border-terminal-dim pl-3"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-sm">
                      <span className="text-terminal-dim">
                        [{formatTimestamp(entry.createdAt)}]
                      </span>
                      <span className="text-terminal-fg">{entry.name}</span>
                      {entry.updatedAt !== entry.createdAt && (
                        <span className="text-terminal-dim">(edited)</span>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <textarea
                          rows={4}
                          maxLength={MESSAGE_MAX_LENGTH}
                          className="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
                          value={editingMessage}
                          onChange={(e) => setEditingMessage(e.target.value)}
                        />
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <button
                            type="button"
                            disabled={isSaving}
                            className="border border-terminal-fg text-terminal-fg rounded px-3 py-1 hover:bg-terminal-fg/10"
                            onClick={() => void handleSave(entry)}
                          >
                            {isSaving ? 'saving...' : 'save'}
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            className="border border-terminal-dim rounded px-3 py-1 hover:bg-terminal-fg/10"
                            onClick={() => {
                              setEditingId(null);
                              setEditingMessage('');
                              setEntryFeedback(null);
                            }}
                          >
                            cancel
                          </button>
                          <span className="text-terminal-dim">
                            {editingMessage.length}/{MESSAGE_MAX_LENGTH}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words font-mono text-sm text-terminal-fg">
                        {entry.message}
                      </p>
                    )}

                    {isOwned && !isConfirmingDelete && (
                      <div className="flex flex-wrap gap-2 text-sm">
                        <button
                          type="button"
                          disabled={isSaving || isDeleting}
                          className="rounded px-2 py-1 text-terminal-fg hover:bg-terminal-fg/10"
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditingMessage(entry.message);
                            setPendingDeleteId(null);
                            setEntryFeedback(null);
                          }}
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          disabled={isSaving || isDeleting}
                          className="rounded px-2 py-1 text-terminal-fg hover:bg-terminal-fg/10"
                          onClick={() => {
                            setPendingDeleteId(entry.id);
                            setEditingId(null);
                            setEntryFeedback(null);
                          }}
                        >
                          delete
                        </button>
                      </div>
                    )}

                    {isOwned && isConfirmingDelete && (
                      <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-terminal-dim">delete?</span>
                        <button
                          type="button"
                          disabled={isDeleting}
                          className="rounded px-2 py-1 text-terminal-fg hover:bg-terminal-fg/10"
                          onClick={() => void handleDelete(entry.id)}
                        >
                          {isDeleting ? 'deleting...' : 'yes'}
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          className="rounded px-2 py-1 text-terminal-fg hover:bg-terminal-fg/10"
                          onClick={() => setPendingDeleteId(null)}
                        >
                          no
                        </button>
                      </div>
                    )}

                    {entryFeedback?.id === entry.id && (
                      <p className="text-terminal-red text-sm">{entryFeedback.text}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </iota-window>
  );
}
