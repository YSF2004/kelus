import styles from "./FollowThrough.module.css";

/** A quiet, truthful view of a single source-backed correction. */
export function RevisionLoopVisuals() {
  return (
    <section className={styles.section} aria-labelledby="revision-loop-title">
      <div className={styles.intro}>
        <h2 id="revision-loop-title">A wrong answer becomes a clear next step.</h2>
        <p>Kelus keeps the source beside your answer, shows the exact idea that needs work, then explains what changes in your plan.</p>
      </div>

      <div className={styles.demo} aria-label="A source-backed Kelus correction">
        <div className={styles.demoTop}>
          <strong>Cell Biology</strong>
          <span>One source-backed correction</span>
        </div>

        <div className={styles.workspace}>
          <aside className={styles.source} aria-label="Original note excerpt">
            <p className={styles.sourceLabel}>Cell Transport.pdf · page 2</p>
            <h3>7.2 Osmosis</h3>
            <p>Osmosis is the net movement of water molecules from a dilute solution to a more <mark>concentrated solution</mark> through a partially permeable membrane.</p>
          </aside>

          <div className={styles.session}>
            <div className={styles.moment}>
              <p className={styles.status}>What Kelus noticed</p>
              <h3>Your direction was right. The destination was not.</h3>
              <p className={styles.answer}>You wrote: “From a dilute solution to the weaker side.”</p>
              <p className={styles.correction}>Your notes say <strong>more concentrated</strong>. Kelus brings osmosis back tomorrow so you can fix that distinction while it is still useful.</p>
              <div className={styles.nextItem}>
                <div><strong>Osmosis</strong><span>Revisit the concentration difference · about 3 min</span></div>
                <b>Tomorrow</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
