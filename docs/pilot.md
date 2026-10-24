# Running a Kelus pilot

Four numbers say whether Kelus helps. They all come from Google Analytics 4, which kelus.me already uses (ads signals
off, IP anonymised). No accounts, no new service, no cost.

## 1. Give each group its own link

```
https://kelus.me/?pilot=lycee-2b
```

The group name is lowercase letters, digits and dashes, up to 32 characters. The browser remembers it, so every later
event from that student carries `pilot_cohort = lycee-2b`, even when they come back from a bookmark.

## 2. One-time GA4 setup

In GA4 → Admin → Custom definitions, add:

| Name                | Scope | Parameter / property |
| ------------------- | ----- | -------------------- |
| Pilot cohort        | User  | `pilot_cohort`       |
| Study session index | Event | `study_session_index` |
| Days since first    | Event | `days_since_first`   |
| Return day          | Event | `day`                |
| Helpful             | Event | `helpful`            |
| Sample              | Event | `sample`             |
| Invite method       | Event | `method`             |
| Milestone           | Event | `milestone`          |
| Flag reason         | Event | `reason`             |

Data only shows from the day a definition is added, so add these before the pilot starts.

## 3. The four numbers

Filter every report to `Pilot cohort = <your group>` and `Sample ≠ true`.

| Question                          | How it is counted                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| Did they finish a first session?  | Users with `session_completed` where `study_session_index = 1`, over users with `session_started` where `study_session_index = 1` |
| Did they come back within 7 days? | Users with `learner_returned` where `day ≤ 7`, over users with a first `session_completed` |
| Did they keep using it?           | Users with `session_completed` where `study_session_index ≥ 2` (and `≥ 3`)             |
| Did they find it useful?          | `session_usefulness_rated`: share with `helpful = true`, and by `study_session_index`  |

A free-form exploration in GA4 (Explore → Funnel exploration) gives the first three as one funnel:
`session_started (n=1)` → `session_completed (n=1)` → `learner_returned (day ≤ 7)` → `session_completed (n ≥ 2)`.

## The pilot summary in one command

Two events make the week readable at a glance:

- `pilot_milestone`, sent **once per student** for each step: `first_topic`, `back_next_day`, `back_within_7_days`,
  `studied_3_days`. It counts answers, not visits: opening Kelus and leaving is not coming back to study. Because each
  student sends each milestone once, "Total users" per milestone is an exact count of students.
- `question_flagged`: a student tapped **Flag this question** under an answer and chose a reason (`unclear`,
  `wrong_answer`, `not_in_notes`). The question is not asked again on that device.

GA4 → Explore → Free form. Rows: Event name, Milestone, Flag reason, Helpful, Pilot cohort. Values: Total users, Event
count. Filter: Event name matches regex `pilot_milestone|question_flagged|session_usefulness_rated`. Then Share →
Download file → CSV, and run:

```bash
node scripts/pilot-summary.mjs ~/Downloads/export.csv
```

Per group it prints: students who studied a first topic; how many came back the next day, within 7 days and on 3
different days (with percentages); how many said a block was helpful; and flagged questions by reason.

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

A pilot of 10–30 students gives a direction, not proof. Report counts next to percentages ("7 of 12 came back"), and
don't claim learning gains from these numbers: they measure use and how useful it felt, not exam results.
