"use client";

import Link from "next/link";
import { PackArt } from "@/components/PackArt";
import { Reveal } from "@/components/motion";
import styles from "./HomeVisualChapters.module.css";

export function StudyMoment() {
  return (
    <section className={styles.studySection} aria-labelledby="study-moment-title">
      <div className={styles.studyInner}>
        <Reveal className={styles.studyArt}>
          {/* From the Kelus illustration pack (Overflow Design, in the founder's Figma file). */}
          <PackArt name="thinking" className={styles.packArt} size={420} label="A student working through a problem" />
        </Reveal>
        <Reveal className={styles.studyCopy}>
          <h2 id="study-moment-title">The studying happens here.</h2>
          <p>Your own notes stay close while you answer, check, and decide what deserves another pass. One focused session, not more tabs to manage.</p>
          <Link href="/today" className={styles.textLink}>Set up my course <span aria-hidden="true">↗</span></Link>
        </Reveal>
      </div>
    </section>
  );
}

export function RevisionReturn() {
  return (
    <section className={styles.returnSection} aria-labelledby="revision-return-title">
      <div className={styles.returnInner}>
        <Reveal className={styles.returnCopy}>
          <h2 id="revision-return-title">Tomorrow starts where you slipped.</h2>
          <p>The lines you missed come back first, as a one-minute warm-up, before anything new. Then your next topic.</p>
        </Reveal>
        <Reveal className={styles.returnArt}>
          <PackArt name="taking-note" className={styles.packArt} size={220} />
        </Reveal>
      </div>
    </section>
  );
}
