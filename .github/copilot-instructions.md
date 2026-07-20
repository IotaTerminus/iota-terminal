# iota-terminal

Terminal-themed personal website: Angular & React frontends, pluggable Go/Rust/TS backends implementing the same API contract. This is a v2 rewrite of a previously-named `iota-terminal` repo (now `iota-terminal-deprecated`) using a different monorepo structure — do not assume prior knowledge of the old layout applies here.

## Structure

- `apps/react-ui`, `apps/angular-ui` — independent frontends sharing a Tailwind theme from `shared/styles/tailwind.preset.js` and `shared/styles/styles.css` (imported via `postcss-import` in each app's own global stylesheet).
- `apps/backend-go`, `apps/backend-rust`, `apps/backend-ts` — three interchangeable implementations of the same API contract (currently just `GET /api/<backend>/system/status`, e.g. `/api/go/system/status`, returning `{ backend, status, version }`). When adding an endpoint, implement it identically in all three, each still prefixed with its own `/api/<backend>` path.
- `shared/db` — single SQLite database (`iota.sqlite`) and its `migrations/schema.sql` baseline. No backend reads/writes it yet.
- `shared/types` (`@iota/types`) — framework-agnostic TypeScript package: enums (`src/enums.ts`), domain models (`src/models/`), and API payload interfaces (`src/payloads/`), all re-exported from `src/index.ts`. Consumed with `import type { SystemStatus } from '@iota/types'` in both frontends. Note: `BackendType` enum uses `TypeScript = 'typescript'`, which is inconsistent with the `'ts'` literal used everywhere else (`active_backend` storage values, `/api/ts` route prefix, `BackendId` type) — don't conflate the two when adding backend-related types.
- `shared/ui` (`@iota/ui`) — framework-agnostic UI components implemented as native Custom Elements (e.g. `IotaCursor` in `src/cursor.ts`, registered via `registerIotaCursor()`), so the same component works unmodified in both React and Angular. Both frontends call `registerIotaCursor()` once at startup (`App.tsx` / `app.component.ts`) then reference the custom element (`<iota-cursor>`) in markup.
- npm workspaces (`apps/react-ui`, `apps/angular-ui`, `apps/backend-ts`, `apps/backend-go`, `apps/backend-rust`, `shared/types`, `shared/ui`) orchestrated by Turborepo (`turbo.json`); Go/Rust workspaces just shell out to their native toolchains via npm scripts.

## Backend selection (frontend architecture)

Both frontends read the `active_backend` key (`"go" | "rust" | "ts"`) from `localStorage` to decide which backend to call; it defaults to `"ts"` if unset. `getApiBaseUrl()` returns a same-origin path prefix (`/api/go`, `/api/rust`, or `/api/ts`) — requests never hardcode a host/port, since the deployed site is reached through Cloudflare Tunnel subdomains, not `localhost`. This logic is duplicated (not shared as a package) in `apps/react-ui/src/backend.ts` and `apps/angular-ui/src/backend.ts` — keep both in sync when adding a backend or changing a route prefix.

In local dev, each frontend's dev server proxies `/api/<backend>` to the matching `localhost:PORT` backend (`apps/react-ui/vite.config.ts`'s `server.proxy`, `apps/angular-ui/proxy.conf.json` wired via `angular.json`'s `serve.options.proxyConfig`). In production, `deploy/cloudflared/config.yml` performs the equivalent routing per hostname. Both `npm run dev` scripts bind `--host 0.0.0.0` so they're reachable from other devices on the LAN.

## Deployment architecture

The site runs on a Raspberry Pi 4 behind a single Cloudflare Tunnel, with three public hostnames sharing it:
- `iotaterminus.dev` — onboarding-only picker (same `angular-ui` build; `apps/angular-ui/src/app.component.ts` checks `window.location.hostname` and renders a picker instead of the terminal demo when it's the bare root domain).
- `angular.iotaterminus.dev` / `react.iotaterminus.dev` — the full demo apps.

Each app has a `Dockerfile` (`apps/*/Dockerfile`); frontend images build the app then serve the static output via `caddy:alpine`. `apps/react-ui/Dockerfile` and `apps/angular-ui/Dockerfile` must be built with the **repo root** as context (they `COPY shared shared` for the Tailwind/CSS import) — the Go/Rust/TS backends build with their own app directory as context. `.github/workflows/docker-publish.yml` cross-compiles all five for `linux/arm64` and pushes to GHCR; a `smoke-test` job (builds native-arch images via `deploy/docker-compose.ci.yml`, curls every service, tears down) gates the GHCR push and runs on every push/PR. `deploy/docker-compose.yml` is the Pi's runtime stack; `watchtower` auto-pulls new images so `git push` to `main` is the entire release step. See `deploy/DEPLOYMENT.md` for full setup/update instructions.

## Build & dev commands

```bash
npm install            # installs react-ui, angular-ui, backend-ts, shared/types, shared/ui (JS/TS workspaces only)
make db-init            # creates shared/db/iota.sqlite (WAL enabled) from shared/db/migrations/schema.sql
make db-clean           # removes iota.sqlite and its WAL/SHM sidecars
npm run dev             # turbo dev across all JS/TS workspaces only (react-ui :5173, angular-ui :4200, backend-ts :8082)
npm run dev:all         # dev + backend-go (:8080) + backend-rust (:8081) concurrently (labeled/colored output), single Ctrl+C stops all
npm run build           # turbo run build (all workspaces)
npm run lint            # turbo run lint (all workspaces)
```

Run a single workspace's task directly, e.g.:

```bash
npm run build --workspace=react-ui
npm run lint --workspace=angular-ui
```

Backends run independently (not via turbo dev, since Go/Rust aren't npm-native):

```bash
cd apps/backend-go && go run main.go       # :8080, lint via `go vet ./...`
cd apps/backend-rust && cargo run          # :8081, lint via `cargo clippy -- -D warnings`
cd apps/backend-ts && npm run dev          # :8082 (tsx watch)
```

There are no test suites configured in any workspace yet (`backend-ts`'s `lint` script and root `npm run test` are no-op placeholders).

`make clean-all` / `make refresh` (root `Makefile`) sweep `node_modules`, `.turbo`, `dist`, `.angular`, `out-tsc`, `bin` across the monorepo and optionally reinstall + rebuild (`REGEN_LOCK=true make refresh` also deletes `package-lock.json` first).

`angular-ui`'s onboarding picker (rendered only when `hostname === 'iotaterminus.dev'`) requires HSTS-forced HTTPS to view locally — see README's "Viewing the onboarding page locally" for the `mkcert` + `/etc/hosts` + `npm run dev:onboarding` setup.
