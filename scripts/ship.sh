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

# Fail before publishing if authentication would be compiled with absent or malformed settings.
# Node loads the file directly; no credential values are printed.
node --env-file=.env.production.local scripts/check-production-config.mjs

node scripts/install-ci.mjs
npm run lint
npm run typecheck
npm test
# write-version.mjs stamps public/version.json from GITHUB_SHA, so the check below can see this exact commit live.
GITHUB_SHA="$sha" npm run build

npx wrangler@4.92.0 deploy || { echo "Publish failed once; retrying"; sleep 10; npx wrangler@4.92.0 deploy; }

# Once the new version is live, every address in its sitemap goes to IndexNow (Bing, Yandex, Seznam, Naver; Bing also
# feeds ChatGPT search and DuckDuckGo), so new and changed pages are crawled within days. The key file at
# kelus.me/<key>.txt proves the ping comes from the site. Google does not take pings: Search Console does that.
# A failed ping never fails the ship.
indexnow_key="d74cbf9c565014c75f589dc662f4d3f6"
ping_indexnow() {
  local urls
  urls="$(curl -fsS "https://kelus.me/sitemap.xml?ts=$(date +%s)" | grep -oE '<loc>[^<]+</loc>' | sed -E 's#</?loc>##g' | sed -E 's/.*/"&"/' | paste -sd, - || true)"
  if [ -z "$urls" ]; then echo "IndexNow: no sitemap addresses found, skipped"; return 0; fi
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" \
    --data "{\"host\":\"kelus.me\",\"key\":\"$indexnow_key\",\"keyLocation\":\"https://kelus.me/$indexnow_key.txt\",\"urlList\":[$urls]}" || echo "failed")"
  echo "IndexNow: sent $(echo "$urls" | tr ',' '\n' | wc -l | tr -d ' ') addresses, answer $status (200 or 202 means accepted)"
}

node scripts/verify-release.mjs --commit "$sha" --attempts 20
ping_indexnow
