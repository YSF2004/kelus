# Kelus student-validation metrics

Kelus records the smallest event set needed to test its core claim. It does not
record answer text or uploaded material contents.

## Funnel

1. `setup_completed` — destination, deadline and study-time budget were saved.
2. `material_map_confirmed` — the student accepted at least one extracted concept.
3. `diagnosis_completed` — initial ratings and retrieval checks produced a route.
4. `session_started` — the student accepted Kelus's recommendation.
5. `answer_evaluated` — source-grounded evidence updated the learner model.
6. `route_recalculated` — records whether the evidence materially reordered the route.
7. `session_completed` — the complete Learn → Retrieve → Apply → Evaluate loop finished.

`session_started` includes completed-session count and days since the previous
completed session. This distinguishes first use from a genuine return without
introducing a separate identity system.

## Initial success thresholds

- Median setup-to-first-route completion: under 5 minutes.
- At least 60% of diagnosed students start the recommended route.
- At least 60% of started sessions are completed.
- At least 30% of students who complete one session start another on a later day.
- Reroutes are not optimized for frequency. The quality question is whether a
  student understands why an observed reorder happened.

Apply `database/005_product_events.sql` to Supabase before expecting signed-in
events to appear remotely. Guest events remain in `kelus-product-events-v1` in
localStorage so the learning experience never depends on analytics availability.

