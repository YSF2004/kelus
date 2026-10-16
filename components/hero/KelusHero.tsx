import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import { ArrowRight } from "@/components/Marks";
import { HeroProductVideo } from "./HeroProductVideo";
import styles from "./ProductVideoHero.module.css";

/**
 * What only Kelus does, said plainly, over a recording of the real first-use journey: the drop, a question from a
 * line, an answer checked against the page, and the plan moving. Chapters under the recording name each step.
 */
export function KelusHero() {
  return (
    <section className={`${styles.hero} is-poster`} aria-labelledby="home-hero-title" data-hero="product-video">
      <div className={styles.copy}>
        <h1 id="home-hero-title" className={styles.headline}>
          Questions from your notes.{" "}
          <span className={styles.secondLine}>Checked against the page.</span>
        </h1>

        <p className={styles.lede}>
          Drop in a PDF or paste your notes. Kelus asks you about your own lines, shows you the line when you slip, and
          brings it back first tomorrow.
        </p>

        <div className={styles.actions}>
          <Link href="/today" className={styles.primary}>
            Add your notes <ArrowRight className={`k-mark ${styles.primaryArrow}`} />
          </Link>
        </div>
      </div>

      <div className={styles.visual}>
        {/* The recording sits in a browser window, so it reads at once as the product, at its own address. */}
        <div className={styles.window}>
          <div className={styles.chrome} aria-hidden="true">
            <span className={styles.dots}><i /><i /><i /></span>
            <span className={styles.address}>kelus.me</span>
          </div>
          <HeroProductVideo />
        </div>
      </div>

      {/* One sentence, with only the marks students already know. No chips, no filler icons. */}
      <p className={styles.worksWith}>
        Works with PDFs and slides, <span className={styles.brand}><BrandIcon brand="notion" size={14} />Notion,</span>{" "}
        <span className={styles.brand}><BrandIcon brand="obsidian" size={14} />Obsidian,</span>{" "}
        <span className={styles.brand}><BrandIcon brand="markdown" size={15} />Markdown</span> and pasted notes, and sends your cards to{" "}
        <span className={styles.brand}><BrandIcon brand="anki" size={14} />Anki</span>.
      </p>
    </section>
  );
}
