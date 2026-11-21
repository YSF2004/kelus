"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Tick } from "@/components/Marks";
import styles from "./FollowThrough.module.css";

type Moment = "source" | "answer" | "check" | "plan";

const moments: Moment[] = ["source", "answer", "check", "plan"];

/** A single study minute: source, answer, correction, and the changed next session. */
export function RevisionLoopVisuals() {
  const root = useRef<HTMLElement>(null);
  const inView = useInView(root, { once: true, amount: 0.28 });
  const reduced = useReducedMotion() === true;
  const [moment, setMoment] = useState<Moment>("source");

  useEffect(() => {
    if (!inView || reduced) return;
    const timers = moments.slice(1).map((next, index) => window.setTimeout(() => setMoment(next), 1050 * (index + 1)));
    return () => timers.forEach(window.clearTimeout);
  }, [inView, reduced]);

  const current = moments.indexOf(moment);

  return (
    <section ref={root} className={styles.section} aria-labelledby="revision-loop-title">
      <div className={styles.intro}>
        <h2 id="revision-loop-title">This is the part other study apps skip.</h2>
        <p>Kelus does not just generate a question. It keeps the source, checks the idea you missed, and changes your next study minute for a reason you can see.</p>
      </div>

      <div className={styles.demo} aria-label="An example Kelus study session">
        <div className={styles.demoTop}>
          <div><strong>Cell Biology</strong><span>Cell Transport.pdf · Page 2</span></div>
          <ol className={styles.progress} aria-label="Example study session progress">
            {moments.map((item, index) => <li key={item} data-active={index <= current} aria-label={`Step ${index + 1}`} />)}
          </ol>
        </div>

        <div className={styles.workspace}>
          <aside className={styles.source} aria-label="Original note excerpt">
            <p className={styles.sourceLabel}>Your source</p>
            <h3>7.2 Osmosis</h3>
            <p>Osmosis is the net movement of water molecules from a dilute solution to a more <mark>concentrated solution</mark> through a partially permeable membrane.</p>
            <p className={styles.page}>Cell Transport.pdf · page 2</p>
          </aside>

          <div className={styles.session} aria-live="polite">
            <AnimatePresence initial={false} mode="wait">
              {moment === "source" ? <motion.div key="source" {...sceneMotion(reduced)} className={styles.moment}>
                <p className={styles.status}>Source read</p>
                <h3>Three topics found in your notes.</h3>
                <ul className={styles.topicList}><li><Tick size={14} />Diffusion</li><li><Tick size={14} />Osmosis</li><li><Tick size={14} />Active transport</li></ul>
                <p className={styles.quiet}>Your first question comes from the highlighted line.</p>
              </motion.div> : null}
              {moment === "answer" ? <motion.div key="answer" {...sceneMotion(reduced)} className={styles.moment}>
                <p className={styles.status}>Try it from memory</p>
                <h3>Where does water move during osmosis?</h3>
                <p className={styles.answer}>“From a dilute solution to the weaker side.”</p>
                <p className={styles.quiet}>Checking this against page 2…</p>
              </motion.div> : null}
              {moment === "check" ? <motion.div key="check" {...sceneMotion(reduced)} className={styles.moment}>
                <p className={styles.status}>One idea to fix</p>
                <h3>Your direction was right. The destination was not.</h3>
                <p className={styles.correction}>Your notes say <strong>more concentrated</strong>, not “weaker.” That distinction is what makes the sentence precise.</p>
                <button type="button" className={styles.evidence}>Show the source line <span aria-hidden="true">↗</span></button>
              </motion.div> : null}
              {moment === "plan" ? <motion.div key="plan" {...sceneMotion(reduced)} className={styles.moment}>
                <p className={styles.status}>Your plan changed</p>
                <h3>Osmosis comes back tomorrow.</h3>
                <div className={styles.nextItem}><div><strong>Osmosis</strong><span>2 lines to revisit · about 3 min</span></div><b>Tomorrow</b></div>
                <p className={styles.quiet}>Because this answer mixed up the concentration difference.</p>
              </motion.div> : null}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className={styles.promises}>
        <p><strong>Every question has evidence.</strong> The original line stays one tap away.</p>
        <p><strong>Feedback names the difference.</strong> Not a generic AI verdict.</p>
        <p><strong>The plan explains itself.</strong> You always know why a topic returns.</p>
      </div>
    </section>
  );
}

function sceneMotion(reduced: boolean) {
  return {
    // Opacity and transform stay on the compositor. Blur forced a repaint of the whole study surface on every handoff.
    initial: reduced ? false : { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -6 },
    transition: { duration: reduced ? 0.15 : 0.34, ease: [0.22, 1, 0.36, 1] as const },
  };
}
