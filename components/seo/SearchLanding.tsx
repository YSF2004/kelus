import Link from "next/link";
import type { ReactNode } from "react";
import { LateralPage } from "@/components/PageTransition";
import { RelatedSearchPages } from "@/components/seo/RelatedSearchPages";
import { SearchStartLink } from "@/components/seo/SearchStartLink";
import { SiteFooter } from "@/components/SiteFooter";
import styles from "./SearchLanding.module.css";

export { styles as searchStyles };

export type SearchLandingProps = {
  /** The heading, then the phrase set in the quieter tone: "PDF to flashcards," / "from your own pages." */
  title: [string, string];
  lede: string;
  action: string;
  note: ReactNode;
  /** A real run of Kelus on an openly licensed file, never a mock-up. */
  example: ReactNode;
  exampleLabel: string;
  steps: ReadonlyArray<{ title: string; body: string }>;
  why: { title: string; body: string };
  faq: ReadonlyArray<{ q: string; a: string }>;
  credit: string;
  /** Stable, non-personal identifier used only to measure this page's handoff to the product. */
  landing: string;
  /** Optional pilot group: a non-identifying label attached to this browser's later study events. */
  pilot?: string;
  /** "X alternative" pages: Kelus beside the other app, row by row, then when the other app is the better choice. */
  compare?: { title: string; other: string; asOf: string; rows: ReadonlyArray<readonly [string, string, string]>; fair: string };
};

/**
 * A search landing page in the homepage's tile system: the promise and one action, a real example on a grey stage,
 * three steps, one claim on the dark band, and the questions people search next (also as FAQPage data).
 */
export function SearchLanding({ title, lede, action, note, example, exampleLabel, steps, why, faq, credit, landing, pilot, compare }: SearchLandingProps) {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  return (
    <LateralPage>
      <div className={`home ${styles.page}`} data-marketing="editorial">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
        <main id="main">
          <section className={styles.hero} aria-labelledby="search-title">
            <div className={styles.copy}>
              <h1 id="search-title">{title[0]} <span>{title[1]}</span></h1>
              <p className={styles.lede}>{lede}</p>
              <div className={styles.actions}>
                <SearchStartLink action={action} landing={landing} pilot={pilot} placement="hero" className={styles.primary} />
                <Link href="/route" className={styles.secondary}>How it works</Link>
              </div>
              <p className={styles.free}>{note}</p>
            </div>
            <figure className={styles.stage} aria-label={exampleLabel}>{example}</figure>
          </section>

          <section className={styles.steps} aria-label="How it works, in three steps">
            {steps.map(({ title: step, body }, index) => (
              <article key={step} className={styles.step}>
                <h2><span>{index + 1}</span>{step}</h2>
                <p>{body}</p>
              </article>
            ))}
          </section>

          {compare ? (
            <section className={styles.compare} aria-labelledby="search-compare">
              <h2 id="search-compare">{compare.title}</h2>
              <table>
                <thead><tr><th scope="col"><span className="sr-only">What you need</span></th><th scope="col">Kelus</th><th scope="col">{compare.other}</th></tr></thead>
                <tbody>
                  {compare.rows.map(([need, kelus, other]) => (
                    <tr key={need}><th scope="row">{need}</th><td>{kelus}</td><td>{other}</td></tr>
                  ))}
                </tbody>
              </table>
              <p className={styles.compareNote}>{compare.asOf}</p>
              <p className={styles.fair}>{compare.fair}</p>
            </section>
          ) : null}

          <section className={styles.why} aria-labelledby="search-why">
            <h2 id="search-why">{why.title}</h2>
            <p>{why.body}</p>
          </section>

          <section className={styles.faq} aria-labelledby="search-faq">
            <h2 id="search-faq">Questions</h2>
            <dl>
              {faq.map(({ q, a }) => (
                <div key={q}><dt>{q}</dt><dd>{a}</dd></div>
              ))}
            </dl>
            <SearchStartLink action={action} landing={landing} pilot={pilot} placement="faq" className={styles.primary} />
            <p className={styles.credit}>{credit}</p>
          </section>

          <RelatedSearchPages />
        </main>
        <SiteFooter />
      </div>
    </LateralPage>
  );
}
