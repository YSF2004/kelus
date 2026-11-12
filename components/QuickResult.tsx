"use client";

import { ArrowOut, ArrowRight } from "@/components/Marks";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { MarkStamp } from "@/components/MarkStamp";
import { TopicBoxes } from "@/components/TopicBoxes";
import { PackArt } from "@/components/PackArt";
import { GoalMoment, goalMomentDue } from "@/components/GoalMoment";
import { useRouter } from "next/navigation";
import type { RetrievalOutcome } from "@/domain/types";
import type { SelfGrade } from "@/domain/quick-run";
import { verdictReason } from "@/lib/verdict";
import { Octicon } from "@/components/Octicon";
import { uiWords } from "@/lib/ui-words";
import styles from "./QuickResult.module.css";

export type { QuickStats } from "@/lib/verdict";
import type { QuickStats } from "@/lib/verdict";

const VERDICT: Record<RetrievalOutcome, { title: string }> = {
  success: { title: "Solid pass." },
  partial: { title: "Partly there." },
  failure: { title: "Needs another attempt." },
};


const ease = [0.22, 1, 0.36, 1] as const;

/** "Comes back in 2 days" → "2 days"; "Comes back tomorrow" → "Tomorrow". */
function backShort(line?: string) {
  if (!line) return "Soon";
  const rest = line.replace(/^Comes back\s*/i, "").replace(/^in\s+/i, "").replace(/^your next session$/i, "Next time");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/** A number that counts up to itself once, quickly: the score lands rather than appears. */
function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(0);
  const still = reduce || value <= 0;
  useEffect(() => {
    if (still) return;
    const controls = animate(0, value, { duration: Math.min(0.9, 0.25 + value * 0.08), ease: [0.22, 1, 0.36, 1], delay: 0.25, onUpdate: (latest) => setShown(Math.round(latest)) });
    return () => controls.stop();
  }, [value, still]);
  return <>{still ? value : shown}</>;
}

/** A solid pass, celebrated the Kelus way: a few paper marks in the brand colours spring out from the seal and settle. */
function Burst() {
  const marks = Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2 + 0.3;
    const reach = 46 + (index % 3) * 12;
    return { x: Math.cos(angle) * reach, y: Math.sin(angle) * reach, rotate: (index % 2 ? 1 : -1) * (20 + index * 9), tone: index % 3 };
  });
  return (
    <span className={styles.burst} aria-hidden="true">
      {marks.map((mark, index) => (
        <motion.i
          key={index}
          data-tone={mark.tone}
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 0, rotate: 0 }}
          animate={{ x: mark.x, y: mark.y, scale: [0.4, 1, 0.8], opacity: [0, 1, 0], rotate: mark.rotate }}
          transition={{ duration: 0.9, delay: 0.15 + index * 0.012, ease: [0.22, 1, 0.36, 1], times: [0, 0.35, 1] }}
        />
      ))}
    </span>
  );
}

/**
 * The reward moment after a topic: how the checks went as filling dots, how you rated yourself, the one thing to
 * remember (quoted from your notes), today's goal filling up, and a single next step. Detail is one tap away.
 */
