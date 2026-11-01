# Kelus release and pilot readiness

Use the existing `YSF2004/kelus` repository and its Cloudflare `kelus.me` deployment.
Do not publish workspace launchers, development environment files or another replacement app.

## 1. Before publishing

- Run `npm run lint`, `npm run typecheck`, and `npm test`.
- Run the browser checks for the affected journeys. A unit-test count is not proof of sign-in, sync or source navigation.
- Check production public configuration without printing it:
  `node --env-file=.env.production.local scripts/check-production-config.mjs`.
  GitHub's production build runs the same check against its configured environment.
- The configuration check rejects missing or malformed Supabase origins and keys, including dashboard URLs,
  REST URLs and secret/service-role keys. It checks shapes, not credentials, access, redirect allowlists or live sync.
- Missing analytics produces a warning, not fabricated pilot results. Other optional integrations remain optional.
- Resolve the security findings that block the learner pilot before expanding access.

## 2. Verify delivery, not just a GitHub push

The locked dependency install uses `scripts/install-ci.mjs`. Recognized transient npm network errors get at most
three attempts, with bounded fetch timeouts. Lockfile, authentication, integrity, security-policy and certificate
errors are not worked around or automatically retried. Keep the first npm error code when investigating a failure:
the generic "check your proxy" footer alone does not establish that a proxy is misconfigured.

The production workflow and `scripts/ship.sh` both run:

```sh
npm run verify:release -- --commit FULL_GITHUB_COMMIT --attempts 20
```

This checks the exact stamped version and HTML responses for the homepage, Today, study session and completion page.
It does not execute JavaScript or generate study events. A stale version, failed request, invalid version response,
non-HTML response or broken public route fails verification. GitHub records the verification outcome in its job summary.

If the live version differs, inspect the production run. Do not keep reconnecting GitHub or blindly repush an old
commit. Another contribution may have advanced `main`: verify ancestry before claiming that a newer live build
contains a particular release. Never overwrite a newer contribution to force a version match.

## 3. Browser smoke check

Use an internal/test device excluded from student analytics according to [pilot.md](pilot.md).
Do not upload confidential coursework or log source text, answers or credentials.

- On a fresh browser, the example is labelled as a sample and does not replace an existing course.
- Import a short real notes file, confirm the source/topic names and start the first question.
- Exercise correct, incorrect and unsure answers. Feedback must explain using that question's actual source.
- Open evidence and confirm the file, page/passage and quotation. If evidence is unavailable, the interface must say so.
- Include a course with multiple source files; its evidence must not open an unrelated file.
- Refresh mid-session, resume, then complete it. Verify saved answers are not silently discarded.
- Try a failed import, retry and paste fallback. Previously saved course data must remain usable.
- Verify sign-in with a test account and check sync on a second browser. Configuration validation alone cannot certify sync.
- Check the changed screens on a phone, using a keyboard and with reduced motion.

Record actual outcomes, failures and the build tested. Leave untested items unverified.

## 4. Student pilot: evidence still required

Follow the existing [pilot protocol](pilot.md) with a small, known group using their own course materials.
Keep sample sessions and internal tests separate from student results. Record invitations and the observation window.

Observe whether students can import, reach the first useful question, understand the explanation, open its evidence,
complete a session and voluntarily return. Capture usefulness and unclear-question feedback without collecting raw notes.

Use cohort-filtered study events and the correct denominators. Do not substitute page views for students, infer learning
gains from completion, or claim seven-day retention before the cohort has a complete observation window.
See [the connection audit](pilot-connection-check.md) for the distinction between accessible traffic and verified pilot results.
