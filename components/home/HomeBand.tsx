import Link from "next/link";
import styles from "./HomeBand.module.css";

/**
 * The same course carries the entire homepage. It is deliberately an observable product state rather than a list of
 * disconnected features: source evidence, an answer and the reason the next session changes all remain together.
 */
export function HomeBand() {
  return (
    <section className={styles.band} aria-labelledby="home-band-title">
      <div className={styles.claim}>
        <h2 id="home-band-title">Your answer changes <span>what happens next.</span></h2>
        <p>A session does not end with a score. Kelus keeps the original line beside your answer, then moves the topic only when your answer gives it a reason to.</p>
        <Link href="/today" className={styles.action}>Try it with your notes <span aria-hidden="true">→</span></Link>
      </div>
      <div className={styles.session} aria-label="Example study result from a Cell Transport course">
        <header><strong>Cell Transport</strong><span>One answer, checked</span></header>
        <div className={styles.sessionBody}>
          <div className={styles.evidence}>
            <span>From page 2</span>
            <p>Water moves from a dilute solution to a more concentrated solution through a partially permeable membrane.</p>
          </div>
          <div className={styles.verdict}>
            <span>Your answer</span>
            <p>“Water moves into the cell.”</p>
            <strong>Nearly there</strong>
            <small>The direction is right. The concentration difference is still missing.</small>
          </div>
        </div>
        <footer><span className={styles.dot} aria-hidden="true" /><b>Osmosis moves to tomorrow’s warm-up</b><small>because that missing idea changes the explanation.</small></footer>
      </div>
    </section>
  );
}
