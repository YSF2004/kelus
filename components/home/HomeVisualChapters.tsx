"use client";

import Link from "next/link";
import { PackArt } from "@/components/PackArt";
import styles from "./HomeVisualChapters.module.css";

export function StudyMoment() {
  return (
    <section className={styles.studySection} aria-labelledby="study-moment-title">
      <div className={styles.studyInner}>
        <div className={styles.studyArt}>
          {/* From the Kelus illustration pack (Overflow Design, in the founder's Figma file). */}
          <PackArt name="thinking" className={styles.packArt} size={420} label="A student working through a problem" />
        </div>
        <div className={styles.studyCopy}>
          <h2 id="study-moment-title">Your notes stay open beside the question.</h2>
          <p>Miss one, and “Show it in your notes” opens that line with the lines around it. Listen reads it out. Every question comes from your own pages, so you never have to wonder where an answer came from.</p>
          <Link href="/today" className={styles.textLink}>Set up my course</Link>
        </div>
      </div>
    </section>
  );
}

export function RevisionReturn() {
  return (
    <section className={styles.returnSection} aria-labelledby="revision-return-title">
      <div className={styles.returnInner}>
        <div className={styles.returnCopy}>
          <h2 id="revision-return-title">Tomorrow starts where you slipped.</h2>
          <p>The lines you missed come back first, as a one-minute warm-up, before anything new. Then your next topic.</p>
        </div>
        <div className={styles.returnArt}>
          <PackArt name="taking-note" className={styles.packArt} size={220} />
        </div>
      </div>
    </section>
  );
}
