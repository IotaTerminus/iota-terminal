#!/usr/bin/env bash
# Local equivalent of the "smoke-test" job in
# .github/workflows/docker-publish.yml: builds every app image for the
# host's native arch, boots the whole stack (minus cloudflared/watchtower,
# which need real tunnel credentials), hits every service, then tears
# everything down. Keeping this in one script means CI and the pre-push
# hook (.husky/pre-push) can never drift.
#
# Usage: deploy/smoke-test.sh
# Requires: Docker with Compose v2 (`docker compose ...`).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

COMPOSE="docker compose -f docker-compose.yml -f docker-compose.ci.yml"

cleanup() {
  local exit_code=$?
  if [ "$exit_code" -ne 0 ]; then
    echo "==> Smoke test failed, dumping logs" >&2
    $COMPOSE logs || true
  fi
  echo "==> Tearing down smoke-test stack"
  $COMPOSE down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Fail fast with a clear message instead of Docker's opaque "address already
# in use" error if a native (non-Docker) dev backend is already bound to one
# of the ports this stack needs (e.g. from `npm run dev:all`, `go run`,
# `cargo run`, or a leftover `npm run dev` for react-ui/angular-ui).
check_port_free() {
  local port="$1"
  if command -v ss >/dev/null 2>&1 && ss -tln 2>/dev/null | grep -q ":${port} "; then
    echo "error: port $port is already in use on the host." >&2
    echo "Stop whatever's using it (native dev backends/frontends?) and try again." >&2
    exit 1
  fi
}
for port in 8080 8081 8082 8090 8091; do
  check_port_free "$port"
done

echo "==> Building and starting stack"
$COMPOSE up --build -d backend-go backend-rust backend-ts react-ui angular-ui

echo "==> Waiting for services"
for target in \
  "http://localhost:8080/api/go/system/status" \
  "http://localhost:8081/api/rust/system/status" \
  "http://localhost:8082/api/ts/system/status" \
  "http://localhost:8090/" \
  "http://localhost:8091/"; do
  echo "waiting for $target"
  if ! timeout 60 sh -c "until curl -sf '$target' > /dev/null; do sleep 2; done"; then
    echo "error: $target never became healthy" >&2
    $COMPOSE logs
    exit 1
  fi
done

echo "==> Verifying backend responses"
curl -sf http://localhost:8080/api/go/system/status | grep -q '"backend":"go"'
curl -sf http://localhost:8081/api/rust/system/status | grep -q '"backend":"rust"'
curl -sf http://localhost:8082/api/ts/system/status | grep -q '"backend":"ts"'
curl -sf http://localhost:8090/ | grep -qi '<html'
curl -sf http://localhost:8091/ | grep -qi '<html'

echo "==> Smoke test passed"
