"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PackArt } from "@/components/PackArt";
import { SourceArt } from "@/components/SourceArt";
import type { MaterialRole } from "@/domain/types";
import { Octicon } from "@/components/Octicon";
import styles from "./ReadingNotes.module.css";

const ease = [0.22, 1, 0.36, 1] as const;
const STEPS = ["Reading your pages", "Finding the topics", "Writing your first questions"] as const;

/**
 * The only thing on screen while Kelus reads a file: the K writing itself, like a pen going over the page, and the
 * real step underneath. When it could not read the file, why, and one way out.
 */
export function ReadingNotes({ message, error, onStartOver, topics = [], source }: { message: string; error?: string | null; onStartOver?: () => void; /** The topics found so far: shown one by one, proof that Kelus read these notes. */ topics?: string[]; source?: { name: string; detail: string; role: MaterialRole } }) {
  const reduce = useReducedMotion() === true;
  if (error) {
    return (
      <section className={styles.box} aria-labelledby="reading-title">
        {/* From the Kelus illustration pack: a shrug, not an error icon. */}
        <PackArt name="no-answer" size={220} className={styles.shrug} />
        <h1 id="reading-title">No topics found in this file.</h1>
        <p>{error}</p>
        <p className={styles.hint}>Notes with a heading above each topic work best. A PDF needs selectable text, or a clear scan.</p>
        <button type="button" className={`k-btn ${styles.cta}`} onClick={onStartOver}>Try another file</button>
      </section>
    );
  }
  // Where the work is: the file being opened and read, its topics being found, or the first questions being written.
  const stage = topics.length ? 2 : /open|read|scan|export|file|page/i.test(message) ? 0 : 1;
  // One stroke, then the other, then a breath, and again: slow enough to feel calm, never a spinner.
  const draw = (delay: number) => (reduce
    ? { initial: false as const, animate: { pathLength: 1, opacity: 1 } }
    : {
        initial: { pathLength: 0, opacity: 0 },
        animate: { pathLength: [0, 1, 1, 0], opacity: [0, 1, 1, 0] },
        transition: { duration: 2.8, times: [0, 0.32, 0.82, 1], delay, ease, repeat: Infinity, repeatDelay: 0.25 },
      });
  return (
    <section className={styles.reading} role="status" aria-live="polite" aria-labelledby="reading-title">
      {source ? <div className={styles.source}>
        <SourceArt role={source.role} />
        <span><strong title={source.name}>{source.name}</strong><small>{source.detail}</small></span>
      </div> : null}
      <svg className={styles.mark} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="9">
          <motion.path d="M29 20v60" {...draw(0)} />
          <motion.path d="M74 22C66 37 56 46 43 51c14 5 25 15 33 28" {...draw(0.38)} />
        </g>
      </svg>
      <h1 id="reading-title" className={styles.step}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={message}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: "blur(2px)" }}
            transition={{ duration: 0.32, ease }}
          >
            {message}
          </motion.span>
        </AnimatePresence>
      </h1>
      {/* Three steps that tick off as they happen, the way a good tool shows its work: reading, finding, writing. */}
      <ol className={styles.steps} aria-label="What’s happening">
        {STEPS.map((label, index) => {
          const state = index < stage ? "done" : index === stage ? "now" : "next";
          return (
            <motion.li key={label} data-state={state} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: reduce ? 0 : index * 0.08, ease }}>
              <span className={styles.tick} aria-hidden="true">
                {state === "done" ? (
                  <motion.span initial={reduce ? false : { scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}><Octicon name="check-circle" size={18} /></motion.span>
                ) : state === "now" ? <i className={styles.pulse} /> : <i className={styles.idle} />}
              </span>
              <span className={styles.stepText}>{label}<span className="sr-only">{state === "done" ? " (done)" : state === "now" ? " (now)" : ""}</span></span>
              {index === 1 && topics.length ? (
                <ul className={styles.found} aria-label="Topics found">
                  {topics.slice(0, 8).map((topic, at) => (
                    <motion.li key={topic} initial={reduce ? false : { opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring", bounce: 0, duration: 0.3, delay: reduce ? 0 : 0.08 + at * 0.08 }}>
                      {topic}
                    </motion.li>
                  ))}
                  {topics.length > 8 ? <li className={styles.more}>+{topics.length - 8}</li> : null}
                </ul>
              ) : null}
            </motion.li>
          );
        })}
      </ol>
    </section>
  );
}
