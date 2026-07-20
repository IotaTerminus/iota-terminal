import { useState, type FormEvent } from 'react';
import type { ContactSubmission } from '@iota/types';
import { getApiBaseUrl } from '../backend';

type SubmitState = 'idle' | 'sending' | 'sent' | 'error';

export default function Contact() {
  const [form, setForm] = useState<ContactSubmission>({ name: '', email: '', message: '', company: '' });
  const [state, setState] = useState<SubmitState>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    try {
      // No backend /contact endpoint exists yet on any of the three
      // backends; this posts to the active backend's same-origin API path
      // in anticipation of one, and falls back to a friendly error state.
      const res = await fetch(`${getApiBaseUrl()}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      setState(res.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }

  return (
    <iota-window title="~/contact">
      <form className="flex flex-col gap-4 max-w-md" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          name
          <input
            required
            className="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          email
          <input
            required
            type="email"
            className="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        {/* Honeypot: hidden from real users off-screen (not display:none or
            type="hidden"), so basic bots that fill every visible field still
            trip it. Backend treats a non-empty value as spam. */}
        <label className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
          company
          <input
            tabIndex={-1}
            autoComplete="off"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          message
          <textarea
            required
            rows={5}
            className="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
          />
        </label>
        <button
          type="submit"
          disabled={state === 'sending'}
          className="border border-terminal-fg text-terminal-fg rounded px-3 py-1 w-fit hover:bg-terminal-fg/10"
        >
          send
        </button>
        {state === 'sent' && <p className="text-terminal-fg text-sm">message sent.</p>}
        {state === 'error' && (
          <p className="text-terminal-red text-sm">
            couldn&apos;t send &mdash; the contact endpoint isn&apos;t wired up on this backend yet.
          </p>
        )}
      </form>
    </iota-window>
  );
}
