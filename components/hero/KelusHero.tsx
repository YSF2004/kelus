import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import styles from "./LeitnerHero.module.css";
import brands from "./HeroBrands.module.css";

/**
 * Topics from the Cell Transport chapter (tests/fixtures/course-pdfs), in the boxes they sit in a few days in. Short
 * names, so every chip reads whole. Diffusion is the one being asked: it waits in Box 1 and moves when answered.
 */
const BOXES: Array<{ box: number; every: string; lines: Array<{ text: string; state?: "ok" | "miss" }> }> = [
  { box: 1, every: "Every day", lines: [{ text: "Osmosis", state: "miss" }, { text: "Root hairs" }, { text: "Villi" }] },
  { box: 2, every: "Every 2 days", lines: [{ text: "Carriers", state: "ok" }] },
  { box: 3, every: "Every 4 days", lines: [{ text: "Membranes", state: "ok" }, { text: "Gradients", state: "ok" }, { text: "Surface area", state: "ok" }] },
  { box: 4, every: "Every 9 days", lines: [{ text: "Alveoli", state: "ok" }] },
  { box: 5, every: "Monthly", lines: [{ text: "Turgid cells", state: "ok" }] },
];

/**
 * The first viewport says what Kelus does and shows it working: a question written from a line of the notes, the right
 * answer picked, the line it came from shown with its page, and that topic sliding from Box 1 to Box 2. The
 * demonstration is labelled as an example course.
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
      </div>

      <figure className={styles.panel} aria-label="Example: a line answered correctly moves from Box 1 to Box 2">
        <div className={styles.panelHead}><b>Cell Transport</b><span>Example course, 10 lines</span></div>
        <div className={styles.question} aria-hidden="true">
          <small>Which idea from your notes does this describe?</small>
          <p>“The net movement of particles from high to low concentration, down a gradient.”</p>
          <div className={styles.options}><span>Osmosis</span><span>Active transport</span><span className={styles.right}>Diffusion</span></div>
          {/* The check: the line the question came from, with its page, appears once the answer is in. */}
          <div className={styles.check}>
            <p className={styles.hint}>Pick one, and the line it came from opens here.</p>
            <p className={styles.source}>
              <span>Your notes, page 1</span>
              Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration.
            </p>
          </div>
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
              {/* Boxes 1 and 2 count before and after the move; the swap lands with the chip. */}
              {box <= 2 ? (
                <span className={styles.count}>
                  <span className={styles.before}>{lines.length + (box === 1 ? 1 : 0)}</span>
                  <span className={styles.after}>{lines.length + (box === 2 ? 1 : 0)}</span>
                </span>
              ) : (
                <span className={styles.count}>{lines.length}</span>
              )}
            </li>
          ))}
          <i className={styles.mover}>Diffusion</i>
        </ol>
        <figcaption className={styles.panelFoot}>
          <span className={styles.footSwap}>
            <span className={styles.before}>Diffusion is due today, in Box 1</span>
            <span className={styles.after}>Right: Diffusion moves to Box 2, back in 2 days</span>
          </span>
          <span className={styles.footSwap}>
            <span className={styles.before}><b>6</b> of 10 past Box 1</span>
            <span className={styles.after}><b>7</b> of 10 past Box 1</span>
          </span>
        </figcaption>
      </figure>

      {/* The tools students already keep notes in, by their own marks (simple-icons, in each brand's colour). */}
      <div className={`${brands.works} ${styles.works}`}>
        <span className={brands.label}>Works with</span>
        <ul className={brands.list} aria-label="Works with">
          <li><span className={brands.pdf} aria-hidden="true">PDF</span>PDFs and slides</li>
          <li><BrandIcon brand="notion" size={18} />Notion</li>
          <li><BrandIcon brand="obsidian" size={18} />Obsidian</li>
          <li><BrandIcon brand="markdown" size={18} />Markdown</li>
          <li><BrandIcon brand="anki" size={18} />Anki export</li>
        </ul>
      </div>
    </section>
  );
}
