# Kelus design system — exam booklet

Kelus is paper, ink, and one pass-mark green. Marketing and product share the same booklet language.

## Foundation

- Canvas: cool green-cast paper (`#eef1ec`), not cream and not pure white chrome.
- Ink: deep booklet ink (`#12160f`).
- Accent: one Kelus green (`#1f6b45`) for actions, focus, and route signals. No indigo. No Notion blue.
- The homepage and core product share a restrained learning vocabulary: muted orange identifies source material and application, muted purple identifies recall, and green identifies the route, feedback, and primary action. Use color for meaning, not decorative fill.
- Secondary text: mute green-gray (`#4a5246` / `#5a6358`) for body support and captions — both ≥4.5:1 on paper.
- Typography, everywhere (marketing and product): Literata (optical sizes) for headings, page titles and large figures; Atkinson Hyperlegible Next for all text and UI (variable `--font-inter`, a legacy name). The zero alone comes from Public Sans (self-hosted, unicode-range U+0030) so it is plain, not slashed; prices, results and percentages use Literata.
- Geometry: ~4px radii. Avoid SaaS twin cards, blue glows, soft multi-shadow stacks, and ALL CAPS kickers.
- Rhythm: 8px spacing base, hairline booklet rules (`#d5d9d0`), transform/opacity motion only.
- Tokens live in `tokens.css`. Prefer those variables over hard-coded hex in product UI.

## Interaction

### Marketing typography exception

`/`, `/route/` and `/pricing/` use the same pair as the product. Major headings use
`--font-marketing-heading` (Literata, optical sizing, tracking -0.02em); body, nav,
buttons and footer use `--font-marketing-sans` (Atkinson Hyperlegible Next). Both are
self-hosted by next/font with swap.

- Primary actions are Kelus green fills with white labels.
- The homepage hero's single primary action may use a soft capsule with immediate press feedback; product controls keep the booklet's compact geometry.
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
