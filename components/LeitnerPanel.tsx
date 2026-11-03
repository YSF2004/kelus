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
// Under each pile, short enough to stay on one line so the five piles line up.
const EVERY = ["Daily", "2 days", "4 days", "9 days", "Monthly"];
const ease = [0.22, 1, 0.36, 1] as const;

/** The card a pile shows on top: the one that just arrived, else one you missed, else the first. */
function topOf(lines: LeitnerLine[]) {
  return lines.find((line) => line.movedToday) ?? lines.find((line) => line.state === "missed") ?? lines[0];
}

/**
 * The signature of the product: every line of your notes as an index card in one of five boxes, the way a Leitner box
 * sits on a desk. A pile grows with its lines; its top card shows one of them, edged coral when a line in it was missed
 * and green when recalled. Tap a pile and its cards are laid out underneath in full. A line recalled today arrives on
 * its pile from the one before, in an arc. Nothing here is estimated.
 */
export function LeitnerPanel({ state, onOpenLine }: { state: LeitnerState; /** On Progress, a card opens that line's whole story. */ onOpenLine?: (line: LeitnerLine) => void }) {
  const reduce = useReducedMotion() === true;
  const [open, setOpen] = useState<number | null>(null);
  const drawerId = useId();
  // Escape puts an open pile back, the way it closes anything laid out on the page.
  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (!state.total) return null;
  const moved = state.lines.filter((line) => line.movedToday).length;
  const shown = open === null ? [] : state.byBox[open];
  return (
    <section className={styles.panel} aria-labelledby="leitner-title">
      <header className={styles.head}>
        <h2 id="leitner-title">Your {state.total} {state.total === 1 ? "line" : "lines"}</h2>
        <p>Recall a line and it moves right. Open a box to see its lines.</p>
      </header>
      <ol className={styles.boxes}>
        {BOXES.map(({ box, every }, index) => {
          const lines = state.byBox[index];
          const top = topOf(lines);
          const layers = Math.min(lines.length, 5);
          const edge = lines.some((line) => line.state === "missed") ? "missed" : top?.state === "recalled" ? "recalled" : "new";
          const arrived = Boolean(top?.movedToday);
          return (
            <li key={box} className={styles.box} data-box={box} data-due={box === 1 ? "" : undefined}>
              <button
                type="button"
                className={styles.pile}
                aria-expanded={open === index}
                aria-controls={drawerId}
                aria-disabled={!lines.length || undefined}
                aria-label={`Box ${box}, ${every.toLowerCase()}: ${lines.length} ${lines.length === 1 ? "line" : "lines"}${lines.length ? ". Show them" : ""}`}
                onClick={() => { if (lines.length) setOpen(open === index ? null : index); }}
              >
                <span className={styles.stack} aria-hidden="true">
                  {lines.length === 0 ? (
                    <span className={styles.slot}>Lands here {AFTER[index]}</span>
                  ) : Array.from({ length: layers }, (_, layer) => {
                    const isTop = layer === layers - 1;
                    return (
                      <motion.span
                        key={isTop ? `top-${top?.quote}` : layer}
                        className={isTop ? styles.card : `${styles.card} ${styles.under}`}
                        data-edge={isTop ? edge : undefined}
                        data-box={box}
                        style={{ bottom: layer * 5, rotate: layer % 2 ? 0.8 : -1.2 }}
                        // The cards drop onto the pile in turn; a card recalled today flies in from the box before it.
                        initial={reduce ? false : isTop && arrived ? { x: "-118%", y: -6, rotate: -8, opacity: 1 } : { y: -10, opacity: 0 }}
                        animate={isTop && arrived && !reduce ? { x: ["-118%", "-58%", "0%"], y: [-6, -34, 0], rotate: [-8, -3, 0], opacity: 1 } : { x: 0, y: 0, opacity: 1 }}
                        transition={isTop && arrived ? { duration: 0.8, ease, delay: 0.5, times: [0, 0.45, 1] } : { duration: 0.3, ease, delay: 0.05 + index * 0.04 + layer * 0.03 }}
                      >
                        {isTop && top ? <span className={styles.line}>{short(top.quote)}</span> : null}
                      </motion.span>
                    );
                  })}
                </span>
                <span className={styles.count} data-zero={lines.length === 0 ? "" : undefined}>{lines.length}</span>
                <span className={styles.name}><b>Box {box}</b> <small>{EVERY[index]}</small></span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* The open pile, laid out card by card under the boxes, each line in full. */}
      <div id={drawerId} className={styles.drawerWrap}>
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
              <p className={styles.drawerHead}><b>Box {open + 1}</b> · back {AFTER[open]} · {shown.length} {shown.length === 1 ? "line" : "lines"}</p>
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
                    {onOpenLine ? (
                      <button type="button" className={styles.spreadOpen} onClick={() => onOpenLine(line)} aria-label={`${short(line.quote)}. See this line's answers and when it is back`}>
                        <span className={styles.spreadLine}>{short(line.quote)}</span>
                        <small>{line.topic}{line.state === "missed" ? " · missed" : line.state === "recalled" ? " · recalled" : " · not asked yet"}</small>
                      </button>
                    ) : (
                      <>
                        <span className={styles.spreadLine}>{short(line.quote)}</span>
                        <small>{line.topic}{line.state === "missed" ? " · missed" : line.state === "recalled" ? " · recalled" : " · not asked yet"}</small>
                      </>
                    )}
                  </motion.li>
                ))}
              </ul>
              {shown.length > 8 ? <p className={styles.more}>and {shown.length - 8} more</p> : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <footer className={styles.foot}>
        <span>{moved ? `${moved} ${moved === 1 ? "line" : "lines"} moved right today` : state.byBox[0].length ? `${state.byBox[0].length} in Box 1, asked today` : "Box 1 is clear"}</span>
        <span><b>{state.recalled}</b> of {state.total} recalled</span>
      </footer>
    </section>
  );
}
