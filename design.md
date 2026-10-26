# Kelus design system — exam booklet

Kelus is paper, ink, and one pass-mark green. Marketing and product share the same booklet language.

## Foundation

- Canvas: white paper (`#fff`). In the product, split by hairline rules; no tinted or cream bands. The marketing pages use tiles instead (see Marketing tiles).
- Ink: deep booklet ink (`#12160f`).
- Accent: one Kelus green (`#1f6b45`) for actions, focus, and route signals. No indigo. No Notion blue.
- The homepage and core product share a restrained learning vocabulary: muted orange identifies source material and application, muted purple identifies recall, and green identifies the route, feedback, and primary action. The "lines you can recall" count is ink with a green +1 (a right answer) or a coral −1 (a line lost), because it reports feedback, not a recall step. Use color for meaning, not decorative fill.
- Secondary text: mute green-gray (`#4a5246` / `#5a6358`) for body support and captions — both ≥4.5:1 on paper.
- Typography, everywhere (marketing and product): Literata (optical sizes) for headings, page titles and large figures; Inter for all text and UI (variable `--font-inter`; since 2026-10-20, replacing Atkinson Hyperlegible Next). Prices, results, percentages and every topic name use Literata.
- Geometry: 8px corners for buttons, cards, inputs, line cards and tiles, everywhere; pills only for small status badges ("Passed", "Suggested") and topic chips. Avoid SaaS twin cards, blue glows, soft multi-shadow stacks, and ALL CAPS kickers.
- Rhythm: 8px spacing base, hairline booklet rules (`#d5d9d0`), transform/opacity motion only.
- Tokens live in `tokens.css`. Prefer those variables over hard-coded hex in product UI.

## Interaction

### Marketing typography exception

`/`, `/route/`, `/pricing/` and `/pdf-to-practice-questions/` use the same pair as the product. Major headings use
`--font-marketing-heading` (Literata, optical sizing, tracking -0.02em); body, nav,
buttons and footer use `--font-marketing-sans` (Inter). Both are
self-hosted by next/font with swap.

- Primary actions are Kelus green fills with white labels.
- One button shape on every surface: the 8px-corner green fill. Public pages set it 48px tall; in the product it is compact on a mouse and 44px on touch.
- Secondary actions are text buttons with instant press scale (`0.97`). On marketing pages a secondary action beside the primary one may be a soft button: 48px, 8px corners, `#f5f5f5` with a `#e5e5e5` hairline.
- Links use Kelus green and a restrained directional arrow.
- Touch targets: minimum 44×44px for header, nav, auth, and footer controls.
- Motion: bounce `0`, ease `[0.22, 1, 0.36, 1]`, 80–400ms. Respect reduced-motion preferences.

## Marketing tiles (since 2026-10-28)

The homepage takes link.com's structure and keeps Kelus's face (Literata titles, Inter text, Kelus green).

- Layout: every block is a tile inside a 64px page margin (16px on a phone), 16px apart (12px on a phone). The header is a tile too: solid white, `#e5e5e5` hairline, 8px corners, never translucent.
- Tiles: white with a `#e5e5e5` hairline, or a soft grey stage (`#f4f4f4`) with no border. A product fragment sits on a grey stage as a white surface with no border and no shadow: two levels at most, never a card inside a card.
- One dark band per page (`#0c2016`) for the main claim, with one bright-green phrase (`#5fd394`) and a bright-green action. It shows real product output, never decorative chips.
- Tile titles: Literata, 26–28px, weight 500. Grey text under a title: one sentence, 17px.
- Motion: a demonstration plays once in under 5 seconds, holds its finished state, and offers "Play it again"; nothing loops.

## Product constraints

- First-run Materials/Map gates preview the feature; they do not dump students into blank dead-ends.
- First use is source-first: add a real course PDF → set the exam → review proposed topics beside the PDF → short diagnosis → today's study plan. The original PDF remains the source of truth; bookmarks do not silently become concepts.
- Pricing shows Free and Kelus Plus side by side on desktop, stacked on mobile. Plus is a $4.99 monthly subscription; annual and per-exam plans are not offered.
- After a course is ready, the course workspace uses the same light paper-and-ink system as the marketing site: a quiet compact rail, a single course context line, and Study plan / Materials / Topics. The study plan leads with one recommendation and its evidence; next topics remain secondary. First-run setup shares this shell. Focused sessions retain distraction-free reading, but must show the same course context, learning-step sequence, and source/recall/route colors rather than reverting to a separate faux notebook.
- The topic map shows relationships when confirmed; the ranked list remains the selectable surface.
- Homepage header does not duplicate the hero sample CTA.
