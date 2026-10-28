import Link from "next/link";
import styles from "./HomeBand.module.css";

/**
 * What Kelus finds in real course files: the four layouts in tests/fixtures/course-pdfs and the topics
 * tests/course-pdfs.test.mjs checks for each, on every change. The French sheet lists its first three, as the test does.
 */
const FILES = [
  { course: "Cell Transport", kind: "Biology textbook chapter", topics: ["Diffusion", "Osmosis", "Active transport"] },
  { course: "Lecture 4: Elasticity", kind: "Economics slides", topics: ["Price elasticity of demand", "Determinants of elasticity", "Income elasticity of demand", "Cross-price elasticity"] },
  { course: "Causes of WW1", kind: "History handout, two columns", topics: ["Militarism", "Alliances", "Imperialism", "Nationalism", "The assassination at Sarajevo"] },
  { course: "La photosynthèse", kind: "Fiche de révision", topics: ["Définition", "Où a-t-elle lieu ?", "Facteurs limitants"], more: true },
] as const;

/** The one big claim, on dark: any course a student was given becomes topics, shown with what Kelus really found. */
export function HomeBand() {
  return (
    <section className={styles.band} aria-labelledby="home-band-title">
      <div className={styles.claim}>
        <h2 id="home-band-title">Bring <span>any course</span>. Kelus finds its topics.</h2>
        <p>Slides, a textbook chapter, a two-column handout, a French fiche: these are the topics Kelus finds in four real course files, checked on every change.</p>
        <Link href="/today" className={styles.action}>Add your notes</Link>
      </div>
      <ul className={styles.files} aria-label="Topics Kelus finds in four course files">
        {FILES.map((file) => (
          <li key={file.course}>
            <span className={styles.file}>
              <i aria-hidden="true">PDF</i>
              <span><b>{file.course}</b>{file.kind}</span>
            </span>
            <span className={styles.topics}>
              {file.topics.map((topic) => <em key={topic}>{topic}</em>)}
              {"more" in file ? <em className={styles.more}>and more</em> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
