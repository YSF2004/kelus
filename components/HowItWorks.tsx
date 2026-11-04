"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { kelusDuration, kelusEase } from "@/components/motion";
import { revealTarget, useReveal } from "@/components/motion/entrance";
import { rise } from "@/components/motion/rise";
import { BrandIcon } from "@/components/BrandIcon";
import { Cross, Tick } from "@/components/Marks";
import { PackArt } from "@/components/PackArt";
import styles from "./how/HowItWorks.module.css";
import sheets from "./how/HowSheets.module.css";

type VisualProps = { hidden: boolean };

/**
 * A chapter's rows arrive with it once it scrolls into view (see useReveal). Only where order is the message, the
 * route reordering after an answer, do they come one after another.
 */
function useRows(hidden: boolean, inOrder = false) {
  return (index: number) => ({
    initial: false as const,
    animate: revealTarget(hidden, 6),
    transition: { duration: 0.4, delay: 0.25 + (inOrder ? index * 0.08 : 0), ease: kelusEase },
  });
}

/* The pictures are the product itself, at small size: the same type, colours and words a student sees. */

function SourceVisual({ hidden }: VisualProps) {
  const row = useRows(hidden);
  const topics = [["Diffusion", "Page 1"], ["Osmosis", "Page 2"], ["Active transport", "Page 3"]] as const;
  return (
    <figure className={`${styles.visual} ${styles.sourceVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.kicker}>Biology, Cell Transport, 3 pages</p>
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

function RecallVisual({ hidden }: VisualProps) {
  const row = useRows(hidden);
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
      <figcaption className={styles.visualCaption}><span>From memory</span><strong>A few quick checks, then your own words.</strong><small>A wrong pick shows the line it came from, so the mix-up is clear.</small></figcaption>
    </figure>
  );
}

function RerouteVisual({ hidden }: VisualProps) {
  // The plan reordering after an answer: here the order is the point.
  const row = useRows(hidden, true);
  return (
    <figure className={`${styles.visual} ${styles.rerouteVisual}`}>
      <div className={styles.art}>
        <div className={sheets.sheet} aria-hidden="true">
          <p className={sheets.kicker}>Up next</p>
          <p className={sheets.title}>Osmosis</p>
          <p className={sheets.why}>Last time, 3 days ago, it came out partly right. Active transport builds on it.</p>
          <ul className={sheets.rows}>
            <motion.li {...row(0)}><strong>Active transport</strong><span>New</span></motion.li>
            <motion.li {...row(1)}><strong>Diffusion</strong><span>Solid, back in 5 days</span></motion.li>
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

function KeepVisual({ hidden }: VisualProps) {
  const row = useRows(hidden);
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
  { number: "02", cue: "Recall", icon: "clipboard-check", title: "Show what you can recall.", body: "Each topic is up to three quick checks written from your own lines, then one explanation in your own words. Kelus lays it beside the page and shows what you left out, or said the wrong way round.", Visual: RecallVisual, tone: "recall" },
  { number: "03", cue: "Route", icon: "diagram-project", title: "See the plan respond.", body: "A weak answer brings a topic forward; a stronger one gives it room. The next session starts from what actually happened, not a fixed schedule.", Visual: RerouteVisual, tone: "route" },
  { number: "04", cue: "Keep", icon: "award", title: "Keep what you learned.", body: "Each session ends on what you practised and what comes back. The lines you missed open tomorrow as a one-minute warm-up, and every question can go to Anki.", Visual: KeepVisual, tone: "route" },
] as const;

function Chapter({ stage }: { stage: (typeof stages)[number] }) {
  const { ref: chapterRef, hidden } = useReveal<HTMLLIElement>();
  const { title, body, Visual, tone } = stage;
  // <li key={number} /> remains the chapter identity contract for the route test.

  return (
    <motion.li ref={chapterRef} className={styles.chapter} data-tone={tone}>
      <div className={styles.chapterText}>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      <div className={styles.visualWrap}>
        <Visual hidden={hidden} />
      </div>
    </motion.li>
  );
}

export function HowItWorks() {
  // The top rises with CSS from the first frame; the chapters and the closing action reveal as they scroll in.
  const { ref: finalRef, hidden: finalHidden } = useReveal<HTMLElement>();
  // Keep the heading id explicit for route-surface contract checks.
  // <h1 id="how-title"/>

  return (
    <div className={styles.page}>
      <section className={styles.hero} aria-labelledby="how-title">
        {/* From the Kelus illustration pack: two people going over an answer together. */}
        <span className={`${styles.heroArt} k-rise`} style={rise(0.1, { duration: 0.6 })} aria-hidden="true">
          <PackArt name="reviewing" size={340} />
        </span>
        <h1 id="how-title">Your lessons become <br />a better revision habit.</h1>
        <div className={styles.heroBottom}>
          <p>Bring your course. Recall what you know. Let each answer shape what you practise next.</p>
          <Link className={styles.primaryAction} href="/today">Set up my course<span className={styles.primaryArrow} aria-hidden="true">→</span></Link>
        </div>
      </section>
      <section className={styles.story} aria-label="The Kelus revision loop">
        <ol>
          {stages.map((stage) => <Chapter key={stage.number} stage={stage} />)}
        </ol>
      </section>
      <section className={styles.questions} aria-labelledby="how-questions-title">
        <h2 id="how-questions-title">Before you begin</h2>
        <dl>
          <div><dt>What can I add?</dt><dd>A lecture PDF, slides, notes, a Notion export, or pasted text. Kelus finds the topics; you can rename or remove any of them.</dd></div>
          <div><dt>Do I need an account?</dt><dd>No. You can start revising for free on this device. Sign-in is optional when sync is available.</dd></div>
          <div><dt>Will Kelus predict my exam grade?</dt><dd>No. It gives you a plan to practise, not a predicted grade: what to review next, from your own answers. Readiness is an estimate from that evidence, never a promise about your result.</dd></div>
        </dl>
      </section>
      <motion.footer ref={finalRef} className={styles.final} initial={false} animate={revealTarget(finalHidden, 14)} transition={{ duration: 0.55, ease: kelusEase }}>
        <p>Ready to revise your own lessons?</p>
        <Link className={styles.primaryAction} href="/today">Set up my course<span className={styles.primaryArrow} aria-hidden="true">→</span></Link>
      </motion.footer>
    </div>
  );
}
