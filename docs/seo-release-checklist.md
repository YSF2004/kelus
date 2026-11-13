# PDF practice search-entry release checklist

This is release prep for `codex/seo-acquisition`; it is not evidence of a live deployment or search traffic. Do not publish the URL in outreach until the production checks pass.

## Local QA, 27 October 2026

- 329 unit tests, lint, and `npm run typecheck` passed; the static production build exported the new page.
- Four focused Chromium checks passed against the exported site: mobile/desktop entry and upload handoff, start-screen responsiveness, notes-to-first-response analytics, and a PDF-to-question path surviving refresh.
- The first standalone typecheck encountered stale, empty route types left in `.next/dev` by the failed dev server. Moving that generated directory aside and rerunning typecheck passed. A fresh CI checkout should not have the stale files.
- Dev-mode Playwright hit this machine's file-watcher limit (`EMFILE`), so browser checks ran against the static production export instead.

## Before GitHub access resumes

- Run `node --import tsx --test tests/*.test.mjs`, `npm run typecheck`, and `npm run build` in the clean SEO worktree. `npm test` may need the Node 22 project runtime; the direct `node --import tsx --test` invocation avoids `tsx`'s IPC server in restricted shells.
- Run `npx playwright test e2e/pdf-practice-entry.spec.ts e2e/analytics-funnel.spec.ts` where the local web server and browser can start. Confirm desktop and 390px mobile have no horizontal overflow.
- Use a real, permission-cleared PDF as a manual smoke test: add source → inspect proposed topics and quoted passage → answer first question → finish a block. Record whether the passage and answer are actually useful; passing a synthetic fixture alone is insufficient.
- Keep the SEO branch isolated from the older, dirty primary checkout. Do not copy its unrelated changes into this release.

## When GitHub access resumes

1. Open `codex/seo-acquisition` against the current `main`. Review the diff and resolve any new-main conflicts before merging. Wait for CI. Do not deploy directly from an unreviewed stale branch.
2. After the production deployment, verify `/pdf-to-practice-questions/` returns 200, has exactly one H1, links into `/today/`, and its canonical is `https://kelus.me/pdf-to-practice-questions` (or the final slash-normalized URL chosen by Next). Confirm that exact URL appears in `/sitemap.xml` and that the page is not blocked by `robots.txt`.
3. Use Search Console URL Inspection to check the live page and request indexing once if needed. Indexing is not guaranteed; allow time for the report to update. Check queries, impressions, clicks, and page-level CTR weekly.
4. Confirm the production GA measurement ID is configured. In GA4 DebugView or a test property, verify the sequence `material_upload_started` → `material_upload_completed` (file saved locally) → `material_processing_completed` (readable topics proposed) → `material_confirmed` → `first_route_ready` → `session_started` → `study_response_recorded` → `session_completed`. If reading fails, `material_processing_failed` records only `source_type` and a coarse `reason`, never file text or title.
5. In GA4 Admin → Custom definitions, register the event-scoped dimensions `course_type`, `source_type`, `reason`, `used_ocr`, `landing`, `placement`, and `acquisition_source` before evaluating the funnel. Exclude `course_type = sample` from real-student conversion. Count users reaching each step, not only event totals; report the sample size beside percentages.

## Decision after the first data arrives

- Search impressions without clicks: inspect query intent, title, and snippet; do not assume the upload flow is the problem.
- Clicks without upload starts: inspect the page-to-upload handoff on mobile and the upload CTA's promise.
- Saved files without `material_processing_completed`: inspect extraction/OCR failures. `material_upload_completed` alone does **not** mean Kelus could use the file.
- Topics proposed without a first response: watch one real first session and remove the friction at that point before publishing more SEO pages.
- Responses without repeat sessions: inspect question usefulness, feedback quality, and whether the route change is clear; do not treat traffic as retention.
