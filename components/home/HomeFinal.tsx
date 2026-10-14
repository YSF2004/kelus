import Link from "next/link";
import { PackArt } from "@/components/PackArt";
import styles from "./HomeFinal.module.css";

/** The last thing on the homepage: the promise in one line, the pack's target drawing, and the one way in. */
export function HomeFinal() {
  return (
    <section className={styles.final} aria-labelledby="home-final-title">
      <PackArt name="target" className={styles.art} size={150} />
      <div className={styles.copy}>
        <h2 id="home-final-title">Your exam, one topic at a time.</h2>
        <p>Add your notes now. Your first question is ready in about a minute, and it’s free.</p>
        {/* Facts we have checked ourselves, not testimonials: Kelus has no student results to quote yet. */}
        <ul className={styles.facts} aria-label="What we have checked">
          <li>Tested on real course layouts: slides, textbook chapters, two-column handouts, notes in French</li>
          <li>No account needed; your notes stay on your device</li>
          <li>Free, with no trial that runs out</li>
        </ul>
      </div>
      <Link href="/today" className={styles.action}>
        Add your notes <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
