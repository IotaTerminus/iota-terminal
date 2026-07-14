/**
 * Backend-toggling logic shared in spirit with apps/react-ui/src/backend.ts:
 * reads the `active_backend` key from localStorage and resolves it to the
 * same-origin API path prefix for that backend. Falls back to "ts" when
 * unset or invalid.
 *
 * Requests always stay same-origin (e.g. `/api/go/...`) so this works
 * unchanged in both local dev (via ng serve's proxy.conf.json) and
 * production (via the Cloudflare Tunnel ingress rules routing
 * `/api/<backend>` to the matching container).
 */
export type BackendId = 'go' | 'rust' | 'ts';

const DEFAULT_BACKEND: BackendId = 'ts';
const STORAGE_KEY = 'active_backend';

function isBackendId(value: string | null): value is BackendId {
  return value === 'go' || value === 'rust' || value === 'ts';
}

export function getActiveBackend(): BackendId {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isBackendId(stored) ? stored : DEFAULT_BACKEND;
}

export function setActiveBackend(backend: BackendId): void {
  window.localStorage.setItem(STORAGE_KEY, backend);
}

export function getApiBaseUrl(): string {
  return `/api/${getActiveBackend()}`;
}
