---
name: Kelus
description: Source-grounded exam revision in paper, ink, and one pass-mark green.
colors:
  kelus-green: "#1f6b45"
  kelus-green-hover: "#185536"
  booklet-ink: "#12160f"
  muted-ink: "#4a5246"
  paper: "#eef1ec"
  surface: "#f7f8f5"
  white: "#ffffff"
  rule: "#d5d9d0"
  source-orange: "#a5521f"
  recall-purple: "#7859a0"
  correction-coral: "oklch(0.7 0.15 30)"
typography:
  display:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(3.5rem, 7vw, 5.75rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Literata, Georgia, serif"
    fontSize: "clamp(2rem, 4.3vw, 4.5rem)"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Inter, Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  marketing: "8px"
  product: "12px"
  card: "14px"
spacing:
  8: "8px"
  16: "16px"
  24: "24px"
  32: "32px"
  48: "48px"
  64: "64px"
components:
  button-primary:
    backgroundColor: "{colors.kelus-green}"
    textColor: "{colors.white}"
    rounded: "{rounded.marketing}"
    height: "48px"
    padding: "0 22px"
  button-primary-hover:
    backgroundColor: "{colors.kelus-green-hover}"
    textColor: "{colors.white}"
    rounded: "32px"
  button-secondary:
    backgroundColor: "#f5f5f5"
    textColor: "{colors.booklet-ink}"
    rounded: "{rounded.marketing}"
    height: "48px"
    padding: "0 22px"
  product-card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "20px 22px"
---

# Design System: Kelus

## Overview

**Creative North Star: "The Evidence Ledger"**

Kelus should feel like a precise study notebook that can answer for itself. It is editorial rather than decorative: calm paper, deep ink, visible source evidence, and a single green signal when the learner has a clear next move. Marketing makes the promise tangible with real product fragments; the product makes each decision traceable to a student’s own notes.

The system earns confidence through restraint. Structure comes from alignment, whitespace, and hairline rules—not a stack of containers. Color explains meaning: orange for a source, purple for recall, green for a route or an action. A student should never need to decode a new visual language between the public site and the study workspace.

**Key Characteristics:**

- Editorial type paired with fast, legible interface text.
- Paper-and-ink surfaces with one deliberate green action per decision.
- Real source evidence and product output instead of decorative mock-ups.
- Motion that confirms a change, then gets out of the way.

## Colors

The palette is quiet by default; color carries study meaning or a decisive action.

### Primary

- **Pass-Mark Green:** primary action, focus, route changes, and confirmed feedback. It should be the clearest color on a screen, not its background theme.
- **Deep Green:** the hover state for a primary action, never an unrelated second accent.

### Secondary

- **Source Orange:** identifies original course material and application moments. It is explanatory, never a primary button color.
- **Recall Purple:** identifies recall states only. It does not replace green for actions or navigation.
- **Correction Coral:** marks a specific mismatch or lost line, never generic danger.

### Neutral

- **Booklet Ink:** titles, figures, and high-priority reading.
- **Muted Ink:** body support, metadata, and captions while remaining readable on paper.
- **Paper and Surface:** the page background and quiet wells. White is reserved for a true sheet, input, or source page.
- **Rule:** the hairline that separates reading groups without creating a card wall.

**The One Signal Rule.** Use green for the current action or current route. If every surface becomes green, the learner loses the one thing to do next.

## Typography

**Display Font:** Literata, with Georgia as fallback.

**Body Font:** Inter, with Arial and system sans fallbacks.

**Character:** Literata gives lessons, topics, and large results the gravity of a study book. Inter keeps navigation, controls, instructions, and dense source details quick to scan.

### Hierarchy

- **Display:** used for public-page headlines and major learning moments; balanced, never uppercase.
- **Headline:** used for page titles and section claims; concise and close-tracked.
- **Title:** Inter at 17px/600 for controls and product-card headings.
- **Body:** Inter at 16px with a 1.55 line-height; keep explanatory paragraphs readable rather than wide.
- **Label:** Inter at 12px/700 with measured tracking; reserved for compact context above an action or source.

**The Reading-First Rule.** Use the serif only when a student is reading a lesson, a topic, or a meaningful outcome. Keep operational UI in Inter.

## Layout

The base rhythm is 8px. Marketing pages use a 64px outer margin and 16px gaps on desktop, reducing to 16px and 12px on phones. Public tiles have an 8px corner and a single hairline; a product fragment may sit on a soft-grey stage, but never inside a second decorated card.

Product screens are denser: lead with one decision, then place related information in rows separated by hairlines. A single raised card may identify the topic due now; all other information stays flat or uses a quiet well. Below 760px, marketing plans stack; below 640px, product cards reduce padding and primary session actions use the available thumb width.

## Elevation & Depth

Kelus is flat by default. Depth comes from paper contrast, a hairline, and spatial separation. Shadows are absent from ordinary cards and buttons. The sole product elevation is the current recommended topic, using a quiet shadow (`0 14px 36px -22px rgba(14, 21, 18, 0.32)`) to identify priority—not to make the interface feel glossy.

**The Flat-By-Default Rule.** Never add a shadow merely to make a component look clickable. Use a fill, border, and interaction state instead.

## Shapes

Marketing actions and tiles are gently square at rest (8px). Public buttons may round to 32px under a fine pointer as a small acknowledgement of intent. Product controls remain stable at 12px, and product cards at 14px; their corners do not animate. Pills are limited to compact statuses and topic chips. Full-width panels, nested rounded cards, and arbitrary decorative circles are not part of the system.

## Components

### Buttons

- **Primary:** green fill, white label, 48px high on public pages and critical product actions.
- **Marketing state:** flat at rest; on a fine pointer, darkens and rounds from 8px to 32px over 200ms. Press scales to 0.97.
- **Product state:** stable 12px corner; darkens or warms its border on hover, presses to 0.97, and shows a 2px green focus ring offset by 3px.
- **Secondary:** paper fill and hairline border. Use it for an alternative path, not another competing conversion.

### Cards / Containers

- **Standard card:** one white sheet, one hairline, 14px corner, 20px × 22px padding, no shadow.
- **Raised card:** reserved for the topic a student should do now.
- **Quiet card:** a muted well without a border for secondary context such as tomorrow’s work.

### Inputs / Uploads

- **Fields:** paper or white, hairline-bordered, with a green 2px focus ring.
- **Upload:** a large but calm source-first area with a dashed green-tinted boundary. It must say what will happen next and keep the selected filename visible through import.

### Navigation

- **Header:** light paper, black K mark, compact Inter navigation, and 44px minimum touch targets.
- **Product rail:** names the course context and keeps Study plan, Materials, and Topics as distinct jobs rather than visual duplicates.

### Source Evidence

- **Source line:** orange marks the teaching line; the page or section locator stays visible.
- **Recall comparison:** purple denotes recall context; green confirms a supported answer; coral names the exact wrong direction or missing detail.
- **Plan row:** green explains what moved and why; it never promises a grade.

## Do's and Don'ts

### Do:

- **Do** show the original line, page, or section beside an answer whenever Kelus makes a judgment.
- **Do** let whitespace and hairlines create order before reaching for a container.
- **Do** keep one primary action per decision and make its wording say what happens next.
- **Do** make motion explain a result, finish within 80–400ms, and honor reduced-motion preferences.
- **Do** use the Notion-style illustration pack only as a human counterweight to real product evidence.

### Don't:

- **Don't** use generic SaaS cards, blue glows, stock art, or generated illustrations.
- **Don't** use a decorative color as a button fill or mix source, recall, and route colors without their study meaning.
- **Don't** add a card inside a card, a shadow stack, or a second primary action merely to fill space.
- **Don't** animate headings or body copy, loop demonstrations, or make product controls bounce.
- **Don't** use the marketing serif for dense practice controls or call a topic a concept, section, or idea.
