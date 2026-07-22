/**
 * Local shim re-declaring the subset of `@iota/types` this backend
 * consumes.
 *
 * Why this exists: unlike the frontend apps (which use `noEmit` +
 * bundler-style module resolution and so never actually compile
 * `shared/types/src/*.ts` into output), backend-ts's tsconfig has
 * `rootDir: "src"` because `tsc` here really emits `dist/index.js` for
 * production. Pointing the `@iota/types` path alias straight at
 * `shared/types/src/index.ts` (as the frontends do) pulls those files into
 * the compiled program and trips TS6059 ("File is not under 'rootDir'").
 * An ambient module declaration sidesteps that: it's type-only and never
 * emitted, so it's exempt from the rootDir check. Keep this in sync with
 * `shared/types/src/models/guestbook.ts` and
 * `shared/types/src/payloads/guestbook.ts` if those change, and add any
 * other `@iota/types` exports here if backend-ts starts consuming them.
 */
declare module '@iota/types' {
  export interface GuestbookEntry {
    id: number;
    name: string;
    message: string;
    createdAt: string;
    updatedAt: string;
  }

  export interface GuestbookListResponse {
    entries: GuestbookEntry[];
  }

  export interface GuestbookCreateRequest {
    name: string;
    message: string;
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
}
