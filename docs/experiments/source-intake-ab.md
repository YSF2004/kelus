# Source intake clarity experiment

## Question

Does explaining the result of adding a source before a student chooses a file
help them reach their first route?

This is a Kelus experiment, not a comparison of traffic between products. The
two variants have identical upload, local-first storage, topic review, and
first-question behavior.

| Variant | Source picker explanation |
| --- | --- |
| `reference` | The existing concise file-type explanation. |
| `course_story` | Names the material types, then says Kelus finds topics and asks a first recall question. |

## What to read in PostHog

Filter anonymous events by `variant` / `intake_variant` and compare this
funnel:

1. `source_intake_viewed`
2. `material_upload_started`
3. `material_upload_completed`
4. `first_route_ready`

The events carry only the variant, source role, coarse acquisition source, and
timing or topic-count values already used by Kelus. They never include a file
name, course title, note text, or an identifying profile.

## Decision rule

Do not choose a winner before each variant has at least 80 first-use views and
two weeks of traffic. Keep `course_story` only if it improves completed upload
or first-route-ready rate by at least 15% without increasing upload failures by
more than 3 percentage points. Otherwise keep the concise `reference` picker.

## Benchmark insight adopted

The useful outside pattern is a source area that states both what students may
add and what happens to it. Kelus applies that principle in one optional line,
while keeping its own promise: questions are built from the student's material
and the original source remains available during study.
