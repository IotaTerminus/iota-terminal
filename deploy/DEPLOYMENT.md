# Deploying to the Pi

Images are built by `.github/workflows/docker-publish.yml` (GitHub Actions,
cross-compiled for `linux/arm64`) and pushed to GHCR. Every push/PR first
runs a `smoke-test` job that builds the whole stack for the runner's native
arch, curls each backend/frontend, and tears down — the GHCR
`build-and-push` job only runs after that passes, and only on pushes to
`main`. The Pi never builds anything — it only pulls images and runs them.
Once the one-time setup below is done, shipping an update is just: `git push`
to `main`.

## One-time Pi setup

1. **Install Docker** (with the compose plugin):
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER   # re-login after this
   ```

2. **Make GHCR images pullable.** `docker-publish.yml` pushes five images —
   `ghcr.io/<owner>/iota-terminal-{backend-go,backend-rust,backend-ts,react-ui,angular-ui}`
   — and GHCR defaults new packages to **private**, scoped to your GitHub
   account. `docker compose up -d` on the Pi will fail with
   `unauthorized`/`denied` pulls until one of the two options below is done
   for all five packages.

   - **Option A — make the packages public (simplest, no credentials on the
     Pi):** after the first successful workflow run has created each
     package, go to `https://github.com/users/<owner>/packages/container/iota-terminal-<name>/settings`
     (or from the repo: **Packages** tab in the right sidebar → click the
     package → **Package settings**) → **Danger Zone** → **Change
     visibility** → **Public**. Repeat for each of the five packages. Public
     images can be pulled with no authentication at all.

   - **Option B — keep the packages private and authenticate the Pi:**
     create a fine-grained PAT (or classic PAT) with `read:packages` scope
     at <https://github.com/settings/tokens>, then on the Pi:
     ```bash
     echo '<YOUR_PAT>' | docker login ghcr.io -u <owner> --password-stdin
     ```
     This writes credentials to `~/.docker/config.json` so `docker compose
     pull`/`up` and watchtower's background pulls can authenticate. If the
     PAT is rotated or expires, repeat this login step — pulls will start
     failing silently (watchtower just logs an error and keeps the old
     container running) until then.

   Either way, verify pulling works before moving on:
   ```bash
   docker pull ghcr.io/<owner>/iota-terminal-backend-go:latest
   ```

3. **Create the Cloudflare Tunnel** (from any machine with `cloudflared`
   installed, or via the Zero Trust dashboard):
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create iota-terminal
   ```
   This writes `<TUNNEL_ID>.json` credentials. Copy that file to
   `deploy/cloudflared/` on the Pi.

4. **Add DNS records** pointing each hostname at the tunnel:
   ```bash
   cloudflared tunnel route dns iota-terminal iotaterminus.dev
   cloudflared tunnel route dns iota-terminal angular.iotaterminus.dev
   cloudflared tunnel route dns iota-terminal react.iotaterminus.dev
   ```

5. **Configure ingress.** `deploy/cloudflared/config.yml.example` is a
   template with `${TUNNEL_ID}` placeholders — don't fill it in by hand.
   Instead, put the tunnel ID from step 3 into a `TUNNEL_ID=` entry in the
   repo-root `.env` (gitignored; on the Pi this is populated by the
   1Password "iota-terminal" environment rather than typed in manually —
   `.env.example` documents the expected keys), then render the real config:
   ```bash
   ./deploy/cloudflared/generate-config.sh
   ```
   This writes `deploy/cloudflared/config.yml` (also gitignored, since it
   embeds your tunnel ID). Re-run the script any time `TUNNEL_ID` changes.

6. **Clone the repo on the Pi** (only `deploy/` is actually needed at
   runtime, but cloning the whole repo is simplest):
   ```bash
   git clone git@github.com:IotaTerminus/iota-terminal.git
   cd iota-terminal/deploy
   docker compose up -d
   ```

Check that the tunnel is healthy with `docker compose logs -f cloudflared`,
then confirm `iotaterminus.dev`, `angular.iotaterminus.dev`, and
`react.iotaterminus.dev` all resolve.

## Ongoing updates

Nothing manual. The flow after this point is:

```
git push origin main
  → GitHub Actions builds + pushes new images to GHCR (~2-5 min)
  → watchtower on the Pi notices the new digest within 5 min and
    recreates the affected container(s)
```

`watchtower --cleanup` also prunes the old image layers it replaces, so disk
usage on the Pi's SD card/SSD stays bounded.

To force an immediate pull instead of waiting for watchtower's poll:

```bash
cd iota-terminal/deploy
docker compose pull && docker compose up -d
```

## Adding a new backend/frontend later

1. Add its Dockerfile under `apps/<name>/Dockerfile`.
2. Add a matrix entry to `.github/workflows/docker-publish.yml`.
3. Add the service to `deploy/docker-compose.yml` (with the watchtower
   label) and an ingress rule to `deploy/cloudflared/config.yml`.

## Testing the stack locally before pushing

The same commands the CI `smoke-test` job runs can be run on any machine
with Docker — this builds every image locally (native arch, not arm64) and
publishes ports so you can curl each service directly:

```bash
cd deploy
docker compose -f docker-compose.yml -f docker-compose.ci.yml \
  up --build -d backend-go backend-rust backend-ts react-ui angular-ui

curl http://localhost:8080/api/go/system/status
curl http://localhost:8081/api/rust/system/status
curl http://localhost:8082/api/ts/system/status
curl http://localhost:8090/   # react-ui
curl http://localhost:8091/   # angular-ui

docker compose -f docker-compose.yml -f docker-compose.ci.yml down -v
```

`docker-compose.ci.yml` intentionally omits `cloudflared`/`watchtower` — they
need real tunnel credentials and aren't relevant to a build/route smoke test.
