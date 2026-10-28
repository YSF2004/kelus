import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import styles from "./LeitnerHero.module.css";
import brands from "./HeroBrands.module.css";

/**
 * Questions Kelus writes from page 1 of the Cell Transport chapter (tests/fixtures/course-pdfs), each one from a line
 * that is marked on the page with the same number.
 */
const QUESTIONS = [
  { n: 1, where: "Page 1 · 7.1 Diffusion", ask: ["Diffusion moves particles from a region of ", " concentration to a lower one."], answer: "higher" },
  { n: 2, where: "Page 1 · 7.1 Diffusion", ask: ["Does diffusion need energy from respiration?"] },
  { n: 3, where: "Page 1 · 7.2 Osmosis", ask: ["Osmosis moves water from a dilute solution to a more ", " one."] },
];

/**
 * The first viewport says what Kelus does and shows its key step working: a page of the student's notes, three of its
 * lines marked in turn, a question written from each with its page, and the first one answered and checked against
 * the line it came from. The demonstration is labelled as an example course.
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

      <figure className={styles.panel} aria-label="Example: three lines of a page become questions, and an answer is checked against its line">
        <div className={styles.panelHead}><b>Cell Transport.pdf</b><span>Example course, page 1 of 1</span></div>
        <div className={styles.stage} aria-hidden="true">
          {/* The page as it was dropped in: real text, with the lines Kelus asks about marked in the order it reads them. */}
          <div className={styles.sheet}>
            <p className={styles.chapter}>7 Cell Transport</p>
            <p className={styles.intro}>Every cell must exchange substances with its surroundings. Oxygen and glucose must enter, and carbon dioxide and urea must leave.</p>
            <p className={styles.section}>7.1 Diffusion</p>
            <p>
              <mark className={styles.mark} data-n="1">Diffusion is the net movement of particles from a region of higher concentration to a region of lower concentration</mark>, down a concentration gradient.{" "}
              <mark className={styles.mark} data-n="2">It is a passive process, so it needs no energy from respiration.</mark>
            </p>
            <p className={styles.section}>7.2 Osmosis</p>
            <p>
              <mark className={styles.mark} data-n="3">Osmosis is the net movement of water molecules from a dilute solution to a more concentrated solution</mark>{" "}
              through a partially permeable membrane.
            </p>
          </div>
          <ol className={styles.cards}>
            {QUESTIONS.map(({ n, where, ask, answer }) => (
              <li key={n} className={styles.card} data-n={n}>
                <small><i>{n}</i>{where}</small>
                <p>
                  {ask[0]}
                  {ask.length > 1 ? <span className={styles.blank}>{answer ? <span className={styles.fill}>{answer}</span> : null}</span> : null}
                  {ask[1]}
                </p>
                {answer ? <span className={styles.checked}><b>Right.</b> It matches the line on page 1.</span> : null}
              </li>
            ))}
          </ol>
        </div>
        <figcaption className={styles.panelFoot}><span>Every question points back to its line.</span><span><b>3</b> lines marked so far</span></figcaption>
      </figure>

      {/* The tools students already keep notes in, by their own marks (simple-icons, in each brand's colour). */}
      <div className={`${brands.works} ${styles.works}`}>
        <span className={brands.label}>Works with</span>
        <ul className={brands.list} aria-label="Works with">
          <li><span className={brands.pdf} aria-hidden="true">PDF</span>PDFs and slides</li>
          <li><BrandIcon brand="notion" size={18} />Notion</li>
          <li><BrandIcon brand="obsidian" size={18} />Obsidian</li>
          <li><BrandIcon brand="markdown" size={18} />Markdown</li>
          <li><BrandIcon brand="anki" size={18} />Anki</li>
        </ul>
      </div>
    </section>
  );
}
