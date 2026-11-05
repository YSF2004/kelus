import type { Metadata } from "next";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "Kelus",
  description: "Kelus vs NotebookLM for exam revision: Kelus quizzes you on your own notes word for word, brings back what you missed on a plan to your exam, and grades your explanation against the page. Free, no account.",
  alternates: { canonical: "/notebooklm-alternative/" },
  openGraph: {
    title: "Kelus vs NotebookLM: revising your own notes for an exam",
    description: "NotebookLM is great for asking questions about your sources. Kelus is built for the revision loop: questions from your own lines, missed lines back tomorrow, a plan to exam day. Free, no account.",
    url: "/notebooklm-alternative/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus writes questions from your own notes." }],
  },
};

/**
 * One question as Kelus wrote it on 2026-11-04 from the sample economics lecture in its test fixtures
 * (tests/fixtures/course-pdfs/econ-lecture-4-elasticity.pdf, written for Kelus): a "finish the line" check, through
 * domain/question-types.ts. The wrong endings are real lines from the lecture's other topics. Not edited.
 */
const QUESTION = {
  topic: "Income elasticity of demand",
  page: "Page 5",
  stem: "Income elasticity …",
  choices: [
    "… becomes more elastic over a longer time period",
    "… measures how demand for one good responds to the price of another good",
    "… measures how quantity demanded responds to a change in consumer income",
  ],
  answer: "… measures how quantity demanded responds to a change in consumer income",
} as const;

const STEPS = [
  { title: "Bring the notes you were taught", body: "A lecture PDF, slides, a chapter, a photo of a page or pasted notes. Kelus reads it on your device and finds its topics in the order of your notes." },
  { title: "Answer from memory, then check the page", body: "Every question is built from a sentence in your notes, word for word, and every answer shows that line. Then you explain the topic in your own words, and Kelus shows which key words of the page you used." },
  { title: "Come back to what you missed", body: "A line you miss opens tomorrow’s one-minute warm-up; one you get right waits longer before it returns. Set your exam date and the topics are spread over the days you have left." },
] as const;

// NotebookLM details as listed in November 2026 (Google's announcements and help pages); worded so each stays true
// if a feature changes. Check notebooklm.google for what it does today.
const ROWS = [
  ["Best at", "Revising your notes for an exam", "Asking questions across many sources"],
  ["How questions are written", "Built from your own sentences, word for word; nothing is generated", "Flashcards and quizzes written by Google’s AI from your sources"],
  ["Where each answer comes from", "The line and its page, on every answer", "Citations to your sources"],
  ["What you missed", "Comes back first, in tomorrow’s warm-up", "A new quiz when you ask for one"],
  ["A plan to your exam", "Topics spread over the days left, missed lines first", "Not part of NotebookLM"],
  ["Explaining in your own words", "Checked against the page: the key words you used and left out", "You can chat about any part of your sources"],
  ["Account and your notes", "No account; your notes are read and kept on your device", "A Google account; sources are processed by Google"],
  ["Price", "Free", "Free, with higher limits in Google’s paid plans"],
] as const;

const FAQ = [
  { q: "Should I use Kelus or NotebookLM?", a: "Use NotebookLM to explore and ask questions about your sources. Use Kelus to revise them: it asks you about each line, brings back what you missed, and plans the days until your exam. Many students can use both on the same notes." },
  { q: "Does Kelus use AI to write the questions?", a: "No. Each question is built from a sentence in your own notes, on your device, so it can never state a fact your course does not contain. The wrong options are real lines from your other topics." },
  { q: "NotebookLM has flashcards and quizzes too. What is different?", a: "NotebookLM writes them with AI when you ask. Kelus keeps a record of every line you have answered, so the ones you missed come back on their own the next day, and the ones you know wait longer." },
  { q: "Is Kelus really free?", a: "Yes. Reading your notes, every question, the plan to your exam and the Anki export are free, with no account and no trial that runs out." },
  { q: "Are my notes uploaded?", a: "No. Your files are read on your device and stay there. Signing in to sync between devices is optional." },
  { q: "What notes work best?", a: "Text you can select: lecture PDFs, slides, chapters, handouts, Notion or Markdown exports, and pasted notes. Scans and photos are read on your device too." },
] as const;

export default function NotebookLmAlternative() {
  return (
    <SearchLanding
      title={["Kelus vs NotebookLM,", "for revising your own notes."]}
      lede="NotebookLM is a strong tool for asking questions about your sources. Kelus is built for the part before an exam: it quizzes you on your own lines word for word, brings back what you missed, and plans what to revise until exam day."
      action="Try it with your notes"
      note={<>Free. No account. Your notes stay on your device.</>}
      exampleLabel="A real example: a question Kelus wrote from a sample economics lecture"
      example={
        <div className={styles.question}>
          <p className={styles.questionAsk}>Finish the line from your notes:</p>
          <p className={styles.questionLine}>“{QUESTION.stem}”</p>
          <ul className={styles.choices} aria-label="Choices">
            {QUESTION.choices.map((choice) => <li key={choice} data-right={choice === QUESTION.answer ? "" : undefined}>{choice}</li>)}
          </ul>
          <p className={styles.questionSource}><b>Your notes, {QUESTION.page.toLowerCase()}</b> · {QUESTION.topic}</p>
        </div>
      }
      steps={STEPS}
      compare={{
        title: "Kelus and NotebookLM, side by side.",
        other: "NotebookLM",
        asOf: "NotebookLM details as listed in November 2026. Check notebooklm.google for what it does today.",
        rows: ROWS,
        fair: "NotebookLM is the better choice when you want to chat with many sources at once, hear an Audio Overview, or work from YouTube videos and websites. Kelus is for the weeks before an exam, when you need to know which lines you can recall and see the rest again until you can.",
      }}
      why={{ title: "Revision is remembering, not reading again.", body: "Answering from memory and seeing what you missed come back is what makes a line stick. Kelus keeps track of every line in your notes, so each session starts with what you are most likely to forget." }}
      faq={FAQ}
      credit="Example: a sample lecture on elasticity written for Kelus’s tests. NotebookLM is a trademark of Google LLC; Kelus is not affiliated with Google."
    />
  );
}
