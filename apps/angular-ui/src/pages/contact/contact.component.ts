import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { ContactSubmission } from '@iota/types';
import { getApiBaseUrl } from '../../backend';

type SubmitState = 'idle' | 'sending' | 'sent' | 'error';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <iota-window title="~/contact">
      <form class="flex flex-col gap-4 max-w-md" (submit)="handleSubmit($event)">
        <label class="flex flex-col gap-1 text-sm">
          name
          <input
            required
            name="name"
            class="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
            [(ngModel)]="form.name"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          email
          <input
            required
            type="email"
            name="email"
            class="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
            [(ngModel)]="form.email"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          message
          <textarea
            required
            name="message"
            rows="5"
            class="bg-transparent border border-terminal-dim rounded px-2 py-1 text-terminal-fg"
            [(ngModel)]="form.message"
          ></textarea>
        </label>
        <!-- Honeypot: hidden from real users off-screen (not display:none or
             type="hidden"), so basic bots that fill every visible field still
             trip it. Backend treats a non-empty value as spam. -->
        <label class="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true">
          company
          <input
            tabindex="-1"
            autocomplete="off"
            name="company"
            [(ngModel)]="form.company"
          />
        </label>
        <button
          type="submit"
          [disabled]="state === 'sending'"
          class="border border-terminal-fg text-terminal-fg rounded px-3 py-1 w-fit hover:bg-terminal-fg/10"
        >
          send
        </button>
        @if (state === 'sent') {
          <p class="text-terminal-fg text-sm">message sent.</p>
        }
        @if (state === 'error') {
          <p class="text-terminal-red text-sm">
            couldn't send &mdash; the contact endpoint isn't wired up on this backend yet.
          </p>
        }
      </form>
    </iota-window>
  `
})
export class ContactComponent {
  form: ContactSubmission = { name: '', email: '', message: '', company: '' };
  state: SubmitState = 'idle';

  async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    this.state = 'sending';
    try {
      // No backend /contact endpoint exists yet on any of the three
      // backends; this posts to the active backend's same-origin API path
      // in anticipation of one, and falls back to a friendly error state.
      const res = await fetch(`${getApiBaseUrl()}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.form)
      });
      this.state = res.ok ? 'sent' : 'error';
    } catch {
      this.state = 'error';
    }
  }
}
