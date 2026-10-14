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
      </div>
      <Link href="/today" className={styles.action}>
        Add your notes <span aria-hidden="true">→</span>
      </Link>
    </section>
  );
}
