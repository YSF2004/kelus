import { BrandIcon } from "@/components/BrandIcon";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import styles from "./HomeBand.module.css";

/** What students bring, named as their files are: the course PDFs in tests/fixtures/course-pdfs and a Notion export. */
const FILES = [
  { name: "biology-ch7-cell-transport.pdf", what: "Biology, 1 page", kind: "pdf" },
  { name: "econ-lecture-4-elasticity.pdf", what: "Economics lecture", kind: "pdf" },
  { name: "Revision notes", what: "Notion export", kind: "notion" },
  { name: "history-causes-ww1-handout.pdf", what: "History handout", kind: "pdf" },
  { name: "fiche-photosynthese.pdf", what: "Fiche de SVT", kind: "pdf" },
] as const;

/** The one big claim, on dark, as link.com does: any course a student was given, in its own files, goes in. */
export function HomeBand() {
  return (
    <section className={styles.band} aria-labelledby="home-band-title">
      <h2 id="home-band-title">Revise <span>any course</span> from the files you were given.</h2>
      <div className={styles.files} aria-hidden="true">
        <span className={styles.core}><KelusLogoMark /></span>
        <ul>
          {FILES.map(({ name, what, kind }, index) => (
            <li key={name} data-i={index}>
              {kind === "pdf" ? <i className={styles.pdf}>PDF</i> : <i className={styles.brandTile}><BrandIcon brand="notion" size={20} /></i>}
              <span><b>{name}</b>{what}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
