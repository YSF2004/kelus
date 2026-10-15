"use client";

import { motion, useReducedMotion } from "motion/react";
import styles from "./MarkStamp.module.css";

export type MarkOutcome = "success" | "partial" | "failure";

const LABEL: Record<MarkOutcome, string> = {
  success: "Solid pass",
  partial: "Partly there",
  failure: "Needs another attempt",
};

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The verdict as an ink stamp that draws itself: a full ring and tick for a pass,
 * a part-drawn ring around a half-filled dot for partly there (the same ◐ the lists use), an open loop with a return arrow for another attempt.
 * Ink for effort, green only for a pass. Never red: this is feedback, not punishment.
 */
/**
 * One answer's verdict, as a small solid seal that settles in: a green disc with a tick for a pass, an ink disc
 * half filled for partly there, a paper disc with a return arrow for another attempt. No half-drawn ring: on its own a
 * part-ring reads as a loading spinner. A whole block's share (`fill`) still draws its ring, since there the ring is a
 * measure.
 */
export function MarkStamp({ outcome, label, fill }: { outcome: MarkOutcome; label?: string; /** How much of the ring to draw, 0 to 1, when it stands for a share (a whole block) rather than one answer. */ fill?: number }) {
  const reduce = useReducedMotion() === true;
  const settle = reduce ? {} : { initial: { scale: 0.6, opacity: 0 }, animate: { scale: 1, opacity: 1 }, transition: { type: "spring" as const, bounce: 0, duration: 0.45 } };
  const draw = (delay: number, duration: number) => ({
    initial: reduce ? false : { pathLength: 0 },
    animate: { pathLength: 1 },
    transition: reduce ? { duration: 0 } : { duration, delay, ease },
  });

  if (fill === undefined) {
    return (
      <motion.svg className={`${styles.seal} ${styles[outcome]}`} viewBox="0 0 48 48" role="img" aria-label={label ?? LABEL[outcome]} {...settle}>
        <circle className={styles.disc} cx="24" cy="24" r="22" />
        {outcome === "success" ? <motion.path className={styles.glyph} d="M15 24.5 21.5 31 33.5 17.5" {...draw(0.2, 0.35)} /> : null}
        {outcome === "partial" ? <path className={styles.halfFill} d="M24 11a13 13 0 0 1 0 26Z" /> : null}
        {outcome === "partial" ? <circle className={styles.glyph} cx="24" cy="24" r="13" /> : null}
        {outcome === "failure" ? (
          <>
            <motion.path className={styles.glyph} d="M31.5 19.5A9 9 0 1 0 33 27" {...draw(0.2, 0.4)} />
            <motion.path className={styles.glyph} d="M32 13.5v6.5h-6.5" {...draw(0.5, 0.2)} />
          </>
        ) : null}
      </motion.svg>
    );
  }

  const ringTo = Math.min(1, Math.max(0.04, fill));
  return (
    <svg className={`${styles.stamp} ${styles[outcome]}`} viewBox="0 0 120 120" role="img" aria-label={label ?? LABEL[outcome]}>
      <circle className={styles.track} cx="60" cy="60" r="46" />
      <motion.circle
        className={styles.ring}
        cx="60"
        cy="60"
        r="46"
        transform="rotate(-90 60 60)"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: ringTo }}
        transition={reduce ? { duration: 0 } : { duration: 0.7, ease }}
      />
      {outcome === "success" ? <motion.path className={styles.tick} d="M38 62L54 78L84 42" {...draw(0.55, 0.4)} /> : null}
    </svg>
  );
}
