"use client";

import { ArrowOut, ArrowRight } from "@/components/Marks";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { MarkStamp } from "@/components/MarkStamp";
import { PackArt } from "@/components/PackArt";
import { GoalMoment, goalMomentDue } from "@/components/GoalMoment";
import { useRouter } from "next/navigation";
import type { RetrievalOutcome } from "@/domain/types";
import type { SelfGrade } from "@/domain/quick-run";
import { verdictReason } from "@/lib/verdict";
import { uiWords } from "@/lib/ui-words";
import type { NoteLanguage } from "@/domain/note-language";
import type { RouteChange } from "@/lib/route-change";
import styles from "./QuickResult.module.css";

/**
 * The topics still to come, shown in the order they were in, then moving to the order they are in now: the change an
 * answer made, seen rather than announced. Reduced motion shows the new order at once.
 */
function Reorder({ change, reduce }: { change: RouteChange; reduce: boolean }) {
  const [order, setOrder] = useState(reduce ? change.after : change.before);
  useEffect(() => {
    if (reduce) return;
    const timer = window.setTimeout(() => setOrder(change.after), 450);
    return () => window.clearTimeout(timer);
  }, [change, reduce]);
  return (
    <section className={styles.reorder} aria-label="How your answer changed the rest of this session">
      <p role="status">{change.text}</p>
      <ol aria-label={`Up next, in order: ${change.after.join(", ")}`}>
        {order.map((name, index) => (
          <motion.li key={name} layout={!reduce} transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }} data-moved={name === change.moved ? "true" : undefined}>
            <span aria-hidden="true">{index + 1}</span>{name}
          </motion.li>
        ))}
      </ol>
    </section>
  );
}

export type { QuickStats } from "@/lib/verdict";
import type { QuickStats } from "@/lib/verdict";

const VERDICT: Record<RetrievalOutcome, { title: string }> = {
  success: { title: "Solid pass." },
  partial: { title: "Partly there." },
  failure: { title: "Needs another attempt." },
};


const ease = [0.22, 1, 0.36, 1] as const;

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
  outcome, topic, attempts, stats, comesBack, remember, rememberLabel = "Worth remembering", locator, goalDone, goal, routeLine, nextName, reorder, details, onRetry, onContinue, onSource, path, habit, language = "en", conceptId }: {
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
  nextName?: string;
  /** The rest of the session reordered by this answer, before and after. Absent when nothing moved. */
  reorder?: RouteChange | null;
  details: ReactNode;
  onRetry: () => void;
  onContinue: () => void;
  onSource?: () => void;
  /** The day so far, for the moment today's goal closes: shown once a day, on the topic that completes it. */
  habit?: { today: string; streak: number; week: Array<{ key: string; label: string; studied: boolean; today: boolean }>; backTomorrow: number };
  /** The notes' language: the screen's own words follow it. */
  language?: NoteLanguage;
  /** Where this topic leaves you on the course path: topics practised of all, and lines answered correctly. */
  /** This topic, so its lines can be shown in their Leitner boxes after the answers are saved. */
  conceptId?: string;
  path?: { practised: number; total: number; recalled: number; /** This topic's place on the path, from 0. */ here?: number; /** Each topic, in order: practised or not. */ done?: boolean[] };
}) {
  const reduce = useReducedMotion() === true;
  const w = uiWords(language);
  const verdict = { title: outcome === "success" ? w.solid : outcome === "partial" ? w.partlyThere : w.again };
  // The verdict is readable at once; the rest follows in a short stagger, all settled within about half a second.
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, delay: delay * 0.3, ease } });
  const goalMet = goalDone >= goal;
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
      {/* The result in one plain sentence, from what was answered: no tiles, no score to decode. */}
      <motion.p {...rise(0.16)} className={styles.reason}>{verdictReason(outcome, stats, comesBack)}</motion.p>


      <motion.blockquote {...rise(0.42)} className={styles.remember}>
        <span className={styles.rememberHead}><PackArt name="clipboard-check" className={styles.icon} />{rememberLabel}{/^Section\b/.test(locator) ? "" : `, ${locator.charAt(0).toLowerCase()}${locator.slice(1)}`}</span>
        <p>“{remember}”</p>
      </motion.blockquote>

      {/* Today's count lives on the study plan; here it only shows the moment the goal is reached. */}
      {goalMet ? <motion.p {...rise(0.54)} className={styles.goal}><PackArt name="award" className={styles.icon} /> Today’s goal reached: {goal} topics.</motion.p> : null}

      {/* Where this leaves the course (boxes, the path, the schedule) is on Progress; this screen is about this topic. */}

      {/* "Next: X." would only repeat the button below it. */}
      {reorder ? <Reorder change={reorder} reduce={reduce} /> : nextName && routeLine.trim() === `Next: ${nextName}.` ? null : <p className={styles.route} role="status">{routeLine}</p>}

      <div className={styles.actions}>
        {outcome !== "success" ? <button type="button" className={`k-btn k-btn--paper ${styles.secondary}`} onClick={onRetry}>{w.tryAgain}</button> : null}
        <button type="button" className={`k-btn ${styles.primary}`} onClick={onContinue}>{nextName ? w.continueTo(nextName) : w.finish} <ArrowRight /></button>
      </div>

      <details className={styles.more}>
        <summary>{w.changed}</summary>
        <div className={styles.moreBody}>{details}</div>
        {onSource ? <button type="button" className={styles.link} onClick={onSource}>Review the source behind this topic <ArrowOut /></button> : null}
      </details>
    </div>
    </>
  );
}
