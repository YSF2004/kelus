import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import styles from "./LeitnerHero.module.css";
import brands from "./HeroBrands.module.css";

/** Lines from the Cell Transport chapter (tests/fixtures/course-pdfs), set in the boxes they sit in a few days in. */
const BOXES: Array<{ box: number; every: string; lines: Array<{ text: string; state?: "ok" | "miss" }> }> = [
  { box: 1, every: "Every day", lines: [{ text: "Water moves from the dilute side", state: "miss" }, { text: "Active transport needs energy" }, { text: "Root hair cells absorb ions" }] },
  { box: 2, every: "Every 2 days", lines: [{ text: "Diffusion is a passive process", state: "ok" }] },
  { box: 3, every: "Every 4 days", lines: [{ text: "A partially permeable membrane", state: "ok" }, { text: "Carrier proteins in the membrane", state: "ok" }] },
  { box: 4, every: "Every 9 days", lines: [{ text: "Alveoli and villi have a large surface", state: "ok" }] },
  { box: 5, every: "Monthly", lines: [{ text: "A plant cell becomes turgid", state: "ok" }] },
];

/**
 * The first viewport says what Kelus does and shows it working: a question written from a line of the notes, the right
 * answer picked, and that line sliding from Box 1 to Box 2. The demonstration is labelled as an example course.
 */
export function KelusHero() {
  return (
    <section className={styles.hero} aria-labelledby="home-hero-title" data-hero="leitner">
      <div className={styles.copy}>
        <h1 id="home-hero-title" className={styles.headline}>
          Questions from your notes. <span>Checked against the page.</span>
        </h1>
        <p className={styles.lede}>
          Drop in a PDF or paste your notes. Kelus asks you about your own lines. Recall one and it moves to a later box;
          miss it and it comes back first tomorrow.
        </p>
        <div className={styles.actions}>
          <Link href="/today" className={styles.primary}>Add your notes</Link>
          <span className={styles.free}>Free. No account needed.</span>
        </div>
        {/* The tools students already keep notes in, by their own marks (simple-icons, in each brand's colour). */}
        <div className={brands.works}>
          <span className={brands.label}>Works with</span>
          <ul className={brands.list} aria-label="Works with">
            <li><span className={brands.pdf} aria-hidden="true">PDF</span>PDFs and slides</li>
            <li><BrandIcon brand="notion" size={18} />Notion</li>
            <li><BrandIcon brand="obsidian" size={18} />Obsidian</li>
            <li><BrandIcon brand="markdown" size={18} />Markdown</li>
            <li><BrandIcon brand="anki" size={18} />Anki export</li>
          </ul>
        </div>
      </div>

      <figure className={styles.panel} aria-label="Example: a line answered correctly moves from Box 1 to Box 2">
        <div className={styles.panelHead}><b>Cell Transport</b><span>Example course, 10 lines</span></div>
        <div className={styles.question} aria-hidden="true">
          <small>Which idea from your notes does this describe?</small>
          <p>“The net movement of particles from high to low concentration, down a gradient.”</p>
          <div className={styles.options}><span>Osmosis</span><span>Active transport</span><span className={styles.right}>Diffusion</span></div>
        </div>
        <ol className={styles.boxes} aria-hidden="true">
          {BOXES.map(({ box, every, lines }) => (
            <li key={box} className={styles.box}>
              <b>Box {box}</b>
              <small>{every}</small>
              <span className={styles.marks}>
                {box <= 2 ? <i className={styles.gap} /> : null}
                {lines.map((line) => <i key={line.text} data-state={line.state}>{line.text}</i>)}
              </span>
              <span className={styles.count}>{lines.length + (box === 2 ? 1 : 0)}</span>
            </li>
          ))}
          <i className={styles.mover}>The net movement of particles</i>
        </ol>
        <figcaption className={styles.panelFoot}><span>Right answer: Box 1 to Box 2</span><span><b>6</b> of 10 recalled</span></figcaption>
      </figure>
    </section>
  );
}
