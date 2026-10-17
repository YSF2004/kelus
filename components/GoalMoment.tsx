"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "@/components/Marks";
import { Octicon } from "@/components/Octicon";
import { play } from "@/lib/sound";
import styles from "./GoalMoment.module.css";

const SEEN_KEY = "kelus-goal-moment";

/** Shown once a day: the topic that completes today's goal, never the ones after it. */
export function goalMomentDue(today: string) {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(SEEN_KEY) !== today; } catch { return true; }
}

function markSeen(today: string) {
  try { window.localStorage.setItem(SEEN_KEY, today); } catch { /* private mode: it may show again, which is fine */ }
}

/**
 * The day's goal, closed: the moment a student is meant to feel. The flame springs up, the streak counts to its new
 * number, the week fills in day by day, and the next step is the same one the result offered. Calm, a second long,
 * and over at once if you reduce motion or press a key.
 */
export function GoalMoment({ today, streak, goal, week, backTomorrow, nextName, onContinue, onDone }: {
  today: string;
  streak: number;
  goal: number;
  week: Array<{ key: string; label: string; studied: boolean; today: boolean }>;
  backTomorrow: number;
  nextName?: string;
  onContinue: () => void;
  onDone: () => void;
}) {
  const reduce = useReducedMotion() === true;
  const [shown, setShown] = useState(reduce ? streak : Math.max(0, streak - 1));
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    markSeen(today);
    play("done");
    button.current?.focus();
    if (reduce) return;
    const controls = animate(Math.max(0, streak - 1), streak, { duration: 0.6, delay: 0.45, ease: [0.22, 1, 0.36, 1], onUpdate: (value) => setShown(Math.round(value)) });
    return () => controls.stop();
  }, [today, streak, reduce]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onDone(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { type: "spring" as const, bounce: 0, duration: 0.45, delay } });

  return (
    <motion.div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="goal-moment-title" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      <div className={styles.sheet}>
        <motion.span
          className={styles.flame}
          aria-hidden="true"
          initial={reduce ? false : { scale: 0.3, rotate: -12, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", bounce: 0.35, duration: 0.7, delay: 0.1 }}
        >
          <Octicon name="flame" size={56} />
          {reduce ? null : <motion.i className={styles.glow} initial={{ scale: 0.6, opacity: 0.7 }} animate={{ scale: 1.8, opacity: 0 }} transition={{ duration: 1.1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }} />}
        </motion.span>

        <motion.p className={styles.count} {...rise(0.3)} aria-hidden="true"><b>{shown}</b> day streak</motion.p>
        <motion.h2 id="goal-moment-title" className={styles.title} {...rise(0.4)}>Today’s goal, done.</motion.h2>
        <p className="sr-only">{goal} topics today. {streak}-day streak.</p>

        <motion.ol className={styles.week} aria-label="This week" {...rise(0.5)}>
          {week.map((day, index) => (
            <li key={day.key} data-studied={day.studied ? "true" : undefined} data-today={day.today ? "true" : undefined} aria-label={`${day.today ? "Today" : day.label}: ${day.studied ? "studied" : "not studied"}`}>
              <motion.i
                aria-hidden="true"
                initial={reduce || !day.studied ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.3, duration: 0.45, delay: 0.6 + index * 0.06 }}
              >{day.studied ? <Octicon name="check" size={12} /> : null}</motion.i>
              <span>{day.label}</span>
            </li>
          ))}
        </motion.ol>

        <motion.p className={styles.note} {...rise(0.65)}>
          {backTomorrow > 0 ? `${backTomorrow} ${backTomorrow === 1 ? "topic comes" : "topics come"} back tomorrow.` : "Come back tomorrow to keep it going."}
        </motion.p>

        <motion.div className={styles.actions} {...rise(0.75)}>
          <button ref={button} type="button" className={`k-btn ${styles.go}`} onClick={onContinue}>{nextName ? `Continue to ${nextName}` : "Finish block"} <ArrowRight /></button>
          <button type="button" className={styles.done} onClick={onDone}>Done for today</button>
        </motion.div>
      </div>
    </motion.div>
  );
}
