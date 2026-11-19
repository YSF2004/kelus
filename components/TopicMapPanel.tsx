"use client";

import { primaryActivitySourceReference } from "@/domain/source-reference";
import { ArrowRight } from "@/components/Marks";
import { topicLevel } from "@/lib/format";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useLearner } from "@/components/LearnerProvider";
import { ConceptTitleTransition } from "@/components/PageTransition";
import { generateRoute } from "@/domain/routing-engine";
import { AnkiExport } from "@/components/AnkiExport";
import { freshOpenSession, restAware, restingTopics, resumeConceptId } from "@/lib/today-focus";
import { describeRouteChoice } from "@/lib/today-reason";
import { percent } from "@/lib/format";
import { useCallback, useState, useSyncExternalStore } from "react";
import { getKnownLines, getServerKnownLines, knownCount, subscribeKnownLines } from "@/lib/known-lines";
import { checkpointKey, getCheckpoints, getServerCheckpoints, PASS_SHARE, passed, subscribeCheckpoints } from "@/lib/checkpoints";
import { Tick } from "@/components/Marks";
import { ExamBrief } from "@/components/ExamBrief";
import type { CourseMaterial, LearningActivity } from "@/domain/types";
import type { PastPaperExamBrief } from "@/domain/past-paper";

/** "today", "yesterday", "3 days ago": when a checkpoint was last run. */
function whenAgo(at: string, nowIso: string) {
  const day = (iso: string) => { const d = new Date(iso); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const days = Math.round((day(nowIso) - day(at)) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : days < 7 ? `${days} days ago` : days < 14 ? "last week" : `${Math.round(days / 7)} weeks ago`;
}
import { Octicon } from "@/components/Octicon";
import styles from "./TopicMapPanel.module.css";


/** Mastery as a ring. No evidence means an empty dashed ring, never a made-up number. */
function MasteryRing({ value }: { value: number | null }) {
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className={styles.ring} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <circle className={styles.ringTrack} cx="20" cy="20" r={radius} />
      {value == null ? <circle className={styles.ringDot} cx="20" cy="20" r="3" /> : null}
      {value != null ? (
        <circle
          className={styles.ringArc}
          cx="20"
          cy="20"
          r={radius}
          // A sliver under 8% reads as a stray tick, not a little progress.
          strokeDasharray={`${Math.max(0.08, value) * circumference} ${circumference}`}
          transform="rotate(-90 20 20)"
        />
      ) : null}
    </svg>
  );
}

/**
 * Topics as a path in the order of your notes: each topic a step with how it stands, a checkpoint after every three,
 * and an exam check at the end. A direct action opens the same next study session as the Study plan.
 */
export function TopicMapPanel({ onStart, startLabel, sampleCourse = false, pastPapers = [], activities = [] }: { onStart?: () => void; startLabel?: string; sampleCourse?: boolean; pastPapers?: CourseMaterial[]; activities?: LearningActivity[] } = {}) {
  const { state, removeTopic } = useLearner();
  const reduce = useReducedMotion() === true;
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const results = useSyncExternalStore(subscribeCheckpoints, getCheckpoints, getServerCheckpoints);
  const [examCoverage, setExamCoverage] = useState<Record<string, number>>({});
  const receiveCoverage = useCallback((topics: PastPaperExamBrief["topics"]) => {
    const next = Object.fromEntries(topics.map((topic) => [topic.conceptId, topic.promptCount]));
    setExamCoverage((current) => {
      const currentEntries = Object.entries(current);
      const nextEntries = Object.entries(next);
      return currentEntries.length === nextEntries.length && currentEntries.every(([id, count]) => next[id] === count) ? current : next;
    });
  }, []);
  const course = state.snapshot.courses[0];
  if (!course) return <p>No active course.</p>;

  const concepts = state.snapshot.concepts
    .filter((concept) => concept.courseId === course.id);
  const exam = state.snapshot.exams.find((item) => item.courseId === course.id && item.isActive);
  const routeStart = exam
    ? restAware(generateRoute({
        concepts,
        relationships: state.snapshot.relationships,
        events: state.snapshot.events,
        exam,
        nowIso: state.nowIso,
      }).allocations, state.snapshot.events, state.nowIso, concepts).find((item) => item.conceptId !== "mixed-retrieval")
    : undefined;
  // Answered in the last few hours: resting, not "due" yet, whatever the schedule says.
  const resting = restingTopics(state.snapshot.events, state.nowIso);
  // With a block open, "Start here" is the topic Continue opens on Today, not the one just answered.
  const openBlock = freshOpenSession(state.snapshot.sessions, course.id, state.nowIso);
  const resumeId = resumeConceptId(openBlock, state.snapshot.events);
  const startAllocation = resumeId ? (routeStart?.conceptId === resumeId ? routeStart : openBlock?.latestRoute.allocations.find((item) => item.conceptId === resumeId) ?? routeStart) : routeStart;
  const startConceptId = startAllocation?.conceptId ?? concepts[0]?.id ?? null;

  if (!concepts.length) {
    return (
      <div className="surface-map is-toc is-empty">
        <p>No topics yet. Add a page in the binder, then confirm what this exam covers.</p>
        <Link className="cta" href="/today?section=materials">
          Open binder <ArrowRight />
        </Link>
      </div>
    );
  }

  const rows = concepts.map((concept) => {
    const activity = state.snapshot.learningActivities.find((item) => item.conceptId === concept.id);
    const reference = primaryActivitySourceReference(activity);
    const locator = reference?.locator?.trim();
    const due = concept.retrievalAttempts > 0 && !resting.has(concept.id) && Boolean(concept.nextReviewAt) && Date.parse(concept.nextReviewAt!) <= Date.parse(state.nowIso);
    return {
      concept,
      label: topicLevel(concept.mastery, concept.retrievalAttempts),
      mastery: concept.retrievalAttempts > 0 ? concept.mastery : null,
      source: reference
        ? [reference.label.trim(), locator && !/not your upload|from filename/i.test(locator) && !/^Section\b/.test(locator) ? locator : null]
            .filter(Boolean)
            .join(" · ")
        : null,
      due,
    };
  });
  // The path follows the notes: the order the topics were read from, not their estimated weight.
  const order = new Map(state.snapshot.concepts.map((concept, position) => [concept.id, position]));
  const path = [...rows].sort((x, y) => (order.get(x.concept.id) ?? 0) - (order.get(y.concept.id) ?? 0));
  const practised = path.filter((row) => row.concept.retrievalAttempts > 0).length;
  const solid = path.filter((row) => row.label === "Solid").length;
  const recalled = knownCount(known, new Set(path.map((row) => row.concept.id)));
  const start = rows.find((row) => row.concept.id === startConceptId);
  const startReason = start && startAllocation && start.concept.retrievalAttempts > 0 ? describeRouteChoice(startAllocation, start.concept, { events: state.snapshot.events, nowIso: state.nowIso, sampleCourse, examDateKnown: !state.snapshot.exams.some((item) => item.isActive && item.datePlaceholder) })[0] : null;
  // A checkpoint after every three topics: two lines from each, mixed. It opens once those three are practised.
  const GROUP = 3;
  const passedCount = results.filter((result) => passed(result) && result.key.split(",").every((id) => path.some((row) => row.concept.id === id))).length;
  const groups = Array.from({ length: Math.floor(path.length / GROUP) }, (_, index) => path.slice(index * GROUP, index * GROUP + GROUP));

  const checkpoint = (topics: typeof path, label: string, each: number, key: string) => {
    const left = topics.filter((row) => row.concept.retrievalAttempts === 0).length;
    const ids = topics.map((row) => row.concept.id);
    const lines = knownCount(known, new Set(ids));
    const last = results.find((result) => result.key === checkpointKey(ids));
    const done = passed(last);
    const href = `/session/warmup?checkpoint=${ids.map(encodeURIComponent).join(",")}${each === 1 ? "&each=1" : ""}&label=${encodeURIComponent(label)}`;
    const first = path.indexOf(topics[0]) + 1;
    const scope = topics.length === path.length ? "Every topic" : `Topics ${first}–${first + topics.length - 1}`;
    const need = last ? Math.max(1, Math.ceil(last.total * PASS_SHARE)) : 0;
    const status = done ? "passed" : last ? "tried" : left === 0 ? "ready" : "locked";
    return (
      <li key={key} className={styles.checkpoint} data-state={status} data-ready={left === 0 ? "true" : undefined}>
        <span className={styles.diamond} aria-hidden="true">{done ? <Tick size={10} /> : null}</span>
        <span className={styles.checkpointText}>
          <strong>{label}{done ? <em className={styles.passed}>Passed</em> : null}</strong>
          <span>
            {last
              ? `${last.right} of ${last.total} from memory, ${whenAgo(last.at, state.nowIso)}${done ? "" : ` · pass at ${need} of ${last.total}`}`
              : left === 0 ? `${scope}, mixed${lines ? ` · ${lines} ${lines === 1 ? "line" : "lines"} answered correctly` : ""}` : `Unlocks after ${left} more ${left === 1 ? "topic" : "topics"}`}
          </span>
        </span>
        {left === 0 ? <Link className={`k-btn ${done ? "k-btn--paper " : ""}${styles.checkpointGo}`} href={href} aria-label={`${done ? "Run again" : last ? "Try again" : "Start"}: ${label}`}>{done ? "Again" : last ? "Try again" : "Start"} {done ? null : <ArrowRight />}</Link> : null}
      </li>
    );
  };

  return (
    <div className="surface-map is-toc source-topic-map">
      <ExamBrief papers={pastPapers} concepts={concepts} activities={activities} onCoverageChange={receiveCoverage} />
      <div className={styles.pathHead} role="group" aria-label={sampleCourse ? "Sample course progress" : "Where you are"}>
        <p className="sr-only">{practised} of {path.length} topics practiced{solid ? `, ${solid} solid` : ""}{recalled ? `, ${recalled} ${recalled === 1 ? "line" : "lines"} answered correctly` : ""}{passedCount ? `, ${passedCount} ${passedCount === 1 ? "checkpoint" : "checkpoints"} passed` : ""}.</p>
        <ul className={styles.stats} aria-hidden="true">
          <li><Octicon name="list-unordered" className={styles.ico} /><strong>{practised}/{path.length}</strong><span>practiced</span></li>
          {solid ? <li data-tone="green"><Octicon name="check-circle" className={styles.ico} /><strong>{solid}</strong><span>solid</span></li> : null}
          {recalled ? <li><Octicon name="check-circle" className={styles.ico} /><strong>{recalled}</strong><span>{recalled === 1 ? "line" : "lines"} recalled</span></li> : null}
          {passedCount ? <li data-tone="marigold"><Octicon name="trophy" className={styles.ico} /><strong>{passedCount}</strong><span>{passedCount === 1 ? "checkpoint" : "checkpoints"}</span></li> : null}
        </ul>
        {/* Two tones: solid topics in green, practised ones lighter. A path is not done while its topics need work. */}
        <span className={styles.pathBar} aria-hidden="true">
          <motion.i className={styles.pathPractised} initial={false} animate={{ scaleX: path.length ? practised / path.length : 0 }} transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }} />
          <motion.i className={styles.pathSolid} initial={false} animate={{ scaleX: path.length ? solid / path.length : 0 }} transition={{ duration: reduce ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }} />
        </span>
      </div>

      {start ? (
        <section className={styles.nextStep} aria-label="Next study step">
          <div className={styles.nextStepCopy}>
            <span className={styles.nextStepLabel}>Next to practise</span>
            <strong>{start.concept.name}</strong>
            <span className={styles.nextStepReason}>{startReason ?? "First in your current study plan."}</span>
          </div>
          {onStart ? (
            <button type="button" className={`k-btn ${styles.nextStepButton}`} onClick={onStart}>
              {startLabel ?? "Start session"} <ArrowRight />
            </button>
          ) : (
            <Link href="/today" className={`k-btn ${styles.nextStepButton}`}>
              Open study plan <ArrowRight />
            </Link>
          )}
        </section>
      ) : null}

      {/* The path follows the notes; each row shows its current state and source. */}
      <ol className={`index-toc ${styles.path}`} aria-label={sampleCourse ? "Topics in the order of the built-in example" : "Topics, in the order of your notes"}>
        <AnimatePresence initial={false} mode="popLayout">
        {path.flatMap(({ concept, mastery, label, source, due }, index) => {
          const isStart = startConceptId === concept.id;
          const checks = concept.retrievalAttempts;
          const row = (
            <motion.li
              key={concept.id}
              layout={!reduce}
              className={`${styles.step}${isStart ? ` ${styles.here}` : ""}`}
              data-state={checks === 0 ? "new" : label === "Solid" ? "solid" : "practised"}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, scale: 0.96, transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }}
              transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 8) * 0.025, layout: { type: "spring", bounce: 0, duration: 0.35 } }}
            >
              <span className={styles.node}><MasteryRing value={mastery} /><b aria-hidden="true">{index + 1}</b></span>
              <Link href={`/concept?id=${encodeURIComponent(concept.id)}`} className={`index-toc-row ${styles.stepLink}`}>
                <ConceptTitleTransition id={concept.id}>
                  <strong className="index-toc-name">{concept.name}</strong>
                </ConceptTitleTransition>
                <span className="index-toc-meta">
                  <span className={styles.state} data-level={isStart ? "next" : label.toLocaleLowerCase().replace(/\s+/g, "-")}>{isStart ? "Start here" : label}</span>
                  {mastery == null ? null : <span className={styles.metaSoft}>{checks < 3 ? `${checks} ${checks === 1 ? "try" : "tries"}` : percent(mastery)}</span>}
                  {examCoverage[concept.id] ? <span className={styles.examEvidence}>In {examCoverage[concept.id]} past-paper prompt{examCoverage[concept.id] === 1 ? "" : "s"}</span> : null}
                  {source ? <span className={styles.source}><Octicon name="file" className={styles.icoSm} />{source}</span> : null}
                </span>
                {isStart && startReason ? <span className={styles.why}>{startReason}</span> : null}
                {due ? <span className={styles.due}>Review due</span> : null}
              </Link>
              <button type="button" className={styles.remove} onClick={() => removeTopic(concept.id)} aria-label={`Remove ${concept.name}`} title="Remove topic (you can undo)">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </motion.li>
          );
          const groupIndex = (index + 1) / GROUP - 1;
          const closesGroup = Number.isInteger(groupIndex) && groups[groupIndex] && !(path.length === GROUP);
          return closesGroup ? [row, checkpoint(groups[groupIndex], `Checkpoint ${groupIndex + 1}`, 2, `cp-${groupIndex}`)] : [row];
        })}
        </AnimatePresence>
        {path.length >= 2 ? checkpoint(path, "Exam check", 1, "exam") : null}
      </ol>
      {/* Every topic in the student's own words, ready to read the night before or print. */}
      <div className={styles.sheetLink}><span><strong>Your revision sheet</strong><small>Every topic in your own words, ready to print</small></span><Link href="/sheet" className="k-btn k-btn--paper k-btn--small">Open the sheet</Link></div>
      <AnkiExport course={course.name} concepts={concepts} activities={state.snapshot.learningActivities} />
    </div>
  );
}
