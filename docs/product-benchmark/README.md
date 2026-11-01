# Kelus improvement and competitor benchmark

Internal product-development system. Not a public comparison page, analytics dashboard, or claim that Kelus leads the market. Nothing here is served from the student app. Do not store student notes, accounts, private competitor credentials or identifying recordings here.

## Position worth testing

**Know what to study, answer from memory, understand why, and verify it against your own course.**

Kelus should aim to make this loop unusually clear and dependable. Sources and quizzes are already offered elsewhere; a green interface and more animation are not sufficient differentiation. Preserve the official Kelus identity. Use competitors to improve outcomes, not copy their branding.

## Run the system

From the product repository:

```sh
node scripts/product-benchmark.mjs
node scripts/product-benchmark.mjs docs/product-benchmark/scorecard.json --strict
```

The first command prints a repeatable Markdown comparison. The second exits nonzero until Kelus has complete, fresh standard-protocol observations, at least 8.5/10, and at least 3/4 on every critical dimension. This is an **internal improvement target, not a production deployment gate or guarantee of success**. No automatic release or workflow changes.

`scorecard.json` holds weights, dated references and assessments. Append an evidence record, then an assessment referencing its ID. Ratings from official documentation are forbidden. Missing data stays unknown, not zero. Observations expire after 30 days; a redesign or broken flow requires immediate reassessment even before expiry. Scores never renormalize around missing dimensions.

### Anchors

| Rating | Observable meaning |
| --- | --- |
| 0 | Journey cannot be completed or delivers an unsafe/misleading result. |
| 1 | Completes only with major confusion, workarounds or help. |
| 2 | Usable, with meaningful friction or weak explanation. |
| 3 | Clear and dependable within the declared scope, no critical defects observed. Overall scoring still requires the full standard protocol. |
| 4 | Meets 3 and has comparative student-study evidence of a meaningful advantage. |

`status` is `unknown`, `documented`, or `observed`. Only observed assessments accept ratings. Observations require `scope: "sample"` or `"standard"`. A labelled sample can inform design but **cannot establish a full-product score**. Evidence kinds are `official-doc`, `browser`, and `student-study`. A documented feature not found during testing is not proof the competitor lacks it: record the account, plan and limitation.

Example assessment shape (illustrative only, not an actual finding):

```json
{
  "criterion": "trust",
  "status": "observed",
  "scope": "standard",
  "rating": 2,
  "evidence": ["your-reviewed-browser-report"],
  "note": "Describe the exact result, limitations, environment and reproducible failure."
}
```

## Same protocol for every product

Use identical openly licensed materials and record their URL/license, file checksum, expected passage and page. Never upload sensitive course material to competitor services without permission.

1. Prepare three small fixtures: economics prose, biology definitions, and maths with signs/equations. Include two files with overlapping topic names, a scanned page, and a passage too weak to support a question.
2. Record date, product/build, account tier/eligibility, browser, device and test restrictions. Begin without prebuilt content. Separate unaided first use from returning use.
3. Import a source and reach the first useful question. Measure elapsed time and help required, not just clicks. Note extraction failures and question quality.
4. Give a correct, incorrect and unsure response. Compare learner answer, expected answer, supported explanation and quote. A quotation alone is not proof of a causal explanation.
5. Open the evidence. Check **file + page + exact passage**, including overlapping files. A generic quote or first-page link does not pass.
6. Attempt an unsupported question and missing/scanned-source recovery. The product should disclose limits and offer a useful next action, not invent certainty.
7. Complete, leave and return. Verify the next step and retained progress. Separately test authenticated cross-device continuity; a sample/local reload cannot establish it.
8. Repeat the changed interactions at 402px and 1440px, keyboard-only, light/dark/auto and reduced motion. Check zoom, overflow, focus, screen-reader names and contrast. Confirm critical targets in rendered UI, not CSS declarations.

Store a sanitized report with steps, results, failures and evidence locations. An assessment marked `standard` means its **whole dimension** passed through the relevant fixtures, not just a happy-path sample.

## Improvement loop

1. Capture a dated baseline before each meaningful release.
2. Rank observed issues: incorrect/misleading evidence or progress loss first; blocked first session second; accessibility and recovery next; decorative polish last.
3. For each improvement, write: student problem → change → observable acceptance check → evidence after the change. Keep one primary hypothesis at a time.
4. Recheck changed flows, retaining previous evidence only when unchanged. Re-run the report.
5. Before claiming an advantage, use consenting students on equivalent tasks with counterbalanced product order. Record completion without help, time to first useful question, ability to explain why, evidence-finding success and next-day recall. Keep raw identifying data outside this repository.
6. Treat outcome thresholds as hypotheses, not results. Suggested pilot target: at least 8 of 10 participants complete a real-source session unaided; all seeded evidence links resolve to the right source; no observed data loss. A small pilot is directional, not proof of market leadership.

## Current competitive take

- **NotebookLM / Gemini Notebook:** benchmark for source-grounded research and breadth of source transformations, as described on its official site. Kelus must demonstrate a clearer course-to-practice loop rather than claim source grounding is unique.
- **Quizlet:** benchmark for flexible practice-test setup and review. Kelus should demonstrate a shorter route to useful course-specific feedback, not assume it.
- **RemNote:** benchmark for integrated PDF annotation, linked evidence and guided study. Kelus needs evidence navigation that is equally trustworthy with less setup for its target students.
- **Kelus:** the sample loop and visual refinement are useful progress; real-course reliability, cross-file fidelity, accessibility and return use need their own evidence.

Official source records and review dates are in the scorecard. Competitors have **not** been hands-on tested in this review, so numerical rankings are intentionally unavailable.
