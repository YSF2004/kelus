"use client";

import { ArrowRight } from "@/components/Marks";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLearner } from "@/components/LearnerProvider";
import { HabitStrip } from "@/components/HabitStrip";
import { generateRoute } from "@/domain/routing-engine";
import { MatchRound } from "@/components/MatchRound";
import { buildMatchRound } from "@/domain/match-round";
import { WaitlistForm } from "@/components/WaitlistForm";
import { SoftUpgradePrompt } from "@/components/SoftUpgradePrompt";
import { downloadTomorrowStudyIcs } from "@/lib/study-reminder";
import { getNudgeSettings, getServerNudgeSettings, nudgesSupported, subscribeNudgeSettings, turnOnNudges } from "@/lib/nudge";
import { SAMPLE_COURSE_IDS, sessionContext } from "@/lib/pilot";
import { ClassInvite } from "@/components/ClassInvite";
import { ShareProgress } from "@/components/ShareProgress";
import { trackEvent } from "@/lib/analytics";
import { useDocumentTitle } from "@/lib/use-title";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import styles from "./complete.module.css";

const OUTCOME: Record<string, string> = { success: "Solid pass", partial: "Partly there", failure: "Needs another attempt" };

/** Partly there, as a half-filled dot: halfway, not a minus. */
function HalfDot() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14">
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1.75A6.25 6.25 0 0 0 8 14.25Z" fill="currentColor" />
    </svg>
  );
}

const noSubscribe = () => () => {};

