import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type {
  GuestbookCreateRequest,
  GuestbookCreateResponse,
  GuestbookDeleteResponse,
  GuestbookEntry,
  GuestbookListResponse,
  GuestbookUpdateResponse
} from '@iota/types';
import { getApiBaseUrl } from '../../backend';

type GuestbookForm = GuestbookCreateRequest & { company: string };
type EditTokenMap = Record<string, string>;

const GUESTBOOK_EDIT_TOKENS_KEY = 'guestbook_edit_tokens';

// Reads the id->editToken map from localStorage, tolerating missing,
// malformed, or partially-invalid JSON by falling back to an empty map.
function readEditTokens(): EditTokenMap {
  try {
    const raw = window.localStorage.getItem(GUESTBOOK_EDIT_TOKENS_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
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
function writeEditTokens(tokens: EditTokenMap) {
  window.localStorage.setItem(GUESTBOOK_EDIT_TOKENS_KEY, JSON.stringify(tokens));
}

@Component({
  selector: 'app-guestbook',
  standalone: true,
  imports: [FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './guestbook.component.html'
})
export class GuestbookComponent implements OnInit {
  entries: GuestbookEntry[] = [];
  form: GuestbookForm = { name: '', message: '', company: '' };
  editTokens: EditTokenMap = readEditTokens();
  isLoading = true;
  isCreating = false;
  loadError = '';
  createError = '';
  editingId: number | null = null;
  editMessage = '';
  deleteConfirmId: number | null = null;
  busyEntryId: number | null = null;
  entryErrorId: number | null = null;
  entryError = '';

  // Kicks off the initial guestbook entry fetch on component init.
  ngOnInit() {
    void this.loadEntries();
  }

  // Returns whether this browser holds a stored edit token for the entry.
  ownsEntry(entryId: number): boolean {
    return typeof this.editTokens[String(entryId)] === 'string';
  }

  // Switches an owned entry into inline edit mode, seeding the editable
  // message and clearing any conflicting delete-confirm/error state.
  startEditing(entry: GuestbookEntry) {
    this.clearEntryError(entry.id);
    this.deleteConfirmId = null;
    this.editingId = entry.id;
    this.editMessage = entry.message;
  }

  // Exits inline edit mode without saving, unless a save/delete request
  // for this entry is currently in flight.
  cancelEditing() {
    if (this.busyEntryId === this.editingId) {
      return;
    }

    this.editingId = null;
    this.editMessage = '';
  }

  // Shows the inline delete confirmation for an owned entry, clearing any
  // conflicting edit/error state.
  confirmDelete(entryId: number) {
    this.clearEntryError(entryId);
    this.editingId = null;
    this.editMessage = '';
    this.deleteConfirmId = entryId;
  }

  // Dismisses the inline delete confirmation, unless a request for this
  // entry is currently in flight.
  cancelDelete() {
    if (this.busyEntryId === this.deleteConfirmId) {
      return;
    }

    this.deleteConfirmId = null;
  }

  // Validates and submits the new-entry form, storing the returned edit
  // token and appending the created entry to the list on success.
  async handleCreate(event: Event): Promise<void> {
    event.preventDefault();

    if (this.isCreating) {
      return;
    }

    const name = this.form.name.trim();
    const message = this.form.message.trim();

    if (name.length < 1 || name.length > 40 || message.length < 1 || message.length > 280) {
      this.createError = 'validation failed — name must be 1-40 chars and message 1-280 chars.';
      return;
    }

    this.isCreating = true;
    this.createError = '';

    try {
      const response = await fetch(`${getApiBaseUrl()}/guestbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          message,
          company: this.form.company
        } satisfies GuestbookCreateRequest)
      });

      if (response.status === 400) {
        this.createError = 'validation failed — name must be 1-40 chars and message 1-280 chars.';
        return;
      }

      if (response.status === 429) {
        this.createError = 'slow down — try again in a few minutes.';
        return;
      }

      if (!response.ok) {
        this.createError = 'couldn’t add entry — try again.';
        return;
      }

      const result = (await response.json()) as GuestbookCreateResponse;
      if (!result.ok || !result.entry || !result.editToken) {
        this.createError = 'couldn’t add entry — try again.';
        return;
      }

      this.entries = [...this.entries, result.entry];
      this.setEditToken(result.entry.id, result.editToken);
      this.form = { name: '', message: '', company: '' };
    } catch {
      this.createError = 'couldn’t add entry — try again.';
    } finally {
      this.isCreating = false;
    }
  }

  // Validates and submits an edited message for an owned entry, updating
  // local state with the server's fresh entry on success.
  async saveEdit(entryId: number): Promise<void> {
    if (this.busyEntryId !== null) {
      return;
    }

    const editToken = this.editTokens[String(entryId)];
    if (!editToken) {
      return;
    }

    const message = this.editMessage.trim();
    if (message.length < 1 || message.length > 280) {
      this.setEntryError(entryId, 'validation failed — message must be 1-280 chars.');
      return;
    }

    this.busyEntryId = entryId;
    this.clearEntryError(entryId);

    try {
      const response = await fetch(`${getApiBaseUrl()}/guestbook/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, editToken })
      });

      if (response.status === 400) {
        this.setEntryError(entryId, 'validation failed — message must be 1-280 chars.');
        return;
      }

      if (response.status === 403) {
        this.expireEntryToken(entryId);
        this.setEntryError(entryId, 'edit token expired — controls removed for this entry.');
        return;
      }

      if (response.status === 404) {
        this.setEntryError(entryId, 'entry not found.');
        return;
      }

      if (response.status === 429) {
        this.setEntryError(entryId, 'slow down — try again in a few minutes.');
        return;
      }

      if (!response.ok) {
        this.setEntryError(entryId, 'couldn’t save changes — try again.');
        return;
      }

      const result = (await response.json()) as GuestbookUpdateResponse;
      if (!result.ok || !result.entry) {
        this.setEntryError(entryId, 'couldn’t save changes — try again.');
        return;
      }

      this.entries = this.entries.map((entry) => (entry.id === entryId ? result.entry! : entry));
      this.editingId = null;
      this.editMessage = '';
    } catch {
      this.setEntryError(entryId, 'couldn’t save changes — try again.');
    } finally {
      this.busyEntryId = null;
    }
  }

  // Deletes an owned entry after confirmation, removing it (and its
  // stored token) from local state on success.
  async deleteEntry(entryId: number): Promise<void> {
    if (this.busyEntryId !== null) {
      return;
    }

    const editToken = this.editTokens[String(entryId)];
    if (!editToken) {
      return;
    }

    this.busyEntryId = entryId;
    this.clearEntryError(entryId);

    try {
      const response = await fetch(`${getApiBaseUrl()}/guestbook/${entryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editToken })
      });

      if (response.status === 403) {
        this.expireEntryToken(entryId);
        this.setEntryError(entryId, 'edit token expired — controls removed for this entry.');
        return;
      }

      if (response.status === 404) {
        this.setEntryError(entryId, 'entry not found.');
        return;
      }

      if (response.status === 429) {
        this.setEntryError(entryId, 'slow down — try again in a few minutes.');
        return;
      }

      if (!response.ok) {
        this.setEntryError(entryId, 'couldn’t delete entry — try again.');
        return;
      }

      if (response.status !== 204) {
        const result = (await response.json()) as GuestbookDeleteResponse;
        if (!result.ok) {
          this.setEntryError(entryId, 'couldn’t delete entry — try again.');
          return;
        }
      }

      this.entries = this.entries.filter((entry) => entry.id !== entryId);
      this.removeEditToken(entryId);
      this.deleteConfirmId = null;
      this.editingId = null;
      this.editMessage = '';
      this.clearEntryError(entryId);
    } catch {
      this.setEntryError(entryId, 'couldn’t delete entry — try again.');
    } finally {
      this.busyEntryId = null;
    }
  }

  // Fetches the full guestbook entry list from the active backend.
  private async loadEntries(): Promise<void> {
    this.isLoading = true;
    this.loadError = '';

    try {
      const response = await fetch(`${getApiBaseUrl()}/guestbook`);
      if (!response.ok) {
        this.loadError = 'couldn’t load guestbook.';
        return;
      }

      const result = (await response.json()) as GuestbookListResponse;
      this.entries = Array.isArray(result.entries) ? result.entries : [];
    } catch {
      this.loadError = 'couldn’t load guestbook.';
    } finally {
      this.isLoading = false;
    }
  }

  // Stores a newly-issued edit token for an entry, both in state and
  // localStorage, so this browser can later edit/delete that entry.
  private setEditToken(entryId: number, editToken: string) {
    this.editTokens = { ...this.editTokens, [String(entryId)]: editToken };
    writeEditTokens(this.editTokens);
  }

  // Removes an entry's edit token from state and localStorage.
  private removeEditToken(entryId: number) {
    const nextTokens = { ...this.editTokens };
    delete nextTokens[String(entryId)];
    this.editTokens = nextTokens;
    writeEditTokens(this.editTokens);
  }

  // Handles a 403 from the server (token no longer valid): clears the
  // stale token and exits any active edit/delete UI for the entry.
  private expireEntryToken(entryId: number) {
    this.removeEditToken(entryId);

    if (this.editingId === entryId) {
      this.editingId = null;
      this.editMessage = '';
    }

    if (this.deleteConfirmId === entryId) {
      this.deleteConfirmId = null;
    }
  }

  // Sets the inline error message shown for a specific entry.
  private setEntryError(entryId: number, message: string) {
    this.entryErrorId = entryId;
    this.entryError = message;
  }

  // Clears the inline error message for an entry, if it's the one shown.
  private clearEntryError(entryId: number) {
    if (this.entryErrorId === entryId) {
      this.entryErrorId = null;
      this.entryError = '';
    }
  }
}
