"use client";

import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect } from "react";
import styles from "./BlockRing.module.css";

/**
 * The end of a block, as a finish: a ring that fills with the topics practised and a count that climbs with it.
 * It measures what was done (finishing always fills it); how well each topic went is said honestly in the list below.
 * Green when every topic was solid, ink otherwise, never red.
 */
export function BlockRing({ done, of, allSolid }: { done: number; of: number; allSolid: boolean }) {
  const reduce = useReducedMotion() === true;
  const share = of > 0 ? Math.min(1, done / of) : 0;
  const count = useMotionValue(reduce ? done : 0);
  const shown = useTransform(count, (value) => Math.round(value));
  useEffect(() => {
    if (reduce) return;
    const controls = animate(count, done, { duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [count, done, reduce]);
  return (
    <figure className={`${styles.ring} ${allSolid ? styles.solid : ""}`} aria-label={`${done} of ${of} ${of === 1 ? "topic" : "topics"} practised`}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className={styles.track} cx="60" cy="60" r="52" />
        <motion.circle
          className={styles.fill}
          cx="60" cy="60" r="52"
          initial={reduce ? false : { pathLength: 0 }}
          animate={{ pathLength: share }}
          transition={reduce ? { duration: 0 } : { duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <span className={styles.count} aria-hidden="true"><motion.b>{shown}</motion.b><small>/{of}</small></span>
      <figcaption aria-hidden="true">{of === 1 ? "topic" : "topics"} practised</figcaption>
    </figure>
  );
}