/** "6 pm" from "18:00", the way the reminder is said back. */
function spokenTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours < 12 ? "am" : "pm";
  const hour = hours % 12 || 12;
  return minutes ? `${hour}:${String(minutes).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

/**
 * The moment a first session ends is the moment to ask about tomorrow: one tap turns on the daily nudge, which
 * only comes when missed lines are ready. Not offered where the browser has no notifications; the calendar stays.
 */
function RemindTomorrow() {
  const supported = useSyncExternalStore(noSubscribe, nudgesSupported, () => false);
  const settings = useSyncExternalStore(subscribeNudgeSettings, getNudgeSettings, getServerNudgeSettings);
  const [note, setNote] = useState("");
  if (!supported) return null;
  if (settings.on) return <p className={styles.note}>Reminder on: Kelus nudges you at {spokenTime(settings.time)} when lines are ready.</p>;
  return (
    <>
      <button type="button" className={`text-btn ${styles.calendar}`} onClick={async () => {
        const answer = await turnOnNudges(settings.time);
        if (answer === "granted") trackEvent({ name: "nudges_enabled" });
        setNote(answer === "granted" ? "" : "Notifications are blocked for Kelus in this browser. The calendar file works instead.");
      }}>
        Remind me tomorrow at {spokenTime(settings.time)} <ArrowRight />
      </button>
      {note ? <p className={styles.note} role="status">{note}</p> : null}
    </>
  );
}

function CompleteBody() {
  const search = useSearchParams();
  const reduceMotion = useReducedMotion();
  const { state } = useLearner();
  const [calendarNote, setCalendarNote] = useState("");
  const [usefulness, setUsefulness] = useState<boolean | null>(null);
  const completionTracked = useRef<string | null>(null);
  const requestedId = search.get("id");
  const session = requestedId
    ? state.snapshot.sessions.find((item) => item.id === requestedId && item.status === "complete")
    : [...state.snapshot.sessions].reverse().find((item) => item.status === "complete");
  const summary = session?.summary;
  const course = state.snapshot.courses.find((item) => item.id === session?.courseId);
  const exam = state.snapshot.exams.find((item) => item.id === session?.examId);
  const name = (id: string) => state.snapshot.concepts.find((concept) => concept.id === id)?.name ?? id;
  const completedSessions = state.snapshot.sessions.filter((item) => item.status === "complete").length;
  const courseConcepts = course
    ? state.snapshot.concepts.filter((concept) => concept.courseId === course.id)
    : [];
  const nextRoute = course && exam ? generateRoute({
    concepts: courseConcepts,
    relationships: state.snapshot.relationships,
    events: state.snapshot.events,
    exam,
    nowIso: state.nowIso,
  }) : null;
  // The calendar entry names the same next topic the page does: one this block did not just cover.
  const coveredIds = new Set(state.snapshot.events.filter((event) => event.sessionId === session?.id && event.kind === "retrieval").map((event) => event.conceptId));
  const nextStopId = nextRoute?.allocations.find((allocation) => allocation.conceptId !== "mixed-retrieval" && !coveredIds.has(allocation.conceptId))?.conceptId;
  const nextStopName = nextStopId ? name(nextStopId) : null;
  const sessionNumber = sessionContext({ sessions: state.snapshot.sessions, sessionId: session?.id, nowIso: state.nowIso }).session_number;
  const minutes = session?.plannedMinutes || exam?.availableMinutes || 45;

  useDocumentTitle(summary ? `Done · ${course?.name ?? "Your session"} — Kelus` : null);

  useEffect(() => {
    document.body.classList.add("is-session-booklet", "is-session-complete");
    return () => document.body.classList.remove("is-session-booklet", "is-session-complete");
  }, []);

  useEffect(() => {
    if (!session || !summary || completionTracked.current === session.id) return;
    completionTracked.current = session.id;
    trackEvent({
      name: "session_completed",
      concept_count: session.plannedConceptIds.length,
      planned_minutes: session.plannedMinutes,
      ...sessionContext({ sessions: state.snapshot.sessions, sessionId: session.id, nowIso: state.nowIso }),
      sample: SAMPLE_COURSE_IDS.has(session.courseId),
      course_type: SAMPLE_COURSE_IDS.has(session.courseId) ? "sample" : "real",
    });
  }, [session, summary, state.snapshot.sessions, state.nowIso]);

  function addCalendar() {
    trackEvent({ name: "next_route_opened", source: "calendar" });
    const ok = downloadTomorrowStudyIcs({
      courseName: course?.name ?? "Study",
      minutes,
      nextStopName,
      todayUrl: "https://kelus.me/today/",
    });
    setCalendarNote(
      ok
        ? "Calendar file downloaded. Open it to add tomorrow’s study session — works even if this tab is closed."
        : "Could not build a calendar file in this browser.",
    );
  }

  if (!session || !summary) {
    return (
      <>
        <header className={styles.bar}>
          <span className={styles.barTitle}>
            <Link href="/" className="study-brand" aria-label="Kelus home"><KelusLogoMark /><span>kelus</span></Link>
          </span>
          <Link href="/today" className={styles.barClose}>Close</Link>
        </header>
        <main id="main" className={styles.empty}>
          <h1>Nothing finished yet.</h1>
          <p>When you finish a session, this page shows what you practised and what comes back tomorrow.</p>
          <Link href="/today" className="k-btn">Back to your plan <ArrowRight /></Link>
        </main>
      </>
    );
  }

  // What this block was: each topic once, with how its last answer went, in the result card's own words.
  const sessionAnswers = state.snapshot.events.filter((event) => event.sessionId === session.id && event.kind === "retrieval");
  const practised = [...new Map(sessionAnswers.map((event) => [event.conceptId, event])).values()];
  const known = practised.filter((event) => event.outcome === "success");
  const rank = { failure: 0, partial: 1, success: 2 } as const;
  const weakest = [...practised].filter((event) => event.outcome !== "success").sort((a, b) => rank[a.outcome ?? "partial"] - rank[b.outcome ?? "partial"])[0];
  const missedToday = (state.missedLines ?? []).filter((line) => line.at >= session.startedAt && practised.some((event) => event.conceptId === line.conceptId)).length;
  const nextFresh = nextStopId ? { conceptId: nextStopId } : undefined;
  const matchPairs = buildMatchRound(practised.map((event) => event.conceptId), state.snapshot.concepts, state.snapshot.learningActivities);

  return (
    <>
    {/* The same bar the session had a moment ago: the block ends on its own page, not off the edge of the app. */}
    <header className={styles.bar}>
      <span className={styles.barTitle}>
        <Link href="/" className="study-brand" aria-label="Kelus home"><KelusLogoMark /><span>kelus</span></Link>
      </span>
      <Link href="/today" className={styles.barClose}>Close</Link>
    </header>
    <main id="main" className="study-shell is-complete-page">
      <motion.section
        className={`complete-folio is-page ${styles.done}`}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduceMotion ? { duration: 0.12 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* The end of a session, short: what you did, what comes back, one way on. The list says how many topics. */}
        <h1>Done.</h1>
        <p className={styles.lede}>
          {practised.length} {practised.length === 1 ? "topic" : "topics"}{course && course.name !== "My course" ? ` from ${course.name}` : ""}. Your answers are saved.
        </p>

        <ul className={styles.topics} aria-label="Topics in this session">
          {practised.map((event, index) => (
            <motion.li
              key={event.conceptId}
              className={styles[event.outcome ?? "partial"]}
              initial={reduceMotion ? false : { opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.12 + index * 0.06, ease: [0.22, 1, 0.36, 1] }}
            >
              <span className={styles.mark} aria-hidden="true">{event.outcome === "success" ? "✓" : event.outcome === "partial" ? <HalfDot /> : "↻"}</span>
              <strong>{name(event.conceptId)}</strong>
              <span className={styles.word}>{OUTCOME[event.outcome ?? "partial"]}</span>
            </motion.li>
          ))}
        </ul>

        <section className={styles.tomorrow} aria-labelledby="complete-return-title">
          <div>
            <h2 id="complete-return-title">
              {missedToday
                ? missedToday <= 3
                  ? <>{missedToday === 1 ? "The line you missed comes" : `The ${missedToday} lines you missed come`} back as a 1-minute warm-up.</>
                  : <>Tomorrow starts with a 1-minute warm-up on lines you missed, three at a time.</>
                : nextFresh ? <>Next time, start with <strong>{name(nextFresh.conceptId)}</strong>.</> : "Your plan is saved for next time."}
            </h2>
            {missedToday > 3 ? <p>{missedToday} lines are saved for it.</p> : null}
            {missedToday && nextFresh ? <p>Then {name(nextFresh.conceptId)}, a topic you haven’t done yet.</p> : null}
            <RemindTomorrow />
          </div>
        </section>

        {/* One way on: the next topic when there is one, else the plan. */}
        <Link href="/today" className={`cta ${styles.primary}`} onClick={() => trackEvent({ name: "next_route_opened", source: "completion" })}>
          {nextFresh ? <>Keep going with {name(nextFresh.conceptId)}</> : "Back to study plan"} <ArrowRight />
        </Link>
        {/* Sharing is one quiet button under the way on; it opens the card in a sheet. */}
        {!SAMPLE_COURSE_IDS.has(session.courseId) && practised.length ? <div className={styles.share}><ShareProgress variant="inline" /></div> : null}

        <div className={styles.quiet}>
          {usefulness === null ? (
            <p role="group" aria-label="Rate study usefulness">
              Was this useful?{" "}
              <button type="button" onClick={() => { setUsefulness(true); trackEvent({ name: "session_usefulness_rated", helpful: true, session_number: sessionNumber, course_type: SAMPLE_COURSE_IDS.has(session.courseId) ? "sample" : "real" }); }}>Yes</button>{" "}
              <button type="button" onClick={() => { setUsefulness(false); trackEvent({ name: "session_usefulness_rated", helpful: false, session_number: sessionNumber, course_type: SAMPLE_COURSE_IDS.has(session.courseId) ? "sample" : "real" }); }}>Not yet</button>
            </p>
          ) : <p role="status">{usefulness ? "Thanks. Good to know." : "Thanks. That helps make it better."}</p>}
        </div>

        {/* Everything else about this block, one tap away instead of a long scroll: what changed, a bonus round, the
            week, a calendar file, and what Kelus offers next. */}
        <details className={styles.more}>
          <summary>More from this session</summary>
          <div className={styles.moreBody}>
        {/* What changed, the way a tutor would say it: what you now know, and the one thing to fix next. */}
        <section className={styles.changed} aria-label="What changed">
          {known.length ? (
            <p>
              <span className={styles.changedLabel}>You now know</span>
              <b>{known.map((event) => name(event.conceptId)).join(", ")}</b>
            </p>
          ) : (
            <p>
              <span className={styles.changedLabel}>So far</span>
              <span className={styles.none}>No topic is solid yet. That’s normal on a first pass: the second one is where lines stick.</span>
            </p>
          )}
          {weakest ? (
            <p>
              <span className={styles.changedLabel}>Your weak spot</span>
              <b>{name(weakest.conceptId)}</b>
              <span className={styles.none}>{nextStopId === weakest.conceptId ? " · it’s first next time" : " · its missed lines open tomorrow’s warm-up"}</span>
            </p>
          ) : null}
        </section>
        {/* A quick bonus round on the topics just practised, when there are three or more to match. */}
        {matchPairs.length ? <MatchRound pairs={matchPairs} seed={session.id} /> : null}
        <HabitStrip events={state.snapshot.events} concepts={courseConcepts} compact />
            <button type="button" className={`text-btn ${styles.calendar}`} onClick={addCalendar}>
              Add tomorrow to calendar <ArrowRight />
            </button>
            {calendarNote ? <p className={styles.note} role="status">{calendarNote}</p> : null}
          {/* A first session ends on the plan and one question; sharing waits until Kelus has earned it. */}
          {session && !SAMPLE_COURSE_IDS.has(session.courseId) && completedSessions >= 2 ? <ClassInvite sessionNumber={sessionNumber} /> : null}
          {completedSessions === 1 ? (
            <details>
              <summary>Want Kelus through to exam day?</summary>
              <SoftUpgradePrompt moment="first_session" />
            </details>
          ) : null}
          {completedSessions >= 2 ? (
            <details className="complete-waitlist">
              <summary>Get product updates</summary>
              <WaitlistForm source="session_complete" compact />
            </details>
          ) : null}
          </div>
        </details>
      </motion.section>
    </main>
    </>
  );
}

export default function SessionCompletePage() {
  return (
    <Suspense
      fallback={
        <main id="main" className="study-shell is-complete-page">
          <p>Updating your plan…</p>
        </main>
      }
    >
      <CompleteBody />
    </Suspense>
  );
}
