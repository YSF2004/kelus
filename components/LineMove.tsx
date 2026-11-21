"use client";

import { useSyncExternalStore } from "react";
import { getKnownLines, getServerKnownLines, nextStreak, subscribeKnownLines } from "@/lib/known-lines";
import styles from "./LineMove.module.css";

const box = (streak: number) => Math.min(5, 1 + streak);
// When a line in each box is asked again (domain/leitner.ts BOXES), said the way a student plans a week.
const AGAIN = ["tomorrow", "in 2 days", "in 4 days", "in 9 days", "in a month"];

/**
 * When the line just answered comes back, said in words. A right answer on a new day moves it one Leitner box right;
 * a miss sends it back to Box 1. Read from the lines known before this answer, so the time said is the one that will
 * be saved. The numbered boxes are not drawn: a row of 1–5 made the verdict read like a flashcard deck, and the
 * student cares about when, not which box. A right pick from choices does not move, because choosing is not recalling.
 */
export function LineMove({ quote, right, recall = true, uncertain = false, nowIso }: { quote: string; right: boolean; /** False for a pick from choices: right, but not a recall, so the line does not move. */ recall?: boolean; /** An honest "not sure" returns the line without calling it wrong. */ uncertain?: boolean; nowIso: string }) {
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const previous = known.find((line) => line.quote.trim().toLocaleLowerCase() === quote.trim().toLocaleLowerCase());
  const from = previous ? box(previous.streak ?? 1) : 1;
  const to = right ? (recall ? box(nextStreak(previous, nowIso)) : from) : 1;
  const words = !right
    ? uncertain
      ? "Marked unsure, so Kelus brings this line into your next warm-up."
      : "Missed, so Kelus brings this line into your next warm-up."
    : !recall
      ? "Right. Choosing it doesn’t move it on: recall it in your own words to do that."
      : to > from
        ? `Recalled. You’ll see it again ${AGAIN[to - 1]}.`
        : `Already counted today. You’ll see it again ${AGAIN[to - 1]}.`;
  return (
    <p className={styles.move} data-dir={to > from ? "up" : to < from ? "down" : "same"} aria-label={`This line: ${words}`}>
      <span className={styles.words}>{words}</span>
    </p>
  );
}
