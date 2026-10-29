import Link from "next/link";
import styles from "./HomeBand.module.css";

/**
 * Real, openly licensed course files and what Kelus's reader finds in them as they are (checked 2026-10-28 with the
 * reader in domain/material-intelligence.ts; the regression cases are in tests/course-pdfs.test.mjs). The French
 * sheet is Kelus's own test file and says so. A file with no real topics is shown too: Kelus says so, it does not guess.
 */
const FILES = [
  { source: "MIT OpenCourseWare", course: "HST.410J, Lecture 5", kind: "Lecture slides, 4 pages", topics: ["Random Walk Model", "Fick's First Law", "Importance of Scale"] },
  { source: "LibreTexts", course: "BIOL 101 Laboratory Manual", kind: "Lab manual, 123 pages", topics: ["Microscopes", "Carbohydrates", "Proteins", "Diffusion and Osmosis", "Mitosis and Meiosis I"], more: true },
  { source: "MIT OpenCourseWare", course: "HST.410J, Lecture 3", kind: "Slides, images removed", none: "Mostly images: Kelus says it found no topics, rather than guessing." },
  { source: "Kelus test file", course: "La photosynthèse", kind: "Fiche de révision, in French", topics: ["Définition", "Où a-t-elle lieu ?", "Facteurs limitants"], more: true },
] as const;

/** The one big claim, on dark: any course a student was given becomes topics, shown with what Kelus really found. */
export function HomeBand() {
  return (
    <section className={styles.band} aria-labelledby="home-band-title">
      <div className={styles.claim}>
        <h2 id="home-band-title">Bring <span>any course</span>. Kelus finds its topics.</h2>
        <p>Real course files, read as they are: an MIT lecture, a 123-page lab manual from LibreTexts, and a French revision sheet. These are the topics Kelus found.</p>
        <Link href="/today" className={styles.action}>Add your notes</Link>
        <p className={styles.credit}>
          MIT OpenCourseWare HST.410J, CC BY-NC-SA 4.0. LibreTexts BIOL 101: General Biology I Laboratory Manual by
          Brad Basehore, Michelle A. Bucks and Christine M. Mummert, CC BY 4.0. Kelus is not affiliated with either.
        </p>
      </div>
      <ul className={styles.files} aria-label="Topics Kelus finds in four course files">
        {FILES.map((file) => (
          <li key={file.course}>
            <span className={styles.file}>
              <i aria-hidden="true">PDF</i>
              <span><small>{file.source}</small><b>{file.course}</b>{file.kind}</span>
            </span>
            {"none" in file ? (
              <span className={styles.none}>{file.none}</span>
            ) : (
              <span className={styles.topics}>
                {file.topics.map((topic) => <em key={topic}>{topic}</em>)}
                {"more" in file ? <em className={styles.more}>and more</em> : null}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
