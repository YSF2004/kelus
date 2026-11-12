"use client";

import { ArrowRight } from "@/components/Marks";
import { topicLevel } from "@/lib/format";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Concept, ConceptRelationship, LearningActivity, LearningEvent, RoutePlan, StudySession } from "@/domain/types";
import { dayKey, habitSummary, studyPath } from "@/domain/habit";
import { NudgeCard } from "@/components/NudgeCard";
import { InstallCard } from "@/components/InstallCard";
import { getNudgeSettings, getServerNudgeSettings, nudgesSupported, subscribeNudgeSettings } from "@/lib/nudge";
import { installState, serverInstallState, subscribeInstall } from "@/lib/install-app";
import { useReturnVisit, WelcomeBack } from "@/components/WelcomeBack";
import { ReminderCard } from "@/components/ReminderCard";
import { ExamDateCard } from "@/components/ExamDateCard";
import { estimatedReadiness } from "@/domain/readiness";
import { buildQuickRun } from "@/domain/quick-run";
import { dependentNames, describeRouteChoice } from "@/lib/today-reason";
import { trackEvent } from "@/lib/analytics";
import { firstTimeToday, returnVisit } from "@/lib/pilot";
import { CourseFolderIcon } from "@/components/CourseFolderIcon";
import { Octicon } from "@/components/Octicon";
import { InlineName } from "@/components/InlineName";
import { toneOf } from "@/lib/topic-tone";
import { recallMap } from "@/domain/recall-map";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import { attemptedToday } from "@/lib/today-attempt";
import q from "./TodayQuiet.module.css";

const pressSpring = { type: "spring", bounce: 0, duration: 0.28 } as const;

/**
 * Today is one page: the next topic is the title.
 * Presence comes from type, paper, and interruptible motion — not chrome.
 */
/** Today's goal as a small ring that closes as topics are done: the one count a student wants to finish. */
function GoalRing({ done, goal, reduce }: { done: number; goal: number; reduce: boolean }) {
  const share = goal ? Math.min(1, done / goal) : 0;
  return (
    <svg className={q.ring} viewBox="0 0 20 20" role="progressbar" aria-label="Today’s goal" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={done}>
      <circle cx="10" cy="10" r="8" className={q.ringTrack} />
      <motion.circle cx="10" cy="10" r="8" className={q.ringFill} pathLength={1} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: Math.max(share, 0.0001) }} transition={{ type: "spring", bounce: 0, duration: 0.8 }} />
    </svg>
  );
}

/** A source named the way a student would: the course's own name when the label is just its file name. */
function sourceName(label: string, course: string) {
  const flat = (value: string) => value.toLocaleLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return course && flat(label).includes(flat(course)) ? course : label;
}

