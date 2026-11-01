# Kelus agent defaults

## UI and UX

Primary skills for this project:

1. `apple-design` — `.cursor/skills/apple-design/SKILL.md`
2. `framer-motion-ui` — `.cursor/skills/framer-motion-ui/SKILL.md`

Load both before changing interface, motion, or copy on a screen. They are the default pair for small UI/UX work.

Do not use `shadcn` as the homepage or product visual system. Use it only when the task is explicitly about shadcn/ui, the registry, or `components.json`.

Do not rebuild or remove the student hero, route story, or workbench unless the user asks to.

## Current state (for every agent: Claude, Codex, Cursor)

Updated 2026-10-30. Read this before starting; it is how the project works now.

### Working and shipping
- Build and verify product changes locally. Shipping is off by default: do not push, open a PR, merge, or deploy unless
  the founder explicitly asks to ship.
- GitHub Actions do not start (account billing), so `verify` shows red without running. Check locally:
  `npm test`, `npx tsc --noEmit`, `npm run lint`, and the e2e specs you touched.
- Shipping is from the Mac, not GitHub: `scripts/ship.sh` builds `origin/main`, tests it, publishes to Cloudflare,
  waits for `kelus.me/version.json`, then sends the sitemap to IndexNow (Bing, Yandex, Seznam, Naver). It needs
  `.env.production.local` (gitignored) and `npx wrangler login` once. Agents cannot run it; the founder does.
- e2e against a static build: the server must send `.mjs` as `text/javascript` (the PDF worker), or every PDF read
  fails and import tests look broken when they are not.
- The design doc is tracked as lowercase `design.md`. On the Mac, `git add DESIGN.md` silently stages nothing.

### Data before choosing work
- GA4 property 552102600. On 2026-10-30, 96% of 30-day visitors were the team (direct, Morocco); about 20 outside
  visitors, none of whom opened the app. Arrival is the bottleneck, not polish.
- `kelus.me/?internal=1` keeps a device out of analytics (Google's ga-disable switch); `?internal=0` undoes it.
- Google Search Console is not connected yet (needs the founder); the sitemap is at `kelus.me/sitemap.xml`.

### Search pages (how students arrive)
- Eight pages, listed once in `lib/search-pages.ts` (footer row + "More ways to study your notes") and in
  `app/sitemap.ts`: pdf-to-flashcards, pdf-to-anki, lecture-slides-to-flashcards, pdf-to-practice-questions,
  quiz-me-on-my-notes, notes-to-flashcards, quizlet-alternative, anki-alternative.
- Build them on `components/seo/SearchLanding.tsx`. The example is always real Kelus output from an openly licensed
  or test file, credited, never a mock-up. "X alternative" pages use the `compare` block: rows dated with where to
  check, plus when the other app is the better choice. Every claim must be true of kelus.me today.
- Next, from the US keyword research: powerpoint-to-flashcards, turn-notes-into-quiz, make-practice-test-from-notes,
  knowt-alternative, spaced-repetition-app, active-recall-app. English only for now (target: US students).

### Design
- `design.md` is the source of truth. Literata for titles, topic names and large figures; Inter for text; Kelus green
  (`#1f6b45`). The homepage uses "Marketing tiles" (link.com's structure, Kelus's face): bordered 8px tiles in a 64px
  margin, grey stages for product fragments, one dark band with real output. Two levels at most, never a card in a card.
- Buttons, the Link way: flat, 10px corners, no shadow; under a pointer the corners round to 32px and the fill steps
  one shade darker (200 ms). One rule at the end of `app/quiet.css`; add new buttons to its selector list.
- The app: the Study plan leads with one raised card (the topic due now, a line from the student's notes); the five
  boxes are piles of index cards (`components/LeitnerPanel.tsx`) on a flat grey stage.
- Illustrations only from the founder's Notion-style pack (`public/art/notion-pack`, `components/PackArt.tsx`). Small
  UI icons are Octicons (`components/Octicon.tsx`). No stock art, no generated images.

### Motion
- Skill: `.claude/skills/design-motion-principles`. Last audit: `docs/motion-audit-2026-10-29.html`.
- Rules: a demonstration plays once in under 5 s and holds its end state (no replay control, no loops); titles and
  body text do not animate; one curve, `cubic-bezier(0.22, 1, 0.36, 1)`; presses scale to 0.97; every motion has a
  `prefers-reduced-motion` end state. On a phone, a session's answers sit at thumb height and its verdict sheet
  swipes left to the next check.

### Known test debt
- e2e failing on main as well (not caused by recent work): analytics-funnel:5, feel:37, feel:81, feel:94,
  notes-import (undo after removing a topic), ux-corrections:33; first-use:241 and nudges:37 are flaky. The undo and
  "execution context destroyed" failures share a reload after Materials. PR #440 (static server serves .txt as
  text/plain, fixes first-use:241) is open for the founder.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
