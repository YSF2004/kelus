# Running a Kelus pilot

Use one course group of 10–30 students and their real course materials. GA4 measures product use and self-reported
usefulness, not learning gains. It is already installed on kelus.me with ads signals off and IP anonymisation enabled.

**Pilot status:** No cohort export or invitation count was present when this report was prepared. Results, source types
tested, and a product-change recommendation must be filled in from a real cohort; do not treat missing data as zero or
as evidence that students did or did not return.

A [read-only connection check](pilot-connection-check.md) retrieved live Cloudflare traffic and verified the installed
Google tag. It also explains the missing GA4 report authorization and the live build's unclassified historical ratings.

## 1. Give each group its own link

```
https://kelus.me/?pilot=lycee-2b
```

The group name is lowercase letters, digits and dashes, up to 32 characters. The browser remembers it, so every later
event from that student carries `pilot_cohort = lycee-2b`, even when they come back from a bookmark.

## 2. One-time GA4 setup

In GA4 → Admin → Custom definitions, add:

| Name             | Scope | Parameter / property |
| ---------------- | ----- | -------------------- |
| Pilot cohort     | User  | `pilot_cohort`       |
| Session number   | Event | `session_number`     |
| Days since first | Event | `days_since_first`   |
| Return day       | Event | `day`                |
| Helpful          | Event | `helpful`            |
| Sample           | Event | `sample`             |
| Invite method    | Event | `method`             |
| Milestone        | Event | `milestone`          |
| Flag reason      | Event | `reason`             |
| Course type      | Event | `course_type`        |
| Source type      | Event | `source_type`        |

Data only shows from the day a definition is added, so add these before the pilot starts.

## 3. Invite one cohort and record the invitation count

Send one link per group, for example `https://kelus.me/?pilot=lycee-2b`. Record the number of students actually
invited in a small organizer log; GA4 cannot know how many invitations were sent. Do not put student names, emails, or
course names into the cohort code or export.

## 4. Export the counts

Create a GA4 Explore → Free form report with rows `Event name`, `Pilot cohort`, `Session number`, `Course type`,
`Helpful`, `Flag reason`, and `Source type`; values `Total users` and `Event count`. Include
`session_started`, `session_completed`, `session_usefulness_rated`, `question_flagged`, and
`material_processing_completed`. Filter to the cohort, but **do not filter by Course type** before exporting.
Keep `real`, `sample`, and `(not set)` rows so the script can reject unclassified activity rather than report incomplete
counts as valid rates. The script selects real-course rows and ignores sample rows after validation. Download as
`export.csv`.

Create a second report for returns, filtered to `Event name = learner_returned`, `Return day ≤ 7`,
and the same cohort, again **without a Course type filter**. Use rows `Pilot cohort` and `Course type`, values `Total users` and `Event count`, then download
as `returns.csv`. Keep a single aggregate row for the cohort; splitting this export by day can count one student more
than once. If sample rows exist, keep one aggregate row per cohort/course-type pair; the script ignores sample rows
and requires exactly one real-course aggregate row when any real returns were recorded.

Run the summary with the invitation count recorded by the organizer:

```bash
node scripts/pilot-summary.mjs ~/Downloads/export.csv \
  --returns ~/Downloads/returns.csv \
  --cohort lycee-2b \
  --invited 18
```

The report includes invited students, first-session starts and completions, seven-day returns, usefulness ratings,
flagged questions by reason, and source types with processing events. Every percentage shows its denominator and the
invited cohort size. Add `--window-complete` only after every student who completed a first session has had seven full
days to return; otherwise the final return rate is intentionally withheld. Check the CSV date range before interpreting
an empty cohort as zero usage.

The summary rejects unclassified course types, missing usefulness values, and multiple return-user rows per cohort.
Missing dimensions must not become zero usage, negative feedback, or duplicate returning students. Historical events
without the required parameters cannot be repaired by registering a custom dimension after the fact.

## 5. Write the result and make one decision

Record the report date, cohort code, invitation count, source types, and the generated counts in the pilot review.
Choose one next product change only after reviewing the largest observed drop-off or repeated student feedback.
If there is no real cohort data yet, say so and wait; do not invent results or prescribe a change as evidence-based.

## Flagged questions

A flag sends only its reason and the kind of question. If the student also taps **Send it to the Kelus team**, the
question, Kelus's answer, their answer and the line from their notes arrive by email at hello@kelus.me (the same
inbox as the Questions page). That is the only way any words from a student's notes leave their device, and only on
that tap. Read these first: they are the next thing to fix.

## Class invites

After a block, a student can tap **Send them Kelus**. On a phone it opens the share sheet (WhatsApp, Discord,
Messages); on a computer it copies the link. The link is `kelus.me/?pilot=<code>&via=invite`: the student's pilot group
if they came from one, otherwise a random class code made once on their device (`class-k3x9qa`). Classmates who open
it join the same group, so a class that spreads Kelus by itself shows up as one cohort. Nothing from the notes is
shared; each classmate adds their own copy of the slides.

| Question                     | How it is counted                                              |
| ---------------------------- | -------------------------------------------------------------- |
| Do students pass Kelus on?   | Users with `invite_shared` (by `method`), over users with a finished block |
| Do invites bring classmates? | `invite_opened`, by `Pilot cohort`; then their first `session_completed` |

## What is and is not sent

- Sent: event names above, the session number, day counts, the yes/no usefulness answer, how an invite was sent, and the pilot group name or class code.
- Never sent: notes, answers, topic names, names or emails. The one exception is a flagged question a student chooses
  to send with **Send it to the Kelus team**; it goes to hello@kelus.me, not to analytics.
- The built-in sample course is marked `sample: true` and never sends a return.

A return is counted at most once per calendar day, and only on a later day than a finished block.

## Reading it honestly

A pilot of 10–30 students gives a direction, not proof. Report counts next to percentages (for example, "7 of 12 came
back; cohort N=18 invited"). The counts identify browsers, not people across devices. Do not claim learning gains:
these measures describe use and self-reported usefulness, not exam results.
