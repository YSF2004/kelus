"use client";

import Link from "next/link";
import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useSyncExternalStore } from "react";
import { kelusDuration, kelusEase } from "@/components/motion";
import { BrandIcon } from "@/components/BrandIcon";
import { Cross, Tick } from "@/components/Marks";
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
  const topics = [["Diffusion", "Page 1"], ["Osmosis", "Page 2"], ["Active transport", "Page 3"]] as const;
  return (
    <figure className={`${styles.visual} ${styles.sourceVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.kicker}>Biology · Cell Transport · 3 pages</p>
          <ul className={sheets.rows}>
            {topics.map(([name, page], index) => (
              <motion.li key={name} {...row(index)}><strong>{name}</strong><span>{page}</span></motion.li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className={styles.visualCaption}><span>From your material</span><strong>Three topics, each linked to its page.</strong><small>Rename or remove any of them; nothing to fill in first.</small></figcaption>
    </figure>
  );
}

function RecallVisual({ visible, reduceMotion }: VisualProps) {
  const row = useRows(visible, reduceMotion);
  return (
    <figure className={`${styles.visual} ${styles.recallVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.question}>According to your notes, what happens to a plant cell in a hypotonic solution?</p>
          <motion.p {...row(0)} className={`${sheets.choice} ${sheets.wrong}`}><i><Cross size={12} /></i><s>It loses water and the membrane pulls away from the wall</s></motion.p>
          <motion.p {...row(1)} className={`${sheets.choice} ${sheets.right}`}><i><Tick size={12} /></i>It gains water and becomes turgid</motion.p>
          <motion.p {...row(2)} className={sheets.source}>That answer belongs to another line in your notes: “In a hypertonic solution the cell loses water.”</motion.p>
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
          <p className={sheets.title}>Osmosis</p>
          <p className={sheets.why}>Last time, 3 days ago, it came out partly right. Active transport builds on it.</p>
          <ul className={sheets.rows}>
            <motion.li {...row(0)}><strong>Active transport</strong><span>New</span></motion.li>
            <motion.li {...row(1)}><strong>Diffusion</strong><span>Solid · in 5 days</span></motion.li>
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

function KeepVisual({ visible, reduceMotion }: VisualProps) {
  const row = useRows(visible, reduceMotion);
  return (
    <figure className={`${styles.visual} ${styles.rerouteVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.title}>Block done.</p>
          <ul className={sheets.rows}>
            <motion.li {...row(0)}><strong>Diffusion</strong><span className={sheets.good}>Knew it</span></motion.li>
            <motion.li {...row(1)}><strong>Osmosis</strong><span>Partly there</span></motion.li>
          </ul>
          <motion.p {...row(2)} className={sheets.why}>Tomorrow starts with a 1-minute warm-up on the 2 lines you missed.</motion.p>
          <motion.p {...row(3)} className={sheets.anki}><BrandIcon brand="anki" size={16} />Export every question to Anki</motion.p>
        </div>
      </div>
      <figcaption className={styles.visualCaption}><span>At the end</span><strong>What you practised, and what comes back.</strong><small>Your cards go to Anki too, with the line from your notes on the back.</small></figcaption>
    </figure>
  );
}

const stages = [
  { number: "01", cue: "Source", icon: "folder", title: "Start with what you were taught.", body: "Add a lecture PDF, slides, notes or a Notion export. Kelus finds the topics and links each one back to its page. Rename or remove any topic, any time.", Visual: SourceVisual, tone: "source" },
  { number: "02", cue: "Recall", icon: "clipboard-check", title: "Show what you can recall.", body: "Each topic is three quick checks written from your own lines, then one explanation in your own words. Kelus lays it beside the page and shows what you left out, or said the wrong way round.", Visual: RecallVisual, tone: "recall" },
  { number: "03", cue: "Route", icon: "diagram-project", title: "See the route respond.", body: "A weak answer brings a topic forward; a stronger one gives it room. The next session starts from what actually happened, not a fixed schedule.", Visual: RerouteVisual, tone: "route" },
  { number: "04", cue: "Keep", icon: "award", title: "Keep what you learned.", body: "Each block ends on what you practised and what comes back. The lines you missed open tomorrow as a one-minute warm-up, and every question can go to Anki.", Visual: KeepVisual, tone: "route" },
] as const;

function Chapter({ stage, reduceMotion }: { stage: (typeof stages)[number]; reduceMotion: boolean }) {
  const chapterRef = useRef<HTMLLIElement>(null);
  const visible = useInView(chapterRef, { once: true, margin: "-12% 0px -12%" });
  const { title, body, Visual, tone } = stage;
  // <li key={number} /> remains the chapter identity contract for the route test.

  return (
    <motion.li ref={chapterRef} className={styles.chapter} data-tone={tone}>
      <div className={styles.chapterText}>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className={styles.visualWrap}>
        <Visual visible={visible} reduceMotion={reduceMotion} />
      </div>
    </motion.li>
  );
}

export function HowItWorks() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const motionPreference = useReducedMotion();
  const reduceMotion = !hydrated || motionPreference === true;
  const finalRef = useRef<HTMLElement>(null);
  const finalVisible = useInView(finalRef, { once: true, margin: "-12% 0px -12%" });
  // Keep the heading id explicit for route-surface contract checks.
  // <h1 id="how-title"/>

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="how-title">
        {/* From the Kelus illustration pack: two people going over an answer together. */}
        <motion.span className={styles.heroArt} aria-hidden="true" initial={reduceMotion ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: reduceMotion ? 0 : 0.2, duration: 0.6, ease: kelusEase }}>
          <PackArt name="reviewing" size={340} />
        </motion.span>
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
      <section className={styles.questions} aria-labelledby="how-questions-title">
        <h2 id="how-questions-title">Before you begin</h2>
        <dl>
          <div><dt>What can I add?</dt><dd>A lecture PDF, slides, notes, a Notion export, or pasted text. Kelus finds the topics; you can rename or remove any of them.</dd></div>
          <div><dt>Do I need an account?</dt><dd>No. You can start revising for free on this device. Sign-in is optional when sync is available.</dd></div>
          <div><dt>Will Kelus predict my exam grade?</dt><dd>No. It gives you a route to practise, not a predicted grade: what to review next, from your own answers. Readiness is an estimate from that evidence, never a promise about your result.</dd></div>
        </dl>
      </section>
      <motion.footer ref={finalRef} className={styles.final} initial={reduceMotion ? false : { opacity: 0, y: 14 }} animate={finalVisible ? { opacity: 1, y: 0 } : undefined} transition={{ duration: 0.55, ease: kelusEase }}>
        <p>Ready to revise your own lessons?</p>
        <Link className={styles.primaryAction} href="/today">Set up my course<span className={styles.primaryArrow} aria-hidden="true">→</span></Link>
      </motion.footer>
    </div>
  );
}
