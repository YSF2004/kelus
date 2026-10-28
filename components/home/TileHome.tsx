import Link from "next/link";
import { Figtree } from "next/font/google";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import { PackArt } from "@/components/PackArt";
import styles from "./TileHome.module.css";

/* One geometric sans for every line on this page, as on link.com (its face, Matter, is paid; Figtree is the closest
   open one): medium weight, tight tracking for titles, plain grey text under them. */
const figtree = Figtree({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-tile", display: "swap" });

/** Courses from tests/fixtures/course-pdfs, as students would name them. */
const COURSES = [
  { name: "Cell Transport", file: "Biology, chapter 7", tone: "a" },
  { name: "Elasticity", file: "Economics, lecture 4", tone: "b" },
  { name: "Causes of WW1", file: "History handout", tone: "c" },
  { name: "La photosynthèse", file: "Fiche de SVT", tone: "a" },
  { name: "Your next course", file: "Any PDF or notes", tone: "d" },
] as const;

const FEATURES = [
  { title: "Questions from your lines", body: "Every question is written from a sentence in your notes, never from a textbook you didn’t use.", art: "taking-note" },
  { title: "Checked against the page", body: "Your answer is laid beside the line it came from, with its page, so you see exactly what was missing.", art: "reviewing" },
  { title: "A plan that moves", body: "Right answers wait longer before they come back. A miss comes back tomorrow, first.", art: "time-flies" },
  { title: "Keep it in Anki", body: "Every question can go to Anki when you want it there. Nothing to rebuild.", art: "thinking" },
] as const;

/**
 * The homepage top in a tiled system: every block is one bordered tile on white, with one green word in the title,
 * one calm product moment on grey, a dark band for the one big claim, and a 2-by-2 grid of what Kelus does.
 */
export function TileHome() {
  return (
    <div className={`${figtree.variable} ${styles.page}`} data-hero="leitner">
      <section className={styles.hero} aria-labelledby="home-hero-title">
        <div className={styles.copy}>
          <p className={styles.pill}>Free, no account needed</p>
          <h1 id="home-hero-title">
            Questions from <span>your notes</span>. Checked against the page.
          </h1>
          <p className={styles.lede}>Drop in a PDF or paste your notes. Kelus asks about your own lines and checks each answer against the page.</p>
          <div className={styles.actions}>
            <Link href="/today" className={styles.primary}>Add your notes</Link>
            <Link href="/route" className={styles.secondary}>How it works</Link>
          </div>
        </div>

        {/* One product moment on a grey tile: a line of the notes, the question from it, and the answer checked. */}
        <figure className={styles.stage} aria-label="Example: a question written from a line of your notes, answered and checked against page 1">
          <div className={styles.moment} aria-hidden="true">
            <div className={styles.source}>
              <span className={styles.file}>PDF</span>
              <div>
                <b>Cell Transport.pdf</b>
                <small>Page 1, 7.1 Diffusion</small>
              </div>
            </div>
            <p className={styles.line}><mark>Diffusion is the net movement of particles from a region of higher concentration</mark> to a region of lower concentration.</p>
            <div className={styles.ask}>
              <p>Diffusion moves particles from a region of <span className={styles.blank}><span>higher</span></span> concentration to a lower one.</p>
              <span className={styles.right}>Right. It matches the line on page 1.</span>
            </div>
          </div>
        </figure>
      </section>

      {/* The one big claim, on dark: every course a student brings ends up in the same loop. */}
      <section className={styles.band} aria-labelledby="home-band-title">
        <h2 id="home-band-title">Revise <span>any course</span> from the notes you were given</h2>
        <div className={styles.orbit} aria-hidden="true">
          <span className={styles.core}><KelusLogoMark /></span>
          <ul>
            {COURSES.map(({ name, file, tone }, index) => (
              <li key={name} data-tone={tone} data-i={index}>
                <i>{name.slice(0, 1)}</i>
                <span><b>{name}</b>{file}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.grid} aria-label="What Kelus does">
        {FEATURES.map(({ title, body, art }) => (
          <article key={title} className={styles.tile}>
            <h3>{title}</h3>
            <p>{body}</p>
            <PackArt name={art} className={styles.art} size={art === "reviewing" ? 300 : 190} />
          </article>
        ))}
      </section>
    </div>
  );
}
