"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useState } from "react";
import { BOXES, type LeitnerLine, type LeitnerState } from "@/domain/leitner";
import styles from "./LeitnerPanel.module.css";

/** A line as it reads in the notes, without the quote marks the extraction may keep. */
function short(quote: string) {
  return quote.replace(/^["“]|["”]$/g, "").trim();
}

const AFTER = ["today", "in 2 days", "in 4 days", "in 9 days", "in a month"];
// Interval cadence is included in the accessible name of each stage.
const EVERY = ["Daily", "2 days", "4 days", "9 days", "Monthly"];
const ease = [0.22, 1, 0.36, 1] as const;

/** A factual view of the learner's recall intervals. Nothing here is estimated. */
export function LeitnerPanel({ state }: { state: LeitnerState }) {
  const reduce = useReducedMotion() === true;
  const [open, setOpen] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const drawerId = useId();
  // Escape closes the expanded interval and returns focus to the study plan.
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!state.total) return null;
  const moved = state.lines.filter((line) => line.movedToday).length;
  const shown = open === null ? [] : state.byBox[open];
  const due = state.byBox[0].length;
  return (
    <section className={styles.panel} data-open={timelineOpen || undefined} aria-labelledby="leitner-title">
      <header className={styles.head}>
        <div>
          <h2 id="leitner-title">Review timing</h2>
          <p>{due ? `${due} ${due === 1 ? "line is" : "lines are"} due today` : "Nothing is due today"} · {state.recalled} known</p>
        </div>
        <button
          type="button"
          className={styles.disclosure}
          aria-expanded={timelineOpen}
          aria-controls={drawerId}
          onClick={() => {
            if (timelineOpen) setOpen(null);
            setTimelineOpen((wasOpen) => !wasOpen);
          }}
        >
          {timelineOpen ? "Hide timing" : "View timing"}
          <span aria-hidden="true">{timelineOpen ? "−" : "+"}</span>
        </button>
      </header>
      <div id={drawerId}>
        <AnimatePresence initial={false}>
          {timelineOpen ? (
            <motion.div
            className={styles.timeline}
            initial={reduce ? false : { opacity: 0, y: -4 }}
            animate={reduce ? undefined : { opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.2, ease }}
          >
            <p className={styles.explainer}>A recalled line moves to a longer gap. A missed line returns to today.</p>
            <ol className={styles.boxes}>
              {BOXES.map(({ box, every }, index) => {
                const lines = state.byBox[index];
                const current = index === 0 && lines.length > 0;
                const label = index === 0 ? "Due today" : AFTER[index];
                return (
                  <li
                    key={box}
                    className={styles.box}
                    data-current={current ? "" : undefined}
                    data-filled={lines.length ? "" : undefined}
                    data-missed={lines.some((line) => line.state === "missed") ? "" : undefined}
                  >
                    <button
                      type="button"
                      className={styles.stage}
                      aria-expanded={open === index}
                      aria-controls={`${drawerId}-lines`}
                      disabled={!lines.length}
                      aria-label={`Review stage ${box}, ${label}, ${every.toLowerCase()}: ${lines.length} ${lines.length === 1 ? "source line" : "source lines"}${lines.length ? ". Show them" : ""}`}
                      onClick={() => setOpen(open === index ? null : index)}
                    >
                      <span className={styles.marker} aria-hidden="true">
                        {lines.length ? lines.length : <span>—</span>}
                      </span>
                      <span className={styles.name}><b>{index === 0 ? "Today" : AFTER[index]}</b></span>
                      {lines.length ? <span className={styles.stageHint}>Open lines</span> : null}
                    </button>
                  </li>
                );
              })}
            </ol>

            {/* The selected interval, expanded as source lines rather than hidden behind a count. */}
            <div id={`${drawerId}-lines`} className={styles.drawerWrap}>
              <AnimatePresence initial={false} mode="wait">
                {open !== null && shown.length ? (
                  <motion.div
                    key={open}
                    className={styles.drawer}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, transition: { duration: 0.14 } }}
                    transition={{ duration: 0.24, ease }}
                  >
                    <p className={styles.drawerHead}><b>{open === 0 ? "Due today" : AFTER[open]}</b> · {shown.length} {shown.length === 1 ? "source line" : "source lines"}</p>
                    <ul className={styles.spread}>
                      {shown.slice(0, 8).map((line, at) => (
                        <motion.li
                          key={line.quote}
                          className={styles.spreadCard}
                          data-state={line.state}
                          initial={reduce ? false : { opacity: 0, y: -8, rotate: at % 2 ? 1 : -1 }}
                          animate={{ opacity: 1, y: 0, rotate: 0 }}
                          transition={{ duration: 0.26, ease, delay: reduce ? 0 : at * 0.035 }}
                        >
                          <span className={styles.spreadLine}>{short(line.quote)}</span>
                          <small>{line.topic}{line.state === "missed" ? " · missed" : line.state === "recalled" ? " · recalled" : " · not asked yet"}</small>
                        </motion.li>
                      ))}
                    </ul>
                    {shown.length > 8 ? <p className={styles.more}>and {shown.length - 8} more</p> : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <footer className={styles.foot}>
              <span>{moved ? `${moved} ${moved === 1 ? "line" : "lines"} moved to a longer gap today` : due ? `${due} ${due === 1 ? "line is" : "lines are"} due today` : "Nothing is due today"}</span>
              <span><b>{state.recalled}</b> of {state.total} source {state.total === 1 ? "line recalled" : "lines recalled"}</span>
            </footer>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </section>
  );
}
