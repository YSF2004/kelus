import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import styles from "./page.module.css";

const title = "Turn Lecture PDFs into Practice Questions | Kelus";
const description =
  "Add a course PDF or your own notes. Kelus makes source-linked recall questions, checks what you remember, and shows what to revise next. Start free.";

export const metadata: Metadata = {
  title: "Kelus",
  description,
  alternates: { canonical: "/pdf-to-practice-questions" },
  openGraph: {
    title,
    description,
    url: "/pdf-to-practice-questions/",
    siteName: "Kelus",
    images: [
      {
        url: "/og/kelus-social.png",
        width: 1200,
        height: 630,
        alt: "Kelus turns course notes into recall practice and a study plan.",
      },
    ],
  },
};

export default function PdfToPracticeQuestionsPage() {
  return (
    <div className={styles.page}>
      <main id="main">
        <section className={styles.hero} aria-labelledby="page-title">
          <div className={styles.heroCopy}>
            <h1 id="page-title">Your PDF is the lesson. Make it the practice too.</h1>
            <p>
              Add the notes you were actually taught. Kelus finds the topics, asks questions from those pages,
              and brings back what you missed when you revise again.
            </p>
            <Link className={styles.primary} href="/today">
              Add your PDF or notes <span aria-hidden="true">→</span>
            </Link>
            <p className={styles.microcopy}>
              {/* Hosted question-writing is off on kelus.me (NEXT_PUBLIC_AI_ENDPOINT is empty), so the questions are
                  written on the device. If it is ever switched on, say here that a topic's text may be sent. */}
              Free to start, no account needed. Your notes stay on this device unless you choose to sync them.{" "}
              <Link href="/privacy#ai-questions">How questions are written</Link>
            </p>
          </div>
          <div className={styles.example} aria-label="Example of a source-linked practice question">
            <p className={styles.source}>From a biology lesson · Cell transport</p>
            <p className={styles.sourceLine}>“In a hypotonic solution, a plant cell gains water and becomes turgid.”</p>
            <div className={styles.exampleRule} />
            <p className={styles.recallLabel}>Try from memory</p>
            <p className={styles.question}>What happens to a plant cell in a hypotonic solution?</p>
            <p className={styles.exampleNote}>An illustrative question. Your own questions come from your material.</p>
          </div>
        </section>

        <section className={styles.process} aria-labelledby="process-title">
          <div className={styles.processIntro}>
            <h2 id="process-title">From reading to remembering.</h2>
            <p>
              A PDF-to-quiz tool can give you a list of questions. Kelus goes one step further: your answers
              change which topic comes next. It is built for exam revision, not for producing a quiz file and
              leaving you to plan the rest.
            </p>
          </div>
          <ol className={styles.steps}>
            <li>
              <h3>Bring the source.</h3>
              <p>
                Add a lecture PDF, slides, a revision sheet or pasted notes. Kelus reads the text and proposes
                topics tied to the source. You can rename or remove a topic before studying it. Keep the original
                page nearby so you can check what a question is based on.
              </p>
            </li>
            <li>
              <h3>Answer without looking.</h3>
              <p>
                Start with a few short checks, then explain an idea in your own words. After you answer, compare
                it with the relevant line from your notes. Seeing the source matters: a plausible-sounding
                question is only useful when it matches what your course actually says.
              </p>
            </li>
            <li>
              <h3>Let the next session change.</h3>
              <p>
                A missed idea comes back sooner. A stronger answer gives that topic more room. The study plan
                shows why it picked the next topic, using your results rather than asking you to guess what you
                should revise. You can return to the source whenever the explanation is unclear.
              </p>
            </li>
          </ol>
        </section>

        <section className={styles.advice} aria-labelledby="advice-title">
          <div>
            <h2 id="advice-title">Make the questions worth answering.</h2>
            <p>
              Start with one chapter or lecture, not your entire course archive. A focused source makes it
              easier to see whether the suggested topics belong to that lesson. Look over the topics before
              beginning; fix a vague title or remove a heading that is not really a concept. Then answer
              from memory before opening the source. Rereading first can make an idea feel familiar without
              telling you whether you can recall it in an exam.
            </p>
            <p>
              If a question seems wrong, check the quoted page rather than memorising its wording. Course
              documents can be messy: multi-column pages, image-heavy slides and scanned handwriting may not
              extract cleanly. Kelus can read some scans on your device, but you should review the extracted
              topics and source text before trusting the practice. For a difficult scan, pasted notes or a
              clearer PDF may work better.
            </p>
          </div>
          <aside className={styles.aside} aria-label="What Kelus accepts">
            <h3>Start with what you have</h3>
            <ul>
              <li>Lecture and course PDFs</li>
              <li>Slides exported as PDF</li>
              <li>Markdown, text and Notion exports</li>
              <li>Notes pasted directly into Kelus</li>
            </ul>
            <p>Your files stay on this device unless you choose to sync.</p>
          </aside>
        </section>

        <section className={styles.close} aria-labelledby="close-title">
          <h2 id="close-title">Try it with one real lesson.</h2>
          <p>
            You do not need a finished study plan to begin. Add a source, check the proposed topics, and see
            what you can recall. If you want to understand every step first, read <Link href="/route">how Kelus works</Link>.
          </p>
          <Link className={styles.primary} href="/today">
            Add your PDF or notes <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
