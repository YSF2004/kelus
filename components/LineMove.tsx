"use client";

import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { getKnownLines, getServerKnownLines, nextStreak, subscribeKnownLines } from "@/lib/known-lines";
import styles from "./LineMove.module.css";

const box = (streak: number) => Math.min(5, 1 + streak);

/**
 * The session's signature: the line just answered, as a chip in the five Leitner boxes, sliding to where this answer
 * puts it. A right answer on a new day moves it one box right; a miss sends it back to Box 1. Read from the lines
 * known before this answer, so the move shown is the move that will be saved.
 */
export function LineMove({ quote, right, nowIso }: { quote: string; right: boolean; nowIso: string }) {
  const reduce = useReducedMotion() === true;
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const previous = known.find((line) => line.quote.trim().toLocaleLowerCase() === quote.trim().toLocaleLowerCase());
  const from = previous ? box(previous.streak ?? 1) : 1;
  const to = right ? box(nextStreak(previous, nowIso)) : 1;
  const words = to > from ? `Box ${from} to Box ${to}` : to < from ? `Back to Box 1` : `Stays in Box ${to}`;
  return (
    <div className={styles.move} data-dir={to > from ? "up" : to < from ? "down" : "same"} aria-label={`This line: ${words}`}>
      <ol className={styles.track} aria-hidden="true">
        {[1, 2, 3, 4, 5].map((slot) => <li key={slot} data-on={slot === to ? "" : undefined}><span>{slot}</span></li>)}
        <motion.i
          className={styles.chip}
          data-right={right ? "" : undefined}
          initial={reduce ? false : { left: `${(from - 1) * 20}%` }}
          animate={{ left: `${(to - 1) * 20}%` }}
          transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] }}
        >{to}</motion.i>
      </ol>
      <span className={styles.words}>{words}</span>
    </div>
  );
}
