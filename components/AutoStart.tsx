"use client";

import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { hasReadingMark, takeReadingMark } from "@/lib/reading-mark";
import { createPortal } from "react-dom";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import styles from "./AutoStart.module.css";

const FLAG = "kelus-start-first-run";

function flagged() {
  try { return window.sessionStorage.getItem(FLAG) === "1"; } catch { return false; }
}

function clearFlag() {
  try { window.sessionStorage.removeItem(FLAG); } catch { /* Harmless. */ }
}

export type BuiltPlan = { course: string; topics: number; questions: number; minutes: number; firstName: string; /** Topic names, the first one first. */ names?: string[] };

/**
 * Right after new notes are read, before the first question: the student's own topics named back to them, where to
 * begin, and an explicit choice between recall and the study plan. No counts; neither path starts without a tap.
 */
export function AutoStart({ ready, plan, showPlan, onStart }: { ready: boolean; plan: BuiltPlan; /** First notes, nothing answered yet: show what was built. Otherwise (a warm-up's Continue) go straight on. */ showPlan: boolean; onStart: () => void }) {
  const reduce = useReducedMotion() === true;
  // Mounted only after the notes are read (never in the server HTML), so reading storage here is safe.
  const [open, setOpen] = useState(() => typeof window !== "undefined" && flagged());
  const fired = useRef(false);
  const mark = useRef<SVGSVGElement>(null);
  const [carried] = useState(() => typeof window !== "undefined" && !reduce && hasReadingMark());
  // The K from the reading screen does not vanish: this K starts exactly where that one was, at its size, and settles
  // into its own place. Set before the first paint, so there is no frame of it in the wrong spot.
  useLayoutEffect(() => {
    const element = mark.current;
    if (!element) return;
    const from = takeReadingMark();
    if (!from || !carried) return;
    const to = element.getBoundingClientRect();
    const dx = from.x + from.width / 2 - (to.x + to.width / 2);
    const dy = from.y + from.height / 2 - (to.y + to.height / 2);
    const scale = from.width / Math.max(1, to.width);
    // The start is written at once: an animation begins on the next frame, which would show the K in its end spot first.
    element.style.transform = `translateX(${dx}px) translateY(${dy}px) scale(${scale})`;
    const controls = animate(element, { x: [dx, 0], y: [dy, 0], scale: [scale, 1] }, { type: "spring", bounce: 0, duration: 0.7 });
    return () => controls.stop();
    // Once, when the card first appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, showPlan]);
  useEffect(() => {
    if (!open || showPlan || !ready || fired.current) return;
    fired.current = true;
    clearFlag();
    onStart();
    // Once, when Today is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, showPlan, ready]);
  if (!open || !ready) return null;
  // Going straight on: a plain cover for the instant before the question opens, so Today never flashes.
  if (!showPlan) return createPortal(<div className={styles.cover} />, document.body);

  // Time from what there is to do: about 40 seconds a question and a minute and a half to explain each topic.
  const minutes = Math.max(2, Math.ceil(plan.questions * 0.7 + plan.topics * 1.5));
  const time = minutes < 10 ? `${minutes} minutes` : `${Math.round(minutes / 5) * 5} minutes`;
  const others = (plan.names ?? []).filter((name) => name !== plan.firstName);
  const shown = others.slice(0, 4);
  const more = others.length - shown.length;
  const ease = [0.22, 1, 0.36, 1] as const;
  // When the K is carried in, the words follow it by a beat, so the eye goes K → heading → topics.
  const after = carried ? 0.22 : 0;
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay: delay + after, ease } });

  function start() { clearFlag(); onStart(); }
  function later() { clearFlag(); setOpen(false); }

  return createPortal(
    <div className={styles.cover}>
      {/* The same bar as every other screen, so this moment is still clearly Kelus, not a blank sheet. */}
      <header className={styles.bar}>
        <span className="study-brand"><KelusLogoMark /><span>kelus</span></span>
      </header>
      {/* Not a report of what was counted: the student's own topics, named back to them, and where to begin. */}
      <section className={styles.card} aria-labelledby="built-title">
        <svg ref={mark} className={styles.mark} viewBox="0 0 100 100" fill="none" aria-hidden="true">
          <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="9">
            <path d="M29 20v60" />
            <path d="M74 22C66 37 56 46 43 51c14 5 25 15 33 28" />
          </g>
        </svg>
        <motion.h1 {...rise(0.06)} id="built-title">Your study plan is ready.</motion.h1>
        <motion.p {...rise(0.1)} className={styles.how}>Want to try recall now? Kelus suggests beginning with {plan.firstName}.</motion.p>
        {shown.length ? (
          <motion.div {...rise(0.14)} className={styles.after}>
            <span>Then</span>
            <ul aria-label="The other topics in your notes">
              {shown.map((name, index) => (
                <motion.li key={name} initial={reduce ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.36, delay: 0.2 + after + index * 0.06, ease }}>{name}</motion.li>
              ))}
              {more > 0 ? <motion.li className={styles.more} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.36, delay: 0.2 + after + shown.length * 0.06 }}>and {more} more</motion.li> : null}
            </ul>
          </motion.div>
        ) : null}
        <motion.p {...rise(0.3)} className={styles.how}>Every question quotes a line from {plan.course}, and what you miss comes back tomorrow. About {time} for all of it.</motion.p>
        <motion.div {...rise(0.36)} className={styles.actions}>
          <button type="button" className="k-btn" onClick={start}>Start recall <span aria-hidden="true">→</span></button>
          <button type="button" className={styles.later} onClick={later}>See study plan</button>
        </motion.div>
      </section>
    </div>,
    document.body,
  );
}
