# Kelus agent defaults

## UI and UX

Primary skills for this project:

1. `apple-design` — `.cursor/skills/apple-design/SKILL.md`
2. `framer-motion-ui` — `.cursor/skills/framer-motion-ui/SKILL.md`

Load both before changing interface, motion, or copy on a screen. They are the default pair for small UI/UX work.

Do not use `shadcn` as the homepage or product visual system. Use it only when the task is explicitly about shadcn/ui, the registry, or `components.json`.

Do not rebuild or remove the student hero, route story, or workbench unless the user asks to.

## Current state (for every agent: Claude, Codex, Cursor)

Updated 2026-10-29. Read this before starting; it is how the project works now.

### Working and shipping
- Code lives on GitHub `YSF2004/kelus`. Work on a branch and open a PR to `main`; the founder merges ("merge #N").
- GitHub Actions do not start (account billing), so `verify` shows red without running. Check locally:
  `npm test`, `npx tsc --noEmit`, `npm run lint`, and the e2e specs you touched.
- Shipping is from the Mac, not GitHub: `scripts/ship.sh` builds `origin/main`, tests it, publishes to Cloudflare
  and waits for `kelus.me/version.json`. It needs `.env.production.local` (gitignored) and `npx wrangler login` once.
- e2e against a static build: the server must send `.mjs` as `text/javascript` (the PDF worker), or every PDF read
  fails and import tests look broken when they are not.

### Design
- `DESIGN.md` is the source of truth. Literata for titles, topic names and large figures; Inter for text; Kelus green
  (`#1f6b45`). The homepage uses "Marketing tiles" (link.com's structure, Kelus's face): bordered 8px tiles in a 64px
  margin, grey stages for product fragments, one dark band with real output. Two levels at most, never a card in a card.
- Illustrations only from the founder's Notion-style pack (`public/art/notion-pack`, `components/PackArt.tsx`). Small
  UI icons are Octicons (`components/Octicon.tsx`). No stock art, no generated images.
- Every claim on a page must be true of Kelus today (see `PRODUCT.md`). The homepage band shows real topics the reader
  finds in openly licensed files (MIT OpenCourseWare, LibreTexts), credited in text with their licences.

### Motion
- Skill: `.claude/skills/design-motion-principles`. Last audit: `docs/motion-audit-2026-10-29.html`.
- Rules: a demonstration plays once in under 5 s, holds its end state and offers a replay (nothing loops); titles and
  body text do not animate; no stagger on lists except where order is the message; one curve,
  `cubic-bezier(0.22, 1, 0.36, 1)`; presses scale to 0.97; every motion has a `prefers-reduced-motion` end state.
- Marketing entrances: `.k-rise` + `rise()` for the top of a page (CSS, plays on a fresh load), `useReveal` for
  sections below the fold (`components/motion/entrance.tsx`).

### Open questions
- On `main`, a first PDF now lands on Today instead of opening the first question; 8 import/first-use e2e specs
  expect the question. Decide which is intended before changing either.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
