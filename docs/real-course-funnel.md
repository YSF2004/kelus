# Real-course activation funnel

Kelus sends these GA4 events from the browser. No note text, answer text, topic title, file name, search query, or email is sent. Filter each step to the event parameter `course_type = real`; the built-in Microeconomics sample uses `sample`. Register `course_type` as an event-scoped custom dimension in GA4 before exploring historical data (registration is not retroactive).

| Step | Event | Interpretation |
| Entry | `search_landing_cta_clicked` | A visitor chose to start from a specific search page. It carries only a controlled `landing` label and CTA placement. |
| --- | --- | --- |
| 1 | `material_upload_completed` | A PDF or notes file was saved locally. It does **not** mean cloud sync completed. |
| 2 | `first_route_ready` | The first route was built from extracted topics. `elapsed_ms` starts at the first file selection where available; zero means no reliable start time. |
| 3 | `study_response_recorded` | The learner attempted the first check or own-words response in a run. This is not answer quality. |
| 4 | `session_completed` | A study session reached its completion page. Filter `session_number = 1` for first-session activation. |
| 5 | `learner_returned` | The learner opened Today on a later calendar day after a completed real-course session. It carries `course_type = real`; filter `day <= 7` for a first-week return. |

In GA4, build an open funnel from `search_landing_cta_clicked` through steps 1–4 and a separate user-based first-week return report for step 5. Register `landing`, `placement`, and `acquisition_source` as event-scoped custom dimensions: the last label persists only for the browser session and is attached to upload, processing, and first-route events. Show unique users and raw counts at each step, not only conversion percentages. Segment by `pilot_cohort` where one was supplied. The funnel currently identifies a browser, not a student across devices; do not claim cross-device attribution or learning gains from these events. `first_route_ready` and `study_response_recorded` can happen more than once, so use first occurrence per browser for activation. Upload failures and time-to-route are diagnostics, not extra conversion steps.

For QA, use GA4 DebugView in a consented development session: upload real notes, wait for Today, answer a check, finish the block, then revisit the following day. Verify `course_type` stays `real` and that the sample path stays `sample`. This cannot be verified with a live production account in automated tests without test credentials.
