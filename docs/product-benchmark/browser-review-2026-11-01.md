# Study experience browser review — 2026-11-01

## Scope

Development preview, not production. Isolated browser; built-in, clearly labelled Microeconomics sample; internal analytics exclusion enabled. No real accounts, external uploads or network AI calls. One journey plus a targeted check of the resulting fix.

Viewports: 402×874 phone and 1440×900 desktop. Light and Dark inspected. Reduced-motion preference enabled. This is not a full accessibility certification, retention study or load test.

## Observed results

| Check | Result | Limitation |
| --- | --- | --- |
| Optional first-use sample | Pass | Not real-source onboarding. |
| Correct answer | Pass | False matched supported answer False in the sample. |
| Incorrect answer | Pass | True was contrasted with supported answer False and an explanation. |
| Unsure answer | Pass | Revealed supported answer and explanation. |
| Source disclosure | Pass, inline only | Exact passage shown; original PDF explicitly absent. |
| Active sample session | Pass | Correct true/false and incorrect cloze feedback displayed learner answer, supported answer and reasoning. |
| Self-explanation | Observed | Key-word coverage was displayed; this is not proof of conceptual understanding or semantic grading quality. |
| Completion and return | Pass | Partial result returned to updated same-browser sample plan. No cross-device inference. |
| Today phone primary target | Pass | Measured 281×52px. |
| Inline completion targets | Failed, then fixed and rechecked | Both actions originally 36px high; both now 52px on phone and desktop. |
| Horizontal overflow | None observed | Phone client/scroll width 387/387; desktop 1440/1440. |
| Themes | Visually legible in inspected states | No measured WCAG contrast audit; Auto behavior not established. |
| Keyboard | Visible focus on More session options | Full order, traps and keyboard-only completion not established. |
| Reduced motion | Preference enabled | Animation timing and every end state not established. |

Observed source passage: “Close substitutes make switching easier, so the response is usually larger.” The inline display also showed “Box 1 to Box 2.” That box transition is **not a file/page locator**; do not count it as successful PDF navigation.

## Bug and correction

The learner reaches the inline QuickResult at `/session/`, not necessarily the dedicated `/session/complete/` screen. Shared important button styling overrode its intended height. Scoped result-action selectors now preserve 52px targets for both Retry and Continue without changing grading or callbacks.

A subsequent normal-motion first-paint screenshot also showed muted study content. A short parent-panel opacity entrance has been disabled, but a fresh static capture still appeared muted afterward. The root cause of that remaining appearance is not established. Normal-motion fresh-load readability must therefore remain an open check, not a claimed fix. This was a separate visual/code check, not another full interactive journey pass.

Targeted browser recheck:

- Phone: Retry 99.64×52px; Continue 241.36×52px.
- Desktop: Retry 90.30×52px; Continue 232.02×52px.
- No console/page errors during the measurement interval. Transient HMR reconnect failures immediately after the development workflow restart recovered. Existing nonblocking artwork-preload and reduced-motion warnings remain.

## Honest design assessment

The feedback hierarchy is substantially clearer: learner answer → supported answer → reason → highlighted source. Branding is consistent and the main actions are usable on phone. Completion returns to a meaningful next topic.

The experience is still fairly dense. Feedback and completion combine explanations, quotation panels, mastery boxes, review timing and secondary details. The next refinement should test whether students understand the evidence and next action without explanation, before adding motion or more content.

The sample supports a positive design assessment, not a full-product or market-leadership score. Real-course onboarding, multi-file evidence, OCR recovery, rigorous accessibility, authenticated continuity and delayed learning outcomes remain unverified.

## Next acceptance checks, in order

1. Across economics, biology and maths, feedback must not invent reasoning; evidence must open the correct file, page and passage.
2. A new student must complete a useful real-source session without help; record actual completion and time.
3. Missing/weak/scanned sources must offer truthful recovery rather than unsupported questions.
4. Complete keyboard, contrast and screen-reader checks across themes; preserve measured touch targets.
5. Prove progress survives a signed-in return from another device.
6. Only then compare equivalent tasks with consenting students; assess explanation quality and next-day recall, not just feature counts.

These checks identify evidence needed; they do not assert those untested flows are broken.
