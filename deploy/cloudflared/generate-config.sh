#!/usr/bin/env bash
# Renders config.yml from config.yml.example using TUNNEL_ID from the
# repo-root .env file. Re-run this any time TUNNEL_ID changes (e.g. after
# 1Password pushes a new value into .env) — config.yml itself is gitignored
# and safe to regenerate/overwrite.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
env_file="$repo_root/.env"

if [ ! -f "$env_file" ]; then
  echo "error: $env_file not found — create it with TUNNEL_ID=<your-tunnel-id>" >&2
  exit 1
fi

set -o allexport
# shellcheck source=/dev/null
source "$env_file"
set +o allexport

if [ -z "${TUNNEL_ID:-}" ]; then
  echo "error: TUNNEL_ID is not set in $env_file" >&2
  exit 1
fi

if ! command -v envsubst >/dev/null 2>&1; then
  echo "error: envsubst not found (install gettext-base / gettext)" >&2
  exit 1
fi

envsubst '${TUNNEL_ID}' \
  < "$script_dir/config.yml.example" \
  > "$script_dir/config.yml"

echo "Wrote $script_dir/config.yml (tunnel: $TUNNEL_ID)"
