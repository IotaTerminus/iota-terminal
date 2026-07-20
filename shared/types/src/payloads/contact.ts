export interface ContactSubmission {
  name: string;
  email: string;
  message: string;
  /**
   * Honeypot field: a visually-hidden input that real users never fill in.
   * If non-empty, the backend silently pretends success without sending an
   * SMS or doing further work.
   */
  company?: string;
}

export interface ContactResponse {
  ok: boolean;
}