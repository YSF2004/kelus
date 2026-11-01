# Pilot tracking connection check

Checked on **2026-11-01**, using read-only Cloudflare access and public HTTP responses. No deployment, remote
configuration change, student invitation, or synthetic study event was performed.

## What connected

- The existing Cloudflare connection works, and the `kelus.me` zone is active.
- The homepage and `/session/complete/` return HTTP 200.
- The live page contains Google Analytics measurement ID `G-B4WD58PYF6`, its bootstrap, and its Google tag loader.
  The loader returns HTTP 200. This verifies installation and availability, **not** receipt of study events in GA4.
- Cloudflare Web Analytics is enabled for the site. Its GraphQL API returned the aggregate traffic below.

## Accessible traffic, not cohort results

Source: Cloudflare `rumPageloadEventsAdaptiveGroups`, restricted to the Kelus Web Analytics site.
Window: **2026-10-25 00:00:00 UTC through 2026-10-31 23:59:59 UTC**, before this connection check.

| Measure | Recorded count |
| --- | ---: |
| All page views | 265 |
| Cloudflare visits | 51 |
| Homepage `/` page views | 95 |
| Study plan `/today/` page views | 83 |
| Route explanation `/route/` page views | 43 |
| Pricing `/pricing/` page views | 33 |
| Session `/session/` page views | 3 |

No completion-route page-view group appeared in the returned path data. **This is not a count of zero completed
study sessions.** Client-side navigation, repeated views, measurement coverage, and team traffic can affect route
counts. Cloudflare visits are not verified unique people; neither measure establishes student identity or a pilot
cohort. No conversion percentages are reported because the cohort size and appropriate denominators are unknown.

## Where the reporting problem is

1. **Google reporting access is missing here.** No direct Google Analytics connector was available in the integration
   search. Cloudflare authorization does not authorize GA4 report access, and the public measurement ID cannot read
   reports. The private event reports have not been queried; missing access is not evidence of missing activity.
2. **The live build lacks part of the measurement fix.** Inspection of the deployed completion-page JavaScript found
   `session_usefulness_rated` with `helpful` and `session_number`, but without `course_type`. The branch adds the
   real/sample label to ratings, flags, and returns. Those branch changes are not automatically live. An export filtered
   to `course_type = real` cannot include older unclassified events or retroactively recover that label.
3. **There is no verified invitation count or cohort assignment.** Analytics cannot reconstruct how many students were
   invited. A known cohort and a complete observation window remain necessary.

### Separate development sign-in issue

The development environment supplied a dashboard URL as the Supabase project URL and a REST endpoint as the publishable
key. Those are invalid authentication settings. The malformed development entries were removed rather than used as
credentials. Development sign-in needs correct project settings before it can work; local-first study does not depend
on signing in. No production configuration or live authentication settings were changed.

## Required pilot results: availability

| Required result | Current evidence |
| --- | --- |
| Invited students / cohort size | Not available; organizer count needed |
| First-session starts and completions | GA4 event reports not accessible; route views are not substitutes |
| Seven-day returns | Not available; needs cohort-filtered GA4 users and a mature observation window |
| Usefulness ratings | Not available; live historical ratings also lack the real/sample label |
| Flagged questions | GA4 event reports and consented feedback not accessed |
| Source types actually tested | Not available from Cloudflare page views |

## One next product change to evaluate

**Make the first-session hand-off from Study plan clearer**, retaining the learner's source/topic name and a single
explicit first-session action. The accessible traffic shows many more Study plan views than session-route views, so
this is a reasonable place to investigate before adding more study-session features.

This is a **provisional prioritization hypothesis**, not a measured student drop-off rate. Check route-event coverage
and exclude team activity, then observe the initial real-material cohort before implementing a broader redesign.
There is no evidence here of learning gains, trust, or seven-day student retention.

## Next access step

Use an authorized, read-only GA4 reporting connection if one becomes available, or the two aggregate exports in
[pilot.md](pilot.md). Do not replace GA4 with a different analytics service merely to obtain a connection, and do not put
credentials, notes, answers, names, or email addresses into an export. The pilot itself remains unverified.
