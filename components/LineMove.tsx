"use client";

import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { getKnownLines, getServerKnownLines, nextStreak, subscribeKnownLines } from "@/lib/known-lines";
import styles from "./LineMove.module.css";

const box = (streak: number) => Math.min(5, 1 + streak);
// When a line in each box is asked again (domain/leitner.ts BOXES), said the way a student plans a week.
const AGAIN = ["tomorrow", "in 2 days", "in 4 days", "in 9 days", "in a month"];

/**
 * The session's signature: the line just answered, as a chip in the five Leitner boxes, sliding to where this answer
 * puts it. A right answer on a new day moves it one box right; a miss sends it back to Box 1. Read from the lines
 * known before this answer, so the move shown is the move that will be saved. The words say what the student cares
 * about: when the line comes back. A right pick from choices shows no move, because choosing is not recalling.
 */
export function LineMove({ quote, right, recall = true, nowIso }: { quote: string; right: boolean; /** False for a pick from choices: right, but not a recall, so the line does not move. */ recall?: boolean; nowIso: string }) {
  const reduce = useReducedMotion() === true;
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const previous = known.find((line) => line.quote.trim().toLocaleLowerCase() === quote.trim().toLocaleLowerCase());
  const from = previous ? box(previous.streak ?? 1) : 1;
  const to = right ? (recall ? box(nextStreak(previous, nowIso)) : from) : 1;
  const words = !right
    ? "Missed, so it comes back first in your next warm-up."
    : !recall
      ? "Right. Choosing it doesn’t move it on: recall it in your own words to do that."
      : to > from
        ? `Recalled. You’ll see it again ${AGAIN[to - 1]}.`
        : `Already counted today. You’ll see it again ${AGAIN[to - 1]}.`;
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