export function TodayRoute({
  route,
  concepts,
  activities,
  events,
  sessions,
  examTarget,
  targetPercent,
  daysToExam,
  onStart,
  startLabel,
  isSampleCourse = false,
  hasCoursePdf = false,
  reminder,
  examDatePending = false,
  onSetExamDate,
  focus,
  relationships = [],
  onRenameCourse,
  part = "study",
}: {
  route: RoutePlan;
  concepts: Concept[];
  activities: LearningActivity[];
  events: LearningEvent[];
  sessions: StudySession[];
  examTarget: string;
  targetPercent: number;
  daysToExam: number;
  onStart: () => void;
  startLabel?: string;
  isSampleCourse?: boolean;
  hasCoursePdf?: boolean;
  reminder?: { courseName: string; examDate: string; minutes: number };
  examDatePending?: boolean;
  onSetExamDate?: (date: string, targetPercent?: number) => void;
  focus?: RoutePlan["allocations"][number];
  relationships?: ConceptRelationship[];
  /** The course is renamed from its title here: the top bar carries no name of its own. */
  onRenameCourse?: (name: string) => void;
  /** "study": the one next topic and its action, nothing else. "later": what comes after it (tomorrow, the next
   * topics, the exam date and reminders), shown on Progress so Study stays one decision. */
  part?: "study" | "later";
}) {
  const reduceMotion = useReducedMotion();
  // The topic this card is about: the open block's current topic when there is one, else the route's first.
  const first = focus ?? route.allocations[0];
  const { visit, nowIso, missed } = useReturnVisit(events, concepts);
  const nudges = useSyncExternalStore(subscribeNudgeSettings, getNudgeSettings, getServerNudgeSettings);
  const install = useSyncExternalStore(subscribeInstall, installState, serverInstallState);
  // Nudges off when Today opened: the card stays for this visit, so turning them on is confirmed where you tapped.
  const [nudgesOffAtOpen] = useState(() => typeof window !== "undefined" && !getNudgeSettings().on);
  // When the visit opens with a warm-up, that is the one green button; the topic waits one step quieter.
  const warmupFirst = !isSampleCourse && visit.returning && visit.warmup.length > 0;
  // With today's goal done, the next topic is offered as an extra, not pressed on.
  const habit = habitSummary({ events, concepts });
  const knownLines = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missedLines = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const recall = recallMap({ concepts, activities, known: knownLines, missed, nowIso });
  const eve = !isSampleCourse && !examDatePending && daysToExam > 0 && daysToExam <= 3 && recall.total ? { days: daysToExam, recalled: recall.recalled, total: recall.total, back: recall.back } : null;
  const goalDone = !isSampleCourse && habit.goalMet;
  const goalDoneCount = habit.topicsToday;
  const openedRef = useRef(false);
  const hasPriorEvidence = !isSampleCourse && events.some((event) => event.kind === "retrieval");

  useEffect(() => {
    if (isSampleCourse || openedRef.current || part !== "study") return;
    openedRef.current = true;
    trackEvent({
      name: "today_opened",
      returning: hasPriorEvidence,
      has_next_route: route.allocations.length > 1,
    });
    // A pilot's 7-day return: coming back on a later day than a finished block, counted once a day.
    const back = returnVisit({ sessions, nowIso });
    if (back && firstTimeToday(nowIso)) trackEvent({ name: "learner_returned", ...back });
  }, [hasPriorEvidence, isSampleCourse, route.allocations.length, sessions, nowIso, part]);

  // Enter on Today starts (or continues) the next topic.
  useEffect(() => {
    if (part !== "study") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const target = event.target as HTMLElement | null;
      if (target && target !== document.body && target.closest("input, textarea, select, button, a, [contenteditable], [role=dialog]")) return;
      event.preventDefault();
      onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart, part]);

  if (!first) {
    return (
      <div className="today-route-empty materials-empty">
        <h1>Nothing ready yet.</h1>
        <p>Add a page to the binder so Kelus can open the first block.</p>
        <div className="today-route-empty-actions">
          <Link className="cta" href="/today?section=materials">
            Open binder <ArrowRight />
          </Link>
          <Link className="text-btn" href="/today?section=map">
            Open index
          </Link>
        </div>
      </div>
    );
  }

  const firstConcept = concepts.find((item) => item.id === first.conceptId);
  const firstActivity = activities.find((item) => item.conceptId === first.conceptId);
  const firstName = firstConcept?.name ?? "A mix of earlier topics";
  // The same run the session builds, so the count here is the count the student gets.
  const firstChecks = firstActivity && firstConcept
    ? buildQuickRun({ activity: firstActivity, name: firstConcept.name, siblingNames: concepts.filter((item) => item.courseId === firstConcept.courseId).map((item) => item.name), round: firstConcept.retrievalAttempts, readFirst: firstConcept.retrievalAttempts === 0 })?.checks.length ?? 0
    : 0;
  const runLine = firstChecks ? `${firstChecks} quick check${firstChecks === 1 ? "" : "s"} and 1 explanation` : "1 explanation";
  // The reason quotes the student's own last answer and names the topics that build on this one.
  const reasons = describeRouteChoice(first, firstConcept, {
    examDateKnown: !examDatePending,
    events: isSampleCourse ? [] : events,
    nowIso,
    dependents: firstConcept ? dependentNames(firstConcept.id, relationships, concepts) : [],
  });
  // A saved session may have moved to this topic without the student ever opening it.
  const decision = startLabel && !(firstConcept?.retrievalAttempts) ? ["Your session is saved. Continue with this topic."] : reasons;
  const firstSource = firstActivity?.sourceReferences[0];
  const attempt = isSampleCourse ? null : attemptedToday({ conceptId: first.conceptId, name: firstName, known: knownLines, missed: missedLines, nowIso, open: Boolean(startLabel) });
  // A mixed review is named by what it mixes: answered topics the plan does not already list on their own. With
  // none (day one, or every answered topic is already a row), it is not offered.
  const named = route.allocations.filter((allocation) => allocation.conceptId !== first.conceptId && allocation.conceptId !== "mixed-retrieval").slice(0, 3);
  const listed = new Set([first.conceptId, ...named.map((allocation) => allocation.conceptId)]);
  const mixed = concepts.filter((concept) => concept.retrievalAttempts > 0 && !listed.has(concept.id)).map((concept) => concept.name);
  const mixName = mixed.length === 1 ? `Quick review: ${mixed[0]}` : `Quick review: ${mixed[0]} and ${mixed.length - 1} more`;
  const nextStops = route.allocations.filter((allocation) => allocation.conceptId !== first.conceptId && (allocation.conceptId !== "mixed-retrieval" || mixed.length > 0)).slice(0, 3).map((allocation) => {
    const concept = concepts.find((item) => item.id === allocation.conceptId);
    return { ...allocation, name: concept?.name ?? mixName, mastery: concept?.mastery ?? 0, tried: (concept?.retrievalAttempts ?? 0) > 0 };
  });
  const today = dayKey(new Date(Date.parse(nowIso)));
  const courseIds = new Set(concepts.map((concept) => concept.id));
  const missedToday = isSampleCourse || visit.returning ? [] : missed.filter((line) => courseIds.has(line.conceptId) && dayKey(new Date(Date.parse(line.at))) === today);
  const missedTopics = [...new Set(missedToday.map((line) => concepts.find((concept) => concept.id === line.conceptId)?.name).filter(Boolean))] as string[];
  const lines = Math.min(3, missedToday.length);
  // Tomorrow, said on the day you studied: the warm-up first, then the next new topic, then how long is left.
  const studiedToday = !isSampleCourse && events.some((event) => event.kind === "retrieval" && courseIds.has(event.conceptId) && dayKey(new Date(Date.parse(event.createdAt))) === today);
  // Today's card is today's; tomorrow's new topic is the next untried one after it.
  const nextNew = nextStops.map((stop) => concepts.find((concept) => concept.id === stop.conceptId)).find((concept) => concept && concept.retrievalAttempts === 0 && concept.id !== first.conceptId)?.name;
  const examPart = !examDatePending && daysToExam > 0 ? ` Exam in ${daysToExam} ${daysToExam === 1 ? "day" : "days"}.` : "";
  const warmup = lines ? `a 1-minute warm-up on ${lines === 1 ? "the line" : `${lines} lines`} you missed today${missedTopics.length === 1 ? ` in ${missedTopics[0]}` : ""}` : "";
  const tomorrowLine = !studiedToday && !lines
    ? null
    : `Tomorrow: ${[warmup, nextNew ? (warmup ? `then ${nextNew}` : `${nextNew}, a new topic`) : ""].filter(Boolean).join(", ") || "a short review of what you did today"}.${examPart}`;
  const installable = install === "prompt" || install === "ios";
  const path = studyPath({ concepts, nowMs: Date.parse(nowIso), daysToExam: examDatePending ? null : daysToExam, doneToday: goalDoneCount });
  const level = (mastery: number, tried: boolean) => (tried ? topicLevel(mastery, 1) : "New");

  const courseName = reminder?.courseName ?? examTarget;
  const pathLine = path.daysLeft === 0
    ? "everything is solid, keep a short review going"
    : examDatePending || path.readyByMs === null
      ? `about ${path.daysLeft} study day${path.daysLeft === 1 ? "" : "s"} to cover it all`
      : path.aheadOfExam !== null && path.aheadOfExam >= 0
        ? `ready by ${new Date(path.readyByMs).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} at this pace, ${path.aheadOfExam === 0 ? "just in time" : `${path.aheadOfExam} day${path.aheadOfExam === 1 ? "" : "s"} before your exam`}`
        : `about ${path.daysLeft} study days left and ${daysToExam} until your exam`;
  const paceShort = path.daysLeft === 0
    ? "All solid"
    : examDatePending
      ? `About ${path.daysLeft} study ${path.daysLeft === 1 ? "day" : "days"} of work`
    : !examDatePending && path.readyByMs !== null && path.aheadOfExam !== null && path.aheadOfExam >= 0
      ? `Ready by ${new Date(path.readyByMs).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}`
      : `${path.daysLeft} study ${path.daysLeft === 1 ? "day" : "days"} left`;
  const ease = [0.22, 1, 0.36, 1] as const;
  // One soft settle for the whole page, in order, all done by about a quarter of a second.
  const settle = (index: number) => (reduceMotion ? {} : { initial: { opacity: 0, y: 4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18, delay: index * 0.03, ease } });
  const quietStart = warmupFirst || goalDone;

  return (
    <div className={q.page}>
      {part === "study" ? <>
      {!isSampleCourse ? <WelcomeBack visit={visit} nowIso={nowIso} nextName={firstName} /> : null}

      {/* The course, named once. Streaks, goals and pace are on Progress: Study is one decision. */}
      <motion.header className={q.head} {...settle(0)}>
        <h1 className={q.title} data-block="course-title">{hasCoursePdf ? <CourseFolderIcon /> : null}{onRenameCourse ? <InlineName value={courseName} label="Rename course" onSave={onRenameCourse} /> : <span>{courseName}</span>}</h1>
      {/* A sample says so on the page itself: the student knows these are not their notes. */}
        {isSampleCourse ? <p className={q.sample}>Sample course</p> : null}
      </motion.header>
      </> : null}

      <div className={q.desk}>
      <div className={q.lead}>
      {part === "study" ? <>
      {/* The last three days: one calm page before the plan, counted from the student's own answers. */}
      {eve ? (
        <motion.section className={q.eve} aria-labelledby="exam-eve-title" {...settle(1)}>
          <p className={q.eveKicker}>{eve.days === 1 ? "Your exam is tomorrow" : `${eve.days} days to your exam`}</p>
          <h2 id="exam-eve-title" className={q.eveTitle}>You can recall <b>{eve.recalled}</b> of {eve.total} lines.</h2>
          <p className={q.eveLine}>{eve.back ? `${eve.back} ${eve.back === 1 ? "line still comes" : "lines still come"} back. Read ${eve.back === 1 ? "it" : "them"} tonight, then one exam check.` : "Nothing is coming back. One exam check, then rest."}</p>
          <span className={q.eveBar} role="img" aria-label={`${eve.recalled} of ${eve.total} lines recalled`}><i style={{ width: `${eve.total ? (eve.recalled / eve.total) * 100 : 0}%` }} /></span>
          <p className={q.eveLinks}><Link href="/sheet">Read your sheet</Link><Link href="/today?section=map">Exam check</Link></p>
        </motion.section>
      ) : null}

      <motion.section className={q.next} data-block="today-lead" data-tone={toneOf(first.conceptId, concepts)} aria-labelledby="today-title" {...settle(1)}>
        <p className={q.eyebrow}>{startLabel ? "In progress" : goalDone ? "Extra for today" : "Due now"}</p>
        <h2 id="today-title" className={q.topic}>{firstName}</h2>
        {/* Where the questions come from, so the source is part of the decision, not a separate screen. */}
        <p className={q.source} data-block="today-page-folio">
          {firstSource ? <>From {sourceName(firstSource.label, courseName)}{firstSource.locator && !/^Section\b/.test(firstSource.locator) ? `, ${firstSource.locator.charAt(0).toLowerCase()}${firstSource.locator.slice(1)}` : ""}</> : "From your notes"}
          <span>About {first.minutes} min</span>
        </p>
        {/* What already happened on this topic today, saved answer by answer: a closed session is not a blank one. */}
        {attempt ? <p className={q.attempt} data-block="today-attempt" role="status">{attempt}</p> : null}
        {/* "Your session is saved" would only repeat the line above it. */}
        {attempt && startLabel && !(firstConcept?.retrievalAttempts) ? null : <p className={q.why} data-block="today-decision" aria-label="Why this topic is first">{decision[0]}</p>}
        <motion.button
          type="button"
          data-action="start-topic"
          aria-keyshortcuts="Enter"
          title="Enter"
          className={`k-btn ${quietStart ? `k-btn--paper ${q.go}` : q.go}`}
          onClick={onStart}
          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          transition={pressSpring}
        >
          {startLabel ? "Continue revising" : "Start revising"}
        </motion.button>
      </motion.section>

      </> : null}
      {part === "later" ? <>
      <h2 className={q.laterTitle}>Coming up</h2>
      {/* Streak, today's goal, how far through and the pace: the habit at a glance, kept off Study's one decision. */}
      <ul className={q.stats} role="group" aria-label="Your path through the course">
        <li className={habit.streak > 0 ? q.statOn : undefined} title={habit.restUsed ? "One missed day a week doesn’t break a streak." : undefined}>
          <Octicon name="flame" className={q.ico} />
          <strong>{habit.streak}</strong><span>day streak</span>
        </li>
        <li className={habit.goalMet ? q.statOn : undefined}>
          <GoalRing done={Math.min(habit.topicsToday, habit.goal)} goal={habit.goal} reduce={reduceMotion === true} />
          <strong>{Math.min(habit.topicsToday, habit.goal)}/{habit.goal}</strong><span>today</span>
        </li>
        <li title={`${path.started} of ${path.total} topics started`}>
          <Octicon name="list-unordered" className={q.ico} />
          <strong>{path.started}/{path.total}</strong><span>topics</span>
        </li>
        <li title={!examDatePending && daysToExam > 0 ? `${paceShort}, ${pathLine}` : pathLine.charAt(0).toUpperCase() + pathLine.slice(1)}>
          <Octicon name="calendar" className={q.ico} />
          <span>{!examDatePending && daysToExam > 0 ? `${daysToExam} ${daysToExam === 1 ? "day" : "days"} to exam` : paceShort}</span>
        </li>
      </ul>
      {/* Day two, shown on day one: what you missed today is what tomorrow opens with, so the plan says so now. */}
      {tomorrowLine ? (
        <motion.p className={q.tomorrow} data-block="today-tomorrow" {...settle(2)}>
          <Octicon name="calendar" className={q.ico} /><span><b>Tomorrow</b> {tomorrowLine.replace(/^Tomorrow: /, "")}</span>
        </motion.p>
      ) : !habit.goalMet && habit.streak > 0 && !habit.studiedToday ? (
        <motion.p className={`${q.tomorrow} ${q.keep}`} role="status" {...settle(2)}>
          <Octicon name="flame" className={q.ico} /><span>One topic today keeps your {habit.streak}-day streak.</span>
        </motion.p>
      ) : null}

      {nextStops.length ? (
        <motion.section className={q.then} data-block="today-next" aria-label="Planned next topics" {...settle(3)}>
          <h2 className={q.thenTitle}>After that</h2>
          <ol>
            <AnimatePresence initial={false} mode="popLayout">
            {nextStops.map((stop, index) => (
              <motion.li
                key={`${stop.conceptId}-${nextStops.slice(0, index).filter((other) => other.conceptId === stop.conceptId).length}`}
                data-tone={stop.conceptId === "mixed-retrieval" ? undefined : toneOf(stop.conceptId, concepts)}
                layout={!reduceMotion}
                initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -8, transition: { duration: 0.16 } }}
                transition={{ duration: 0.18, ease, layout: { type: "spring", stiffness: 420, damping: 38 } }}
              >
                <i className={q.num} aria-hidden="true">{stop.conceptId === "mixed-retrieval" ? <Octicon name="sync" className={q.ico} /> : index + 2}</i>
                <strong>{stop.name}</strong>
                <span className={q.pill} data-level={stop.conceptId === "mixed-retrieval" ? "review" : stop.tried ? level(stop.mastery, stop.tried).toLowerCase().replace(/\s+/g, "-") : "new"}>{stop.conceptId === "mixed-retrieval" ? "Review" : level(stop.mastery, stop.tried)}</span>
                <em>{stop.minutes} min</em>
              </motion.li>
            ))}
            </AnimatePresence>
          </ol>
        </motion.section>
      ) : null}

      {/* One extra at a time, most useful first: the exam date gives the path its finish line, then the nudge that
          brings you back, then the home-screen app, then the calendar reminder. */}
      {isSampleCourse || warmupFirst ? null
        : examDatePending && onSetExamDate ? <ExamDateCard onSave={onSetExamDate} />
        : hasPriorEvidence && (nudgesOffAtOpen || !nudges.on) && nudgesSupported() ? <NudgeCard />
        : hasPriorEvidence && installable ? <InstallCard />
        : reminder ? <ReminderCard {...reminder} nextStopName={firstName} />
        : null}
      </> : null}
      </div>
      </div>
    </div>
  );
}
