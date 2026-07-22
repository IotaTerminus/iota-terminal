import type { GuestbookEntry } from '../models/guestbook';

/**
 * Guestbook CRUD payloads, identical across all three backends
 * (`/api/<backend>/guestbook`). There are no user accounts: creating an
 * entry returns a one-time `editToken` that the frontend must present
 * (matched against a server-side hash) to update or delete that entry
 * later. The token is never re-served after creation.
 */

export interface GuestbookListResponse {
  entries: GuestbookEntry[];
}

export interface GuestbookCreateRequest {
  name: string;
  message: string;
  /**
   * Honeypot field: a visually-hidden input that real users never fill in.
   * If non-empty, the backend silently pretends success without writing
   * anything.
   */
  company?: string;
}

export interface GuestbookCreateResponse {
  ok: boolean;
  entry?: GuestbookEntry;
  editToken?: string;
}

export interface GuestbookUpdateRequest {
  message: string;
  editToken: string;
}

export interface GuestbookUpdateResponse {
  ok: boolean;
  entry?: GuestbookEntry;
}

export interface GuestbookDeleteRequest {
  editToken: string;
}

export interface GuestbookDeleteResponse {
  ok: boolean;
}
