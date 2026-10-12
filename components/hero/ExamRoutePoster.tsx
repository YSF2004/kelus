"use client";

import { useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import styles from "./MarkedScriptHero.module.css";

const OPTIONS = [
  { text: "Buyers can switch to another option when the price rises.", right: true },
  { text: "Sellers are allowed to charge more.", right: false },
  { text: "Buyers like the product less.", right: false },
] as const;

/** An illustrative source-to-route journey; the real upload begins at /today. */
export function ExamRoutePoster() {
  const sheetRef = useRef<HTMLDivElement>(null);
  const inView = useInView(sheetRef, { once: true, amount: 0.3 });
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const gotIt = answered && OPTIONS[picked].right;
  // The server and first client render must agree; reduced motion changes only timing.
  const settled = inView;

  return (
    <figure
      className={styles.script}
      role="group"
      aria-label="Sample Microeconomics journey: a PDF becomes a recall question, and your answer changes the route."
    >
      <motion.div
        ref={sheetRef}
        className={styles.sheet}
        initial={false}
        animate={{ opacity: settled ? 1 : 0.92, y: settled ? 0 : 8 }}
        transition={{ duration: reduceMotion ? 0 : 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className={styles.sheetTopline}>
          <span>PDF or notes <span aria-hidden="true">→</span> Recall <span aria-hidden="true">→</span> Study plan</span>
          <span>Illustrative example</span>
        </div>

        <div className={styles.source}>
          <div className={styles.sourceHeading}>
            <span className={styles.sourceLabel}>Start with a PDF or notes</span>
            <span className={styles.sourceStep}>Your material</span>
          </div>
          <motion.div
            className={styles.sourceFile}
            initial={false}
            animate={{ opacity: settled ? 1 : 0.82, y: settled ? 0 : -8 }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className={styles.fileIcon} aria-hidden="true">
              <svg viewBox="0 0 32 38" fill="none"><path d="M5 1.5h14l8 8V36.5H5z"/><path d="M19 1.5v8h8M10 18h12M10 23h12M10 28h8"/></svg>
            </span>
            <span className={styles.fileText}><strong>Microeconomics lecture.pdf</strong><small>Sample material · Lecture 06</small></span>
            <span className={styles.sourceArrow} aria-hidden="true">↓</span>
          </motion.div>
        </div>

        <div className={styles.note}>
          <span className={styles.noteLabel}>Kelus finds a topic in your notes</span>
          <p>Close substitutes make demand <span className={styles.highlight}>more responsive<motion.span
            className={styles.highlightStroke}
            data-cue="source"
            initial={false}
            animate={{ scaleX: settled ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          /></span> to a price change.</p>
        </div>

        <div className={styles.recall}>
          <motion.span
            className={styles.recallRule}
            data-cue="recall"
            initial={false}
            animate={{ scaleY: settled ? 1 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
          />
          <span className={styles.recallLabel}>Then asks you to recall it</span>
          <p>Why does having another option make demand more elastic?</p>
          <div className={styles.options} role="group" aria-label="Choose one">
            {OPTIONS.map((option, index) => {
              const state = !answered ? "" : option.right ? styles.optionRight : index === picked ? styles.optionWrong : styles.optionDim;
              return (
                <button key={option.text} type="button" className={`${styles.option} ${state}`} disabled={answered} onClick={() => setPicked(index)}>
                  {option.text}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.nextStep}>
          <div className={styles.routeResult} aria-live="polite">
            <span className={styles.nextLabel}>{answered ? (gotIt ? "After a strong answer · Study plan" : "After a shaky answer · Study plan") : "Study plan"}</span>
            <strong>
              {!answered ? "Pick an answer to see how it changes." : gotIt ? "Elasticity can wait. Kelus asks again later." : "Elasticity moves to the top of the route."}
              {answered ? <motion.span key={String(gotIt)} className={styles.routeArrow} data-cue="route" initial={reduceMotion ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}>{gotIt ? "✓" : "↗"}</motion.span> : null}
            </strong>
          </div>
          {answered ? <button type="button" className={styles.tryAgain} onClick={() => setPicked(null)}>Try another answer</button> : null}
        </div>
      </motion.div>
    </figure>
  );
}
