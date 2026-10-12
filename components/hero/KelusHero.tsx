import Link from "next/link";
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
            Set up <span className={styles.primaryArrow} aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <div className={styles.visual}>
        <HeroProductVideo />
      </div>
    </section>
  );
}
