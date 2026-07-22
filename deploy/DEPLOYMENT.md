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
   curl -fsSL [https://get.docker.com](https://get.docker.com) | sh
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

3. **Create the Cloudflare Zero Trust Tunnel.** Routing is managed entirely in the cloud — no local config files are needed.
   - Go to the Cloudflare Zero Trust Dashboard -> **Networks** -> **Tunnels**.
   - Click **Create a tunnel** (Select Cloudflared)
   - Name it `iota-tunnel`
   - under the installation instructions, copy the long string following `--token`

4. **Clone and configure the environment:**

   ```bash
   git clone git@github.com:IotaTerminus/iota-terminal.git
   cd iota-terminal/deploy

   # Create the environment file with the token you copied in Step 3, plus
   # the Twilio credentials used by /api/<backend>/contact to text a
   # personal number on form submission (see deploy/.env.example)
   cat > .env <<'EOF'
   TUNNEL_TOKEN=your_token_here
   TWILIO_ACCOUNT_SID=your_account_sid
   TWILIO_AUTH_TOKEN=your_auth_token
   TWILIO_FROM_NUMBER=your_twilio_number
   TWILIO_TO_NUMBER=your_personal_number
   EOF
   ```

   _note:_ `.env` is populated via `1Password environments` to make cred rotation painless.

   Docker Compose reads these values when the containers are created, so if
   you add or change keys here later, recreate the affected services with
   `docker compose up -d --force-recreate` after updating the file.

5. **Start the stack:**

   ```bash
   docker compose up -d
   ```

   check that the tunnel connected successfully with `docker compose logs -f cloudflared`

6. **Configure Ingress Routes** Back in the Cloudflare Zero Trust dashboard, go to your tunnel's **Published application routes** (formerlly Public Hostnames) tab and add your routes. Cloudflare automatically provisions DNS CNAME records when you save these routes.
   - e.g., `react.iotaterminus.dev` -> `HTTP` -> `react-ui:80`
   - e.g., `iotaterminus.dev/api/go` -> `HTTP` -> `backend-go:8080`

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
3. Add the service to `deploy/docker-compose.yml` (ensuring you include the `com.centurylinklabs.watchtower.enable=true` label).

## Testing the stack locally before pushing

`deploy/smoke-test.sh` wraps the same steps the CI `smoke-test` job runs
(build every image for the host's native arch, boot the stack, curl each
service, tear down) so it can be run identically from CI, a pre-push git
hook, or by hand:

```bash
npm run smoke-test
# or directly:
deploy/smoke-test.sh
```

A `.husky/pre-push` hook runs this automatically before every `git push`
(skips gracefully if Docker isn't installed). To skip it for a single push
(e.g. no Docker available, or you've already verified the stack manually),
set `SKIP_SMOKE_TEST=1 git push`.

The script builds every image locally (native arch, not arm64), publishes
ports so you can curl each service directly, and always tears the stack down
afterward (`docker compose down -v`) even on failure. It also fails fast with
a clear error if a native (non-Docker) dev process is already bound to one of
the ports it needs (8080-8082, 8090-8091) — e.g. from `npm run dev:all`.

`docker-compose.ci.yml` intentionally omits `cloudflared`/`watchtower` — they
need real tunnel credentials and aren't relevant to a build/route smoke test.

To also exercise `/contact` (Twilio SMS), set the four `TWILIO_*` vars in
`deploy/.env` before bringing the stack up — otherwise the endpoint responds
but logs a warning and skips sending. If you add those values after the
containers are already running, recreate the affected containers so they can
read the new env vars.