export function QuickResult({
  outcome, topic, attempts, stats, comesBack, remember, rememberLabel = "Worth remembering", locator, goalDone, goal, routeLine, routeReason, nextName, details, onRetry, onContinue, onSource, path, habit, conceptId }: {
  outcome: RetrievalOutcome;
  topic: string;
  /** How many times this topic has been answered, counting this one. */
  attempts: number;
  stats: QuickStats | null;
  /** When the topic is next due, from the real schedule. */
  comesBack?: string;
  remember: string;
  /** What the quote is: a line to look at again, a new line, or the main idea. */
  rememberLabel?: string;
  locator: string;
  goalDone: number;
  goal: number;
  routeLine: string;
  /** The evidence that earned the route decision, written for the student rather than as a score. */
  routeReason?: string;
  nextName?: string;
  details: ReactNode;
  onRetry: () => void;
  onContinue: () => void;
  onSource?: () => void;
  /** The day so far, for the moment today's goal closes: shown once a day, on the topic that completes it. */
  habit?: { today: string; streak: number; week: Array<{ key: string; label: string; studied: boolean; today: boolean }>; backTomorrow: number };
  /** Where this topic leaves you on the course path: topics practised of all, and lines answered correctly. */
  /** This topic, so its lines can be shown in their Leitner boxes after the answers are saved. */
  conceptId?: string;
  path?: { practised: number; total: number; recalled: number; /** This topic's place on the path, from 0. */ here?: number; /** Each topic, in order: practised or not. */ done?: boolean[] };
}) {
  const reduce = useReducedMotion() === true;
  const w = uiWords();
  const verdict = { title: outcome === "success" ? w.solid : outcome === "partial" ? w.partlyThere : w.again };
  // The verdict is readable at once; the rest follows in a short stagger, all settled within about half a second.
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, delay: delay * 0.3, ease } });
  const goalMet = goalDone >= goal;
  // A reroute is the product's most important proof. Say it on the result itself,
  // before the optional audit trail below, rather than leaving it as quiet metadata.
  const routeChanged = !/^Next:\s/i.test(routeLine.trim());
  const router = useRouter();
  // Decided once, when the result opens: the moment marks the day as seen, and must not vanish under itself.
  const [moment, setMoment] = useState(() => Boolean(habit) && goalDone === goal && goalMomentDue(habit!.today));

  return (
    <>
    {moment && habit ? (
      <GoalMoment
        today={habit.today}
        streak={habit.streak}
        goal={goal}
        week={habit.week}
        backTomorrow={habit.backTomorrow}
        nextName={nextName}
        onContinue={() => { setMoment(false); onContinue(); }}
        onDone={() => { setMoment(false); router.push("/today"); }}
      />
    ) : null}
    <div className={styles.card} inert={moment || undefined} aria-hidden={moment || undefined}>
      <div className={styles.head}>
        <span className={styles.stamp}><MarkStamp outcome={outcome} />{outcome === "success" && !reduce ? <Burst /> : null}</span>
        <motion.h1 {...rise(0.1)} className={styles.title}>{verdict.title}</motion.h1>
      </div>
      {/* The sentence for screen readers; the eye gets the same facts as three tiles. */}
      <p className="sr-only">{topic} · {attempts === 1 ? "first try" : `try ${attempts}`}. {verdictReason(outcome, stats, comesBack)}</p>
      <motion.ul {...rise(0.16)} className={styles.tiles} aria-hidden="true">
        {stats && stats.total > 0 ? <li><Octicon name="check-circle" className={styles.tileIcon} /><b><CountUp value={stats.right} reduce={reduce} />/{stats.total}</b><span>{stats.total === 1 ? w.checkRight : w.checksRight}</span></li> : null}
        {stats?.coverage && stats.coverage.keys >= 3 ? <li><Octicon name="pencil" className={styles.tileIcon} /><b><CountUp value={stats.coverage.hits} reduce={reduce} />/{stats.coverage.keys}</b><span>{w.keyIdeas}</span></li> : null}
        {/* When it comes back is said once: in the lines' own box below, when there is one; a tile only without it. */}
        {conceptId ? null : <li><Octicon name="calendar" className={styles.tileIcon} /><b className={/^\d/.test(backShort(comesBack)) ? undefined : styles.tileWord}>{backShort(comesBack)}</b><span>{w.comesBack}</span></li>}
      </motion.ul>


      <motion.blockquote {...rise(0.42)} className={styles.remember}>
        <span className={styles.rememberHead}><PackArt name="clipboard-check" className={styles.icon} />{rememberLabel}{/^Section\b/.test(locator) ? "" : `, ${locator.charAt(0).toLowerCase()}${locator.slice(1)}`}</span>
        <p>“{remember}”</p>
        {onSource ? <button type="button" className={styles.sourceLink} onClick={onSource}>Check this line in your notes <ArrowOut /></button> : null}
      </motion.blockquote>

      {/* Correction only earns trust when the consequence is as visible as the source. */}
      {/* Even when the next topic does not move, explain what this answer earned. */}
      {nextName && routeLine.trim() === `Next: ${nextName}.` && !routeReason ? null : (
        <motion.aside {...rise(0.54)} className={styles.route} role="status" aria-label={routeChanged ? "Your plan changed" : "Next in your plan"}>
          <span>{routeChanged ? "Your plan changed" : "Next in your plan"}</span>
          <p>{routeLine}</p>
          {routeReason ? <p className={styles.routeReason}>{routeReason}</p> : null}
        </motion.aside>
      )}

      {/* Today's count lives on the study plan; here it only shows the moment the goal is reached. */}
      {goalMet ? <motion.p {...rise(0.62)} className={styles.goal}><PackArt name="award" className={styles.icon} /> Today’s goal reached: {goal} topics.</motion.p> : null}

      {conceptId ? <motion.div {...rise(0.46)}><TopicBoxes conceptId={conceptId} back={comesBack} /></motion.div> : null}
      {/* The course path in one line: a step for every topic, filled as each is practised. */}
      {path && path.total > 1 ? (
        <motion.div {...rise(0.68)} className={styles.path} aria-label={`${path.practised} of ${path.total} topics practiced`}>
          <span className={styles.pathSteps} aria-hidden="true">
            {/* One step per topic, in the order of the notes; this topic's step is marked. Practised steps fill. */}
            {path.total <= 24 ? Array.from({ length: path.total }, (_, index) => <i key={index} data-here={index === path.here ? "true" : undefined} data-done={(path.done?.[index] ?? index < path.practised) ? "true" : undefined} />) : <i className={styles.pathFill} style={{ ["--share" as string]: path.practised / path.total }} />}
          </span>
          <span>{w.practised(path.practised, path.total)}{path.recalled ? `, ${path.recalled} ${path.recalled === 1 ? "line" : "lines"} answered correctly` : ""}</span>
        </motion.div>
      ) : null}

      <div className={styles.actions}>
        {outcome !== "success" ? <button type="button" className={`k-btn k-btn--paper ${styles.secondary}`} onClick={onRetry}>{w.tryAgain}</button> : null}
        <button type="button" className={`k-btn ${styles.primary}`} onClick={onContinue}>{nextName ? w.continueTo(nextName) : w.finish} <ArrowRight /></button>
      </div>

      <details className={styles.more}>
        <summary>{w.changed}</summary>
        <div className={styles.moreBody}>{details}</div>
      </details>
    </div>
    </>
  );
}
