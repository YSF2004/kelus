# Kelus acquisition plan

Kelus is for a student with an exam approaching and a pile of their own course material. The promise is not “AI learns for you”; it is **bring your notes, practise recalling them, and know what to review next**. Keep every claim grounded in the actual flow. Do not promise a grade increase, a two-minute setup for every PDF, or live Plus features that are still planned.

## Search intent and pages

| Student's search / question | Best existing page | Message to lead with |
| --- | --- | --- |
| “How do I revise from lecture notes?” | `/route/` | Upload or paste notes → confirm topics → answer → revisit the weak topic. |
| “Can I study from my own PDF for an exam?” | `/` → `/today/` | Use your own course material, not a generic question bank. |
| “Is there a free exam revision app?” | `/pricing/` | Free plan available now, account optional. Plus availability is stated honestly. |

Do not create dozens of near-identical subject pages. A new Biology, Law, or Mathematics page should exist only after a real student example can demonstrate a materially different task and answer quality. Index the three existing marketing pages; keep private study routes out of search results.

## Three acquisition experiments

1. **Course-group pilot.** Recruit 10–30 students with a real exam in the next few weeks. Give each class a distinct `?pilot=<group>` link and ask them to bring one actual source. Use the measurement steps in [pilot.md](pilot.md); report counts beside every percentage. Ask where they hesitated and whether the first recommended topic made sense.
2. **One honest walkthrough.** Publish a short screen recording of a real, permission-cleared source moving through import, topic confirmation, recall, answer check, and changed route. Post it where students already discuss revision; the caption should describe the concrete task, not an “AI-powered” promise. Link to `/route/` with a campaign UTM. Reuse the same recording on the homepage only if it reflects the current product.
3. **Student-language search content.** After pilot interviews, write one useful guide answering the exact highest-frequency question (for example, revising lecture PDFs or planning revision with 14 days left). Include a worked example, what Kelus does and does not do, and a natural path into `/today/`. Avoid generic “10 study tips” articles.

Example campaign link: `https://kelus.me/route/?utm_source=student_group&utm_medium=community&utm_campaign=first_exam_pilot`. Keep campaign names consistent; do not put names, email addresses, course files, or answers into URLs.

## Measurement and decision rules

- Use Search Console to watch indexing, search queries, impressions, clicks, and which page is actually earning each query. A working sitemap is not proof of indexing or traffic. Do not claim an SEO lift until there is before/after data.
- In GA4, distinguish visits from product value. The key funnel is source added → first route ready → first session started → first session completed → a return within seven days. The existing [pilot.md](pilot.md) details the latter events and cohort setup. Review drop-off by cohort rather than only all-site totals.
- For each outreach channel, record the number of people invited, visits, first completed sessions, seven-day returns, and qualitative objections. If visitors arrive but do not complete the first session, fix onboarding and source quality before buying traffic.
- Review after 20 real first sessions. Keep a channel only if students can explain the recommendation and some choose to return without a reminder. This is a learning threshold, not a claim of statistical significance.

## Before promoting widely

Verify the live canonical URLs, social preview, and Search Console property after release. Test a fresh student's path with a real PDF and on mobile. Check the pricing page's live availability label before mentioning Plus in outreach. Ask permission before publishing student material or testimonials.
