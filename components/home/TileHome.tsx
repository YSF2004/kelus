import Link from "next/link";
import { PackArt } from "@/components/PackArt";
import { HomeBand } from "@/components/home/HomeBand";
import styles from "./TileHome.module.css";

const FEATURES = [
  { title: "Questions from your lines", body: "Every question is written from a sentence in your notes, never from a textbook you didn’t use.", art: "taking-note" },
  { title: "Checked against the page", body: "Your answer is laid beside the line it came from, with its page, so you see exactly what was missing.", art: "reviewing" },
  { title: "A plan that moves", body: "Right answers wait longer before they come back. A miss comes back tomorrow, first.", art: "time-flies" },
  { title: "Keep it in Anki", body: "Every question can go to Anki when you want it there. Nothing to rebuild.", art: "thinking" },
] as const;

/** A calm, source-first homepage: one clear promise, one product moment, then proof and detail. */
export function TileHome() {
  return (
    <div className={styles.page} data-hero="leitner">
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Free · no account needed</p>
          <h1 id="home-hero-title">Questions from your notes. <span>Checked against the page.</span></h1>
          <p className={styles.lede}>Bring a PDF, a photo or the notes your class uses. Kelus turns that material into short recall practice.</p>
          <div className={styles.actions}>
            <Link href="/today" className={styles.primary}>Add your notes</Link>
            <Link href="/route" className={styles.secondary}>How it works</Link>
          </div>
        </div>

        <figure className={styles.stage} aria-label="Example: a question from your course notes, checked against its source page">
          <div className={styles.moment} aria-hidden="true">
            <div className={styles.source}>
              <span className={styles.file}>PDF</span>
              <div><b>Cell Transport.pdf</b><small>Example course · Page 1, 7.1 Diffusion</small></div>
            </div>
            <p className={styles.line}><mark>Diffusion is the net movement of particles from a region of higher concentration</mark> to a region of lower concentration.</p>
            <div className={styles.ask}>
              <p>Diffusion moves particles from a region of <span className={styles.blank}><span>higher</span></span> concentration to a lower one.</p>
              <p className={styles.right}>Right. It matches the line on page 1.</p>
            </div>
          </div>
        </figure>
      </section>

      <HomeBand />

      <section className={styles.grid} aria-label="What Kelus does">
        {FEATURES.map(({ title, body, art }) => (
          <article key={title} className={styles.tile}>
            <h2>{title}</h2>
            <p>{body}</p>
            <PackArt name={art} className={styles.art} size={art === "reviewing" ? 300 : 190} />
          </article>
        ))}
      </section>
    </div>
  );
}
