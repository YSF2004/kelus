"use client";

import { motion, useReducedMotion } from "motion/react";
import { BOXES, type LeitnerState } from "@/domain/leitner";
import styles from "./LeitnerPanel.module.css";

/** A line as it reads in the notes; the box's width trims it, and the whole line is its tooltip. */
function short(quote: string) {
  return quote.replace(/^["“]|["”]$/g, "").trim();
}

/**
 * The signature of the product: every line of your notes in one of five boxes. Box 1 is asked every day; a line moves
 * one box right each day you recall it, and back to Box 1 when you miss it. Recalled lines are filled green, missed lines
 * carry a coral outline, lines not asked yet are plain. Nothing here is estimated.
 */
export function LeitnerPanel({ state }: { state: LeitnerState }) {
  const reduce = useReducedMotion() === true;
  if (!state.total) return null;
  const MAX = 6;
  const moved = state.lines.filter((line) => line.movedToday).length;
  return (
    <section className={styles.panel} aria-labelledby="leitner-title">
      <header className={styles.head}>
        <h2 id="leitner-title">Your {state.total} {state.total === 1 ? "line" : "lines"}</h2>
        <p>Recall a line and it moves right</p>
      </header>
      <ol className={styles.boxes}>
        {BOXES.map(({ box, every }, index) => {
          const lines = state.byBox[index];
          return (
            <li key={box} className={styles.box} data-due={box === 1 ? "" : undefined} aria-label={`Box ${box}, ${every.toLowerCase()}: ${lines.length} ${lines.length === 1 ? "line" : "lines"}`}>
              <b>Box {box}</b>
              <small>{every}</small>
              <ul className={styles.marks} aria-hidden="true">
                {lines.slice(0, MAX).map((line, at) => (
                  <motion.li
                    key={line.quote}
                    layoutId={reduce ? undefined : `leitner-${line.quote}`}
                    className={styles.mark}
                    data-state={line.state}
                    title={`${line.topic}: ${line.quote}`}
                    data-moved={line.movedToday ? "" : undefined}
                    // A line recalled today arrives from the box before it, so the plan shows what today's answers did.
                    initial={reduce ? false : line.movedToday ? { x: "calc(-100% - 26px)", opacity: 1 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    transition={line.movedToday ? { duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.45 + at * 0.08 } : { duration: 0.24, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : Math.min(0.2, (index * 3 + at) * 0.012) }}
                  >
                    {short(line.quote)}
                  </motion.li>
                ))}
                {lines.length > MAX ? <li className={styles.more}>+{lines.length - MAX} more</li> : null}
                {lines.length === 0 ? <li className={styles.empty} /> : null}
              </ul>
              <span className={styles.count} data-zero={lines.length === 0 ? "" : undefined}>{lines.length}</span>
            </li>
          );
        })}
      </ol>
      <footer className={styles.foot}>
        <span>{moved ? `${moved} ${moved === 1 ? "line" : "lines"} moved right today` : state.byBox[0].length ? `${state.byBox[0].length} in Box 1, asked today` : "Box 1 is clear"}</span>
        <span><b>{state.recalled}</b> of {state.total} recalled</span>
      </footer>
    </section>
  );
}
