import type { Metadata } from "next";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "Quiz Me on My Notes, Free: Questions From Your Own Lines | Kelus",
  description: "Paste your notes or drop in a lecture PDF and Kelus quizzes you on them: questions written from your own sentences, each answer checked against the line it came from, missed lines back tomorrow. Free, no account.",
  alternates: { canonical: "/quiz-me-on-my-notes/" },
  openGraph: {
    title: "Quiz me on my notes: questions from your own lines",
    description: "Free, no account: Kelus quizzes you on your own notes, shows the line behind every answer, and brings back what you missed.",
    url: "/quiz-me-on-my-notes/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus quizzes you on your own notes." }],
  },
};

/**
 * One question as Kelus wrote it on 2026-10-30 from page 41 of the LibreTexts BIOL 101 lab manual (CC BY 4.0), through
 * domain/quick-run.ts, shown answered the way a session shows it. Not edited.
 */
const QUESTION = {
  topic: "Osmosis & Tonicity",
  page: "Page 41",
  ask: "According to your notes, what happens when cells are placed in a hypertonic solution?",
  choices: [
    "Water moves out of the cell into the higher free water solution",
    "An isotonic solution has the same concentration of solute (and therefore of free water) as the cell",
    "Water moves out of the cell into the lower free water solution",
    "A hypertonic solution has a higher solute (therefore, lower free water) concentration than the cell",
  ],
  answer: "Water moves out of the cell into the lower free water solution",
  line: "When cells are placed in a hypertonic solution, water moves out of the cell into the lower free water solution.",
} as const;

const STEPS = [
  { title: "Paste your notes or drop a PDF", body: "Typed notes, a lecture PDF, slides saved as PDF, a Notion export or a photo of a page. Kelus finds the topics in a few seconds." },
  { title: "Get quizzed on your own lines", body: "Choose the ending, spot the line that does not match, true or false, what comes next. Every question is written from a sentence you were taught." },
  { title: "Missed lines come back tomorrow", body: "Each answer shows the line it came from. What you get right waits longer; what you miss opens tomorrow’s one-minute warm-up." },
] as const;

const FAQ = [
  { q: "Is it free?", a: "Yes. The quiz, the study plan and exporting to Anki are free, with no account and no limit on questions." },
  { q: "Can I just paste my notes?", a: "Yes. Paste them as they are; a short line above a paragraph is read as a heading, so each topic gets its own questions." },
  { q: "Is it an AI chatbot?", a: "No. Kelus writes each question from a sentence in your notes, on your device, so it never quizzes you on something your course does not say." },
  { q: "What kinds of questions does it ask?", a: "Multiple choice built from your own lines, true or false, which line does not match, what comes next in a process, a word to complete a sentence, and one explanation in your own words." },
  { q: "Does it remember what I got wrong?", a: "Yes. A line you miss comes back first in tomorrow’s warm-up, and a line you know waits longer each time, until your exam." },
  { q: "Are my notes uploaded?", a: "No. Your notes are read on your device and stay there. Signing in to sync between devices is optional." },
] as const;

export default function QuizMeOnMyNotes() {
  return (
    <SearchLanding
      title={["Quiz me on my notes,", "with questions from my own lines."]}
      lede="Paste your notes or drop in a lecture PDF. Kelus asks you about what you were taught, checks each answer against the line it came from, and brings back what you missed the next day."
      action="Quiz me on my notes"
      note={<>Free. No account. Your notes stay on your device.</>}
      exampleLabel="A real example: one question Kelus wrote from the LibreTexts BIOL 101 lab manual, answered"
      example={
        <div className={styles.question}>
          <p className={styles.questionAsk}>{QUESTION.topic}</p>
          <p className={styles.questionLine}>{QUESTION.ask}</p>
          <ul className={`${styles.choices} ${styles.list}`} aria-label="Choices">
            {QUESTION.choices.map((choice) => <li key={choice} data-right={choice === QUESTION.answer ? "" : undefined}>{choice}</li>)}
          </ul>
          <p className={styles.verdict}>Right. <span>Box 1 to Box 2</span></p>
          <p className={styles.questionSource}><b>Your notes, {QUESTION.page.toLowerCase()}</b> · “{QUESTION.line}”</p>
        </div>
      }
      steps={STEPS}
      why={{ title: "Quizzed on what your lecturer said.", body: "A chatbot quiz can drift from your course. Every Kelus question comes from a sentence in your own notes and shows it with the answer, so what you practise is what your exam will test." }}
      faq={FAQ}
      credit="Example: LibreTexts BIOL 101: General Biology I Laboratory Manual by Brad Basehore, Michelle A. Bucks and Christine M. Mummert, CC BY 4.0. Kelus is not affiliated with LibreTexts."
    />
  );
}
