"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Tick } from "@/components/Marks";
import styles from "./FollowThrough.module.css";

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * The homepage middle: one real line from a student's notes, followed through the four things Kelus does with it.
 * Each step is drawn in the product's own type and colours, not an illustration of it, and the steps happen in order
 * as the section comes into view: the line is marked, the blank fills, the opposite word is caught, the plan moves.
 */
export function RevisionLoopVisuals() {
  const root = useRef<HTMLDivElement>(null);
  const inView = useInView(root, { once: true, amount: 0.35 });
  const reduce = useReducedMotion() === true;
  const on = reduce || inView;
  // Step n starts when the one before has had its moment: about a third of a second apart.
  const at = (step: number, extra = 0) => (reduce ? 0 : 0.15 + step * 0.32 + extra);
  const appear = (step: number) => ({
    initial: reduce ? false : { opacity: 0, y: 10 },
    animate: on ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.5, delay: at(step), ease },
  });

  return (
    <section className={styles.section} aria-labelledby="revision-loop-title">
      <div className={styles.intro}>
        <h2 id="revision-loop-title">One line from your notes, followed all the way.</h2>
        <p>This is the whole method. Kelus does it for every topic, each time you open it.</p>
      </div>

      <div ref={root} className={styles.track}>
        <motion.article {...appear(0)} className={styles.step} data-revision-step="01">
          <h3><span>1</span> Your notes</h3>
          <div className={styles.sheet}>
            <p className={styles.page}>
              Osmosis is the movement of water across a{" "}
              {/* A marker stroke drawn along the words, wrapping with them like a real highlighter. */}
              <motion.mark
                className={styles.mark}
                initial={reduce ? false : { backgroundSize: "0% 100%" }}
                animate={on ? { backgroundSize: "100% 100%" } : undefined}
                transition={{ duration: 0.7, delay: at(0, 0.35), ease }}
              >
                partially permeable membrane
              </motion.mark>{" "}
              from a dilute solution to a more concentrated one.
            </p>
            <p className={styles.where}>Biology · page 2</p>
          </div>
        </motion.article>

        <motion.article {...appear(1)} className={styles.step} data-revision-step="02">
          <h3><span>2</span> A question from that line</h3>
          <div className={styles.sheet}>
            {/* The answer is typed into the blank of the sentence itself, as on a worksheet: no box in a box. */}
            <p className={styles.ask}>
              Water moves from a dilute solution to a more{" "}
              <span className={styles.blank}>
                <motion.span
                  initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
                  animate={on ? { clipPath: "inset(0 0% 0 0)" } : undefined}
                  transition={{ duration: 0.55, delay: at(1, 0.35), ease: "linear" }}
                >
                  concentrated
                </motion.span>
              </span>{" "}
              one.
            </p>
            <motion.p
              className={styles.right}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={on ? { opacity: 1, y: 0 } : undefined}
              transition={{ duration: 0.3, delay: at(1, 0.95), ease }}
            >
              <Tick size={14} /> Right: that’s the line on page 2.
            </motion.p>
          </div>
        </motion.article>

        <motion.article {...appear(2)} className={styles.step} data-revision-step="03">
          <h3><span>3</span> Your words, checked</h3>
          <div className={styles.sheet}>
            <p className={styles.said}>
              “Water goes through the membrane to the{" "}
              <span className={styles.flipWrap}>
                weaker
                <svg aria-hidden="true" viewBox="0 0 60 6" preserveAspectRatio="none" className={styles.wave}>
                  <motion.path
                    d="M0 3 Q 5 0 10 3 T 20 3 T 30 3 T 40 3 T 50 3 T 60 3"
                    initial={reduce ? false : { pathLength: 0 }}
                    animate={on ? { pathLength: 1 } : undefined}
                    transition={{ duration: 0.5, delay: at(2, 0.35), ease }}
                  />
                </svg>
              </span>{" "}
              side.”
            </p>
            <p className={styles.note}>Check the direction: you wrote <b>weaker</b> where your notes say <b>more concentrated</b>.</p>
          </div>
        </motion.article>

        <motion.article {...appear(3)} className={styles.step} data-revision-step="04">
          <h3><span>4</span> Your plan moves</h3>
          <div className={styles.sheet}>
            <ol className={styles.plan} aria-label="Your plan after this answer">
              <motion.li
                className={styles.moved}
                initial={reduce ? false : { y: 34 }}
                animate={on ? { y: 0 } : undefined}
                transition={{ type: "spring", bounce: 0, duration: 0.6, delay: at(3, 0.35) }}
              >
                <strong>Osmosis</strong>
                <span>comes back tomorrow</span>
              </motion.li>
              <motion.li
                initial={reduce ? false : { y: -34 }}
                animate={on ? { y: 0 } : undefined}
                transition={{ type: "spring", bounce: 0, duration: 0.6, delay: at(3, 0.35) }}
              >
                <strong>Diffusion</strong>
                <span>in 4 days</span>
              </motion.li>
              <li>
                <strong>Enzymes</strong>
                <span>next week</span>
              </li>
            </ol>
          </div>
        </motion.article>
      </div>
    </section>
  );
}
