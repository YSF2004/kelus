"use client";

import { motion, useDragControls, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Octicon } from "@/components/Octicon";
import type { LineLife } from "@/domain/line-life";
import styles from "./LineLifeSheet.module.css";

const ease = [0.22, 1, 0.36, 1] as const;
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** A question as the student saw it: its quoted line with the gap drawn as a rule, never the answer. */
function Asked({ prompt }: { prompt: string }) {
  const quoted = prompt.match(/“(.+)”/)?.[1];
  const lead = quoted ? prompt.slice(0, prompt.indexOf("“")).trim() : prompt;
  return (
    <>
      <span className={styles.askLead}>{lead}</span>
      {quoted ? <span className={styles.askLine}>{quoted.split(/_{2,}/).map((part, at, parts) => <span key={at}>{part}{at < parts.length - 1 ? <i className={styles.gap} aria-label="blank" /> : null}</span>)}</span> : null}
    </>
  );
}

function backLine(life: LineLife) {
  if (life.state === "missed") return "Missed last time, so it opens your next warm-up.";
  if (life.state === "new") return life.answers.length ? "In Box 1: asked again the next time you practise this topic." : "Not asked yet. It comes up when you reach this topic.";
  return life.backOn ? `Back on ${day(life.backOn)}.` : "Back soon.";
}

/**
 * One line of the notes, followed all the way: where it is, how Kelus asks it, every answer it has had, and the box
 * it sits in now. A sheet over Progress that rises from the bottom on a phone and sits beside the page on a wide
 * screen; Escape, the close button, a tap outside or (on a phone) a pull down on its handle puts it away.
 */
export function LineLifeSheet({ life, onClose }: { life: LineLife; onClose: () => void }) {
  const reduce = useReducedMotion() === true;
  const close = useRef<HTMLButtonElement>(null);
  const drag = useDragControls();
  const closeNow = useRef(onClose);
  useEffect(() => { closeNow.current = onClose; }, [onClose]);
  // Focus moves to the sheet and back to the card that opened it. Escape closes the sheet only, not the open box.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    // The page under the sheet holds still while it is open.
    document.body.style.overflow = "hidden";
    close.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopImmediatePropagation(); closeNow.current(); }
      // The close button is the sheet's only control: Tab stays on it rather than wandering into the page behind.
      if (event.key === "Tab") { event.preventDefault(); close.current?.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => { window.removeEventListener("keydown", onKey, true); document.body.style.overflow = overflow; before?.focus?.(); };
  }, []);
  const right = life.answers.filter((answer) => answer.right).length;
  let step = 0;
  const n = () => String(++step).padStart(2, "0");

  // Rendered at the top of the page: an animated panel around Progress would otherwise hold the sheet inside it.
  return createPortal(
    <motion.div className={styles.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.section
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby="line-life-title"
        onClick={(event) => event.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0, transition: { duration: 0.16 } }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        // Pulled down by its handle it follows the finger, resists going up, and goes away past a short pull or a
        // flick; anything less springs back. The sheet's own content still scrolls normally.
        drag={reduce ? false : "y"}
        dragControls={drag}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.04, bottom: 0.7 }}
        dragSnapToOrigin
        onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
      >
        <span className={styles.handle} aria-hidden="true" onPointerDown={(event) => drag.start(event)} />
        <header className={styles.head}>
          <p className={styles.kicker}>{life.topic} · Box {life.box}</p>
          <button ref={close} type="button" className={styles.close} onClick={onClose} aria-label="Close"><Octicon name="x" size={20} /></button>
        </header>
        <h2 id="line-life-title" className="sr-only">The life of this line</h2>

        <ol className={styles.trail}>
          <motion.li className={styles.step} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.05 }}>
            <span className={styles.num} aria-hidden="true">{n()}</span>
            <div>
              <p className={styles.label}>From your notes{life.source ? <span> · {life.source}</span> : null}</p>
              <blockquote className={styles.quote}>“{life.quote}”</blockquote>
              {life.next ? <p className={styles.next}><b>Your notes go on:</b> “{life.next}”</p> : null}
            </div>
          </motion.li>

          {life.asked.length ? (
            <motion.li className={styles.step} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.1 }}>
              <span className={styles.num} aria-hidden="true">{n()}</span>
              <div>
                <p className={styles.label}>How Kelus asks it</p>
                <ul className={styles.asks}>{life.asked.map((ask) => <li key={ask.prompt}><Asked prompt={ask.prompt} /></li>)}</ul>
              </div>
            </motion.li>
          ) : null}

          <motion.li className={styles.step} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.15 }}>
            <span className={styles.num} aria-hidden="true">{n()}</span>
            <div>
              <p className={styles.label}>Your answers{life.answers.length ? <span> · {right} of {life.answers.length} right</span> : null}</p>
              {life.answers.length ? (
                <ol className={styles.answers} aria-label="Every answer to this line, oldest first">
                  {life.answers.map((answer, at) => (
                    <li key={`${answer.at}-${at}`} data-right={answer.right ? "" : undefined}>
                      <span className={styles.dot} aria-hidden="true">{answer.right ? "✓" : "×"}</span>
                      <span>{answer.right ? "Right" : "Missed"}</span>
                      <time dateTime={answer.at}>{day(answer.at)}</time>
                    </li>
                  ))}
                </ol>
              ) : <p className={styles.quiet}>{life.state === "new" ? "No answers yet." : "Answered before this device kept a history."}</p>}
            </div>
          </motion.li>

          {life.reason ? (
            <motion.li className={styles.step} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.2 }}>
              <span className={styles.num} aria-hidden="true">{n()}</span>
              <div>
                <p className={styles.label}>Why it holds</p>
                <p className={styles.body}>{life.reason}</p>
              </div>
            </motion.li>
          ) : null}

          <motion.li className={styles.step} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease, delay: 0.25 }}>
            <span className={styles.num} aria-hidden="true">{n()}</span>
            <div>
              <p className={styles.label}>Where it is now</p>
              <ol className={styles.boxes} aria-label={`In Box ${life.box} of 5`}>
                {[1, 2, 3, 4, 5].map((box) => <li key={box} data-here={box === life.box ? "" : undefined} data-state={box === life.box ? life.state : undefined}>{box}</li>)}
              </ol>
              <p className={styles.body}>{backLine(life)}</p>
            </div>
          </motion.li>
        </ol>
      </motion.section>
    </motion.div>,
    document.body,
  );
}
