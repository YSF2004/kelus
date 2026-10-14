import Link from "next/link";
import { BrandIcon } from "@/components/BrandIcon";
import { HeroProductVideo } from "./HeroProductVideo";
import styles from "./ProductVideoHero.module.css";

/**
 * A recording of the real first-use journey, from upload to revised study plan.
 */
export function KelusHero() {
  return (
    <section className={`${styles.hero} is-poster`} aria-labelledby="home-hero-title" data-hero="product-video">
      <div className={styles.copy}>
        <h1 id="home-hero-title" className={styles.headline}>
          Revise your lessons.{" "}
          <span className={styles.secondLine}>Walk into the exam ready.</span>
        </h1>

        <p className={styles.lede}>
          Drop a PDF or paste your notes. Try a question from them. Your answer changes what you study next.
        </p>

        <div className={styles.actions}>
          <Link href="/today" className={styles.primary}>
            Add your notes <span className={styles.primaryArrow} aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className={styles.visual}>
        {/* The recording sits in a browser window, so it reads at once as the product, at its own address. */}
        <div className={styles.window}>
          <div className={styles.chrome} aria-hidden="true">
            <span className={styles.dots}><i /><i /><i /></span>
            <span className={styles.address}>kelus.me/today</span>
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
