# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students revising for exams, university and high school equally (confirmed: no primary audience). A student brings the
material they were actually taught (lecture PDFs, slides, a textbook chapter, a revision sheet, Notion or Markdown
notes, pasted text) and wants to know what they can recall and what to revise next, usually in the weeks before an
exam, often on a phone. Notes may be in English or French.

## Product Purpose

Kelus turns a student's own notes into short recall sessions and a study plan that changes with every answer. Success
is a student who finishes a first session, comes back within a week, and revises from the plan instead of rereading.

## Positioning

*Inferred from the product, not confirmed by the founder:* every question is written from a line in the student's own
notes and quotes it back; each answer (checks right and key ideas used, never self-rating alone) reorders what comes
next, with the reason stated in the student's own results. Local-first and free, with no AI cost and no chatbot.

## Operating Context

- First use: drop a file or paste notes → Kelus reads it in the browser → "Let's start with <topic>" → three quick
  checks from the notes → one explanation in the student's words, compared with the page → result → next topic.
- Return visit: missed lines come back first as a one-minute warm-up, then the next topic.
- Sections: Study plan, Materials, Topics, Progress. Questions can be exported to Anki.
- Marketing surfaces: homepage `/`, How it works `/route/`, pricing `/pricing/`, and PDF practice `/pdf-to-practice-questions/`.

## Capabilities and Constraints

- Reading and topic finding run in the browser; scans use on-device OCR. Files stay on the device unless the student
  chooses to sync. If a hosted question-writing model is available, text from studied topics can be sent one topic at
  a time to the model by default; students can turn this off in Course options.
- Kelus Plus ($4.99/month) is planned, not built, with no launch date; Free is everything in Kelus today.
- Results come from evidence (checks right, key ideas used); a self-rating can lower a result, never raise it.
- Questions are worded in English even for French notes (a known limitation).
- Analytics: GA4 with ads signals off; pilot links `?pilot=<group>`; class invites tag a random class code.

## Brand Commitments

- Name and wordmark: "kelus", lowercase, with the K mark (`components/KelusLogoMark.tsx`).
- Every illustration comes from the founder's Figma file (Overflow Design Notion-style pack,
  https://www.figma.com/design/az5PD5vLx4tXvsjsF7XeYM); licence in `public/art/notion-pack/SOURCE.md`. Product
  explainers may use real product fragments instead.
- Voice: plain, specific, human; name the student's own topics and results back to them; no hype.

## Evidence on Hand

- Tested course layouts: `tests/fixtures/course-pdfs/` (slides, numbered textbook chapter, two-column handout, French
  revision sheet) with regression tests.
- Product recording: `public/hero/kelus-product-walkthrough*.webm`.
- The founder reports some further evidence exists but has not supplied it. Until it is supplied: no testimonials,
  student counts, results, school names or press on any surface.

## Product Principles

1. The student's own material is the source of every question; never invent a lesson.
2. Evidence over confidence: what a student showed decides the plan, not how they felt.
3. Say why: every recommendation names the reason in the student's own results.
4. Calm and short: one next step at a time, a session that fits a gap in the day.
5. Honest by default: nothing claimed that the product or the data cannot back.

## Accessibility & Inclusion

Reduced-motion users get finished states without movement; keyboard paths exist for every action (Enter to start, 1–3
to answer, ⌘K search, ⌘Z undo); touch targets at least 44px on public pages.
