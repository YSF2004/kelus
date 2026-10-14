"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { kelusDuration, kelusEase } from "@/components/motion";
import { PackArt } from "@/components/PackArt";
import styles from "./how/HowItWorks.module.css";
import sheets from "./how/HowSheets.module.css";

type VisualProps = { visible: boolean; reduceMotion: boolean };

/** Rows that settle in one after another once the chapter is on screen. */
function useRows(visible: boolean, reduceMotion: boolean) {
  return (index: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 6 },
    animate: visible ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.4, delay: reduceMotion ? 0 : 0.25 + index * 0.08, ease: kelusEase },
  });
}

/* The pictures are the product itself, at small size: the same type, colours and words a student sees. */

function SourceVisual({ visible, reduceMotion }: VisualProps) {
  const row = useRows(visible, reduceMotion);
  const topics = [["Price elasticity of demand", "Page 3"], ["Determinants of elasticity", "Page 4"], ["Income elasticity of demand", "Page 5"], ["Cross-price elasticity", "Page 6"]] as const;
  return (
    <figure className={`${styles.visual} ${styles.sourceVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.kicker}>Lecture 4: Elasticity · 7 pages</p>
          <ul className={sheets.rows}>
            {topics.map(([name, page], index) => (
              <motion.li key={name} {...row(index)}><strong>{name}</strong><span>{page}</span></motion.li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className={styles.visualCaption}><span>From your material</span><strong>Four topics, each linked to its page.</strong><small>Rename or remove any of them; nothing to fill in first.</small></figcaption>
    </figure>
  );
}

function RecallVisual({ visible, reduceMotion }: VisualProps) {
  const row = useRows(visible, reduceMotion);
  return (
    <figure className={`${styles.visual} ${styles.recallVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.question}>According to your notes, what happens if PED is less than 1?</p>
          <motion.p {...row(0)} className={`${sheets.choice} ${sheets.wrong}`}><i>×</i><s>Demand is elastic: quantity falls by more than price rises</s></motion.p>
          <motion.p {...row(1)} className={`${sheets.choice} ${sheets.right}`}><i>✓</i>Demand is inelastic: total revenue rises when price rises</motion.p>
          <motion.p {...row(2)} className={sheets.source}>That answer belongs to another line in your notes: “If PED is greater than 1, demand is elastic.”</motion.p>
        </div>
      </div>
      <figcaption className={styles.visualCaption}><span>From memory</span><strong>Three quick checks, then your own words.</strong><small>A wrong pick shows the line it came from, so the mix-up is clear.</small></figcaption>
    </figure>
  );
}

function RerouteVisual({ visible, reduceMotion }: VisualProps) {
  const row = useRows(visible, reduceMotion);
  return (
    <figure className={`${styles.visual} ${styles.rerouteVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.kicker}>Up next</p>
          <p className={sheets.title}>Price elasticity of demand</p>
          <p className={sheets.why}>Last time, 3 days ago, it needed another attempt. Determinants of elasticity builds on it.</p>
          <ul className={sheets.rows}>
            <motion.li {...row(0)}><strong>Determinants of elasticity</strong><span>New</span></motion.li>
            <motion.li {...row(1)}><strong>Income elasticity of demand</strong><span>Solid · in 5 days</span></motion.li>
          </ul>
        </div>
      </div>
      <figcaption className={styles.visualCaption}>
        <span>After that answer</span>
        <strong>The plan says why, in your own results.</strong>
        <small>A miss brings a topic forward; a pass gives it room.</small>
      </figcaption>
    </figure>
  );
}

const stages = [
  { number: "01", cue: "Source", icon: "folder", title: "Start with what you were taught.", body: "Add a lecture PDF, slides, notes or a Notion export. Kelus finds the topics and links each one back to its page. Rename or remove any topic, any time.", Visual: SourceVisual, tone: "source" },
  { number: "02", cue: "Recall", icon: "clipboard-check", title: "Show what you can recall.", body: "Each topic is three quick checks written from your own lines, then one explanation in your own words. Kelus lays it beside the page and shows what you left out, or said the wrong way round.", Visual: RecallVisual, tone: "recall" },
  { number: "03", cue: "Route", icon: "diagram-project", title: "See the route respond.", body: "A weak answer brings a topic forward; a stronger one gives it room. The next session starts from what actually happened, not a fixed schedule.", Visual: RerouteVisual, tone: "route" },
] as const;

function Chapter({ stage, reduceMotion }: { stage: (typeof stages)[number]; reduceMotion: boolean }) {
  const chapterRef = useRef<HTMLLIElement>(null);
  const visible = useInView(chapterRef, { once: true, margin: "-12% 0px -12%" });
  const { number, cue, icon, title, body, Visual, tone } = stage;
  // <li key={number} /> remains the chapter identity contract for the route test.

  return (
    <motion.li ref={chapterRef} className={styles.chapter} data-tone={tone}>
      <div className={styles.chapterText}>
        <motion.span className={styles.chapterLabel} initial={reduceMotion ? false : { opacity: 0, y: 8 }} animate={visible ? { opacity: 1, y: 0 } : undefined} transition={{ delay: reduceMotion ? 0 : .08, duration: .4, ease: kelusEase }}>
          <span>{number}</span><PackArt name={icon} className={styles.chapterIcon} />{cue}
        </motion.span>
        <motion.h2 initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={visible ? { opacity: 1, y: 0 } : undefined} transition={{ delay: reduceMotion ? 0 : .15, duration: .48, ease: kelusEase }}>{title}</motion.h2>
        <motion.p initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={visible ? { opacity: 1, y: 0 } : undefined} transition={{ delay: reduceMotion ? 0 : .22, duration: .48, ease: kelusEase }}>{body}</motion.p>
      </div>
      <motion.div className={styles.visualWrap} initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={visible ? { opacity: 1, y: 0 } : undefined} transition={{ duration: reduceMotion ? 0 : kelusDuration.normal, ease: kelusEase }}>
        <Visual visible={visible} reduceMotion={reduceMotion} />
      </motion.div>
    </motion.li>
  );
}

export function HowItWorks() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const motionPreference = useReducedMotion();
  const reduceMotion = !hydrated || motionPreference === true;
  const principleRef = useRef<HTMLElement>(null);
  const finalRef = useRef<HTMLElement>(null);
  const principleVisible = useInView(principleRef, { once: true, margin: "-12% 0px -12%" });
  const finalVisible = useInView(finalRef, { once: true, margin: "-12% 0px -12%" });
  // Keep the heading id explicit for route-surface contract checks.
  // <h1 id="how-title"/>

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="how-title">
        <motion.p className={styles.eyebrow} initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: kelusEase }}>How Kelus works</motion.p>
        <motion.h1 id="how-title" initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: reduceMotion ? 0 : 0.06, duration: 0.65, ease: kelusEase }}>Your lessons become <br />a better revision habit.</motion.h1>
        <motion.div className={styles.heroBottom} initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.14, duration: 0.5, ease: kelusEase }}>
          <p>Bring your course. Recall what you know. Let each answer shape what you practise next.</p>
          <Link className={styles.primaryAction} href="/today">Set up my course<span className={styles.primaryArrow} aria-hidden="true">→</span></Link>
        </motion.div>
      </section>
      <section className={styles.story} aria-label="The Kelus revision loop">
        <ol>
          {stages.map((stage) => <Chapter key={stage.number} stage={stage} reduceMotion={reduceMotion} />)}
        </ol>
      </section>
      <motion.section ref={principleRef} className={styles.principle} aria-labelledby="how-principle-title" initial={reduceMotion ? false : { opacity: 0, y: 18 }} animate={principleVisible ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.6, ease: kelusEase }}>
        <div className={styles.principleHeading}>
          <p className={styles.eyebrow}>What Kelus does—and doesn’t do</p>
          <h2 id="how-principle-title">A route to practise.<br />Not a predicted grade.</h2>
        </div>
        <div className={styles.principleAside}>
          <div className={`${styles.principleArt} ${sheets.principle}`} aria-hidden="true">
            <div className={sheets.sheet}>
              <p className={sheets.title}>Needs another attempt.</p>
              <p className={sheets.why}>0 of 3 checks right and 3 of 5 key ideas in your explanation, so it comes back tomorrow.</p>
            </div>
          </div>
          <p>Kelus uses your course material, exam date, and practice answers to choose what to revisit. Readiness is an estimate from that evidence, not a promise about your exam result.</p>
        </div>
      </motion.section>
      <section className={styles.questions} aria-labelledby="how-questions-title">
        <h2 id="how-questions-title">Before you begin</h2>
        <dl>
          <div><dt>What can I add?</dt><dd>A lecture PDF, slides, notes, a Notion export, or pasted text. Kelus finds the topics; you can rename or remove any of them.</dd></div>
          <div><dt>Do I need an account?</dt><dd>No. You can start revising for free on this device. Sign-in is optional when sync is available.</dd></div>
          <div><dt>Will Kelus predict my exam grade?</dt><dd>No. It uses your practice answers to suggest what to review next. Readiness is an estimate, not an exam prediction.</dd></div>
        </dl>
      </section>
      <motion.footer ref={finalRef} className={styles.final} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={finalVisible ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.55, ease: kelusEase }}>
        <p>Ready to revise your own lessons?</p>
        <Link className={styles.primaryAction} href="/today">Set up my course<span className={styles.primaryArrow} aria-hidden="true">→</span></Link>
      </motion.footer>
    </div>
  );
}
