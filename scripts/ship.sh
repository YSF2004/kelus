#!/usr/bin/env bash
# Ships Kelus to kelus.me from this Mac, without GitHub Actions: the same steps as .github/workflows/deploy.yml.
#
#   scripts/ship.sh            ships the latest main from GitHub (fetched first; local main lives in ~/kelus and lags)
#   scripts/ship.sh <ref>      ships a branch, tag or commit
#
# It builds the ref in a temporary folder, so whatever branch is checked out here (and any unsaved work) is untouched.
#
# Needs, once:
#   1. .env.production.local in the repo root, with the production NEXT_PUBLIC_* values (names in .env.example and
#      NEXT_PUBLIC_AI_ENDPOINT). Without it the site would ship with analytics, sign-in, AI and payments switched off.
#   2. Cloudflare access: run `npx wrangler login` once, or export CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
ref="${1:-origin/main}"
env_file="$repo/.env.production.local"

git -C "$repo" fetch -q origin
[ -f "$env_file" ] || { echo "Missing $env_file (see the header of this script)." >&2; exit 1; }
sha="$(git -C "$repo" rev-parse --verify "$ref^{commit}")"
want="${sha:0:12}"
echo "Shipping $ref ($want): $(git -C "$repo" log -1 --format=%s "$sha")"

work="$(mktemp -d)"
cleanup() { git -C "$repo" worktree remove --force "$work/src" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
git -C "$repo" worktree add --detach "$work/src" "$sha" >/dev/null
cd "$work/src"
cp "$env_file" .env.production.local

npm ci --no-audit --no-fund
npm run lint
npm run typecheck
npm test
# write-version.mjs stamps public/version.json from GITHUB_SHA, so the check below can see this exact commit live.
GITHUB_SHA="$sha" npm run build

npx wrangler@4.92.0 deploy || { echo "Publish failed once; retrying"; sleep 10; npx wrangler@4.92.0 deploy; }

for attempt in $(seq 1 20); do
  live="$(curl -fsS "https://kelus.me/version.json?ts=$(date +%s)" | sed -E 's/.*"id":"([^"]+)".*/\1/' || true)"
  if [ "$live" = "$want" ]; then echo "kelus.me is on $live"; exit 0; fi
  echo "kelus.me is on ${live:-?}, waiting for $want ($attempt/20)"
  sleep 15
done
echo "kelus.me did not switch to $want" >&2
exit 1
