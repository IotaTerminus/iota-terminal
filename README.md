# iota-terminal
Terminal-themed Personal website. Utilizes Angular &amp; React front-ends that can then dynamically choose to use either Go, Rust, or TS based back-ends.

## Structure

- `apps/react-ui`, `apps/angular-ui` — independent frontends sharing a Tailwind theme from `shared/styles/tailwind.preset.js`.
- `apps/backend-go`, `apps/backend-rust`, `apps/backend-ts` — three interchangeable implementations of the same API contract (currently just `GET /api/<backend>/system/status`, e.g. `/api/go/system/status`).
- `shared/db` — single SQLite database (`iota.sqlite`) and its `migrations/schema.sql` baseline.

## Getting started

```bash
npm install          # installs react-ui, angular-ui, backend-ts
make db-init          # creates shared/db/iota.sqlite (WAL enabled) from schema.sql
npm run dev            # turbo dev across all JS/TS workspaces, reachable on your LAN
```

`npm run dev` only starts the JS/TS workspaces (`react-ui` on `:5173`, `angular-ui` on `:4200`, `backend-ts` on `:8082`). To also spin up the Go and Rust backends in the same terminal, use:

```bash
npm run dev:all        # react-ui, angular-ui, backend-go, backend-rust, backend-ts, all at once
```

This runs all five dev servers concurrently (labeled/colored output per service) and stops all of them together on Ctrl+C. Alternatively, run backends independently:

```bash
cd apps/backend-go && go run main.go       # :8080
cd apps/backend-rust && cargo run          # :8081
cd apps/backend-ts && npm run dev          # :8082
```

The frontends read an `active_backend` key (`"go" | "rust" | "ts"`) from `localStorage` to decide which backend to call; it defaults to `"ts"` if unset. Requests always stay same-origin (`/api/<backend>/...`) — each frontend's dev server proxies that path to the matching `localhost` port (see `apps/react-ui/vite.config.ts` and `apps/angular-ui/proxy.conf.json`), and in production the Cloudflare Tunnel ingress does the equivalent routing.

### Test URLs

With `npm run dev:all` (or `npm run dev` + the backends) running:

| Component | URL |
| --- | --- |
| react-ui | http://localhost:5173 |
| angular-ui (demo) | http://localhost:4200 |
| backend-go | http://localhost:8080/api/go/system/status |
| backend-rust | http://localhost:8081/api/rust/system/status |
| backend-ts | http://localhost:8082/api/ts/system/status |

Each frontend also proxies those same API paths, e.g. `http://localhost:5173/api/go/system/status` or `http://localhost:4200/api/rust/system/status`.

### Viewing the onboarding page locally

`angular-ui` only renders the onboarding picker (instead of the full demo) when `window.location.hostname` is exactly `iotaterminus.dev` (see `apps/angular-ui/src/app.component.ts`). Since `.dev` is on the browser HSTS preload list, **all** `*.dev` hosts are forced to HTTPS — plain `http://iotaterminus.dev` will fail with `ERR_SSL_PROTOCOL_ERROR` even with a hosts-file entry, so a real (locally-trusted) TLS cert is required. One-time setup, using [`mkcert`](https://github.com/FiloSottile/mkcert):

1. Map the domain to your machine:
   ```bash
   echo "127.0.0.1 iotaterminus.dev" | sudo tee -a /etc/hosts
   ```
2. Install `mkcert` and add its local CA to your browser's trust store (NSS — no root/system trust needed for Chrome/Firefox on Linux):
   ```bash
   brew install mkcert          # or: apt install mkcert / download from GitHub releases
   TRUST_STORES=nss mkcert -install
   ```
3. Generate a cert for the app (from `apps/angular-ui/`):
   ```bash
   mkdir -p apps/angular-ui/.certs && cd apps/angular-ui/.certs
   mkcert iotaterminus.dev localhost 127.0.0.1
   ```
   This produces `iotaterminus.dev+2.pem` / `iotaterminus.dev+2-key.pem`, gitignored since they're machine-specific.
4. Serve over HTTPS with the cert:
   ```bash
   cd apps/angular-ui && npm run dev:onboarding
   ```
   (`allowedHosts` in `apps/angular-ui/angular.json` already permits the `iotaterminus.dev` Host header; regular `npm run dev`/`npm run dev:all` stay plain HTTP and unaffected.)
5. Visit `https://iotaterminus.dev:4200`.

## Deployment

The site runs on a Raspberry Pi 4 behind a Cloudflare Tunnel: `iotaterminus.dev` is a terminal-themed onboarding page (served by `angular-ui`) that links out to `react.iotaterminus.dev` and `angular.iotaterminus.dev`, the two full demo apps. See [`deploy/DEPLOYMENT.md`](deploy/DEPLOYMENT.md) for one-time Pi setup and the update flow.
