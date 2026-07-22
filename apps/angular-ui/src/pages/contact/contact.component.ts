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
  templateUrl: './contact.component.html'
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
