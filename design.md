# Kelus design system — exam booklet

Kelus is paper, ink, and one pass-mark green. Marketing and product share the same booklet language.

## Foundation

- Canvas: white paper (`#fff`) split by hairline rules, on the homepage and in the product alike; no tinted or cream bands.
- Ink: deep booklet ink (`#12160f`).
- Accent: one Kelus green (`#1f6b45`) for actions, focus, and route signals. No indigo. No Notion blue.
- The homepage and core product share a restrained learning vocabulary: muted orange identifies source material and application, muted purple identifies recall, and green identifies the route, feedback, and primary action. The "lines you can recall" count is ink with a green +1 (a right answer) or a coral −1 (a line lost), because it reports feedback, not a recall step. Use color for meaning, not decorative fill.
- Secondary text: mute green-gray (`#4a5246` / `#5a6358`) for body support and captions — both ≥4.5:1 on paper.
- Typography: on the marketing pages, Literata for headings and Inter for text. **In the product, Inter only**, titles included (since 2026-10-21); the heading font variables resolve to Inter inside product bodies (`app/quiet.css`, "Minimal: one typeface").
- Geometry: 8px corners for buttons, cards, inputs and line cards, everywhere; pills only for small status badges ("Passed", "Suggested"). Avoid SaaS twin cards, blue glows, soft multi-shadow stacks, and ALL CAPS kickers.
- Rhythm: 8px spacing base, hairline booklet rules (`#d5d9d0`), transform/opacity motion only.
- Tokens live in `tokens.css`. Prefer those variables over hard-coded hex in product UI.

## Product (since 2026-10-21): minimal, dashboard structure

Replaces the "editorial notebook" (warm paper, serif titles, ruled sheets, pencil marks), which read as the generated
default. References measured live: stripe.com, docs.stripe.com, and Figma's Simple Design System (`figma/sds`).

- Surface: white page (`#fff`), sidebar `#f8f9f8`, hairlines `#e9ebea` / `#dadedc`; night is neutral graphite (`#121413`).
- Ink: one green-black (`#17201b`) in three steps (`#59625d`, `#7d8681`). Accent: Kelus green only, for actions,
  current selection and correct answers. Coral for wrong, marigold for "comes back". Topic colours only as small dots.
- Type: Inter, titles 600 at -0.022em (page titles 1.75rem), body 15px, labels 13px sentence case. No small caps, no
  ALL-CAPS kickers, no eyebrows above headings, no italics for asides.
- Structure: each section's title sits at the content's left edge with its action on the right; content at one 60rem
  measure beside the sidebar. Lists are tables (column names over hairline rows), e.g. Topics, Materials.
- Signature: progress as cells that fill from the left in the topic's colour (session steps, Progress lines).
- Callouts: a wash and a hairline of the state's colour with 10px corners; never a coloured `border-left` above 1px.
- Removed for good: textures, desk/sheet shadows, decorative numbers, middle-dot meta strings, spaced em dashes,
  dotted leaders, arrows after button labels, hand-drawn marks.

## Interaction

### Marketing typography exception

`/`, `/route/` and `/pricing/` use the same pair as the product. Major headings use
`--font-marketing-heading` (Literata, optical sizing, tracking -0.02em); body, nav,
buttons and footer use `--font-marketing-sans` (Inter). Both are
self-hosted by next/font with swap.

- Primary actions are Kelus green fills with white labels.
- One button shape on every surface: the 8px-corner green fill. Public pages set it 48px tall; in the product it is compact on a mouse and 44px on touch.
- Secondary actions are text buttons with instant press scale (`0.97`).
- Links use Kelus green and a restrained directional arrow.
- Touch targets: minimum 44×44px for header, nav, auth, and footer controls.
- Motion: bounce `0`, ease `[0.22, 1, 0.36, 1]`, 80–400ms. Respect reduced-motion preferences.

## Product constraints

- First-run Materials/Map gates preview the feature; they do not dump students into blank dead-ends.
- First use is source-first: add a real course PDF → set the exam → review proposed topics beside the PDF → short diagnosis → today's study plan. The original PDF remains the source of truth; bookmarks do not silently become concepts.
- Pricing shows Free and Kelus Plus side by side on desktop, stacked on mobile. Plus is a $4.99 monthly subscription; annual and per-exam plans are not offered.
- After a course is ready, the course workspace uses the same light paper-and-ink system as the marketing site: a quiet compact rail, a single course context line, and Study plan / Materials / Topics. The study plan leads with one recommendation and its evidence; next topics remain secondary. First-run setup shares this shell. Focused sessions retain distraction-free reading, but must show the same course context, learning-step sequence, and source/recall/route colors rather than reverting to a separate faux notebook.
- The topic map shows relationships when confirmed; the ranked list remains the selectable surface.
- Homepage header does not duplicate the hero sample CTA.
