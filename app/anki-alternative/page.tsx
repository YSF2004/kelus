import type { Metadata } from "next";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "An Anki Alternative That Writes the Cards From Your Notes | Kelus",
  description: "Like Anki, without making every card by hand. Kelus reads your lecture PDF or notes, writes the questions from your own lines, and spaces them out to your exam. Free, no account, and it exports to Anki.",
  alternates: { canonical: "/anki-alternative/" },
  openGraph: {
    title: "An Anki alternative that writes the cards from your notes",
    description: "Spaced repetition without hours of card-making: Kelus writes the questions from your own lines. Free, and it exports to Anki.",
    url: "/anki-alternative/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus writes the cards from your notes." }],
  },
};

/** One question as Kelus wrote it on 2026-10-30 from the LibreTexts BIOL 101 lab manual (CC BY 4.0). Not edited. */
const QUESTION = {
  topic: "Importance of a Control Group",
  page: "Page 10",
  before: "The control group is the group used for a ",
  after: "; it serves as a baseline against which the effects of a treatment can be evaluated.",
  choices: ["possible", "manipulated", "comparison", "experience"],
  answer: "comparison",
} as const;

const STEPS = [
  { title: "Bring your lecture notes", body: "A PDF, slides saved as PDF, a chapter, a photo of a page, or notes from Notion, Obsidian or a text file." },
  { title: "Kelus writes the cards", body: "Questions from your own sentences: choices, true or false, what comes next, a word to complete a line. Nothing to type." },
  { title: "Spaced out to your exam", body: "Five boxes, as Leitner drew them: a card you know waits longer, a card you miss comes back tomorrow, until exam day." },
] as const;

// Anki details as of October 2026 (apps.ankiweb.net); worded so each stays true if a version changes.
const ROWS = [
  ["Making the cards", "Written for you from your notes", "You write each card, or import a shared deck"],
  ["Spacing", "Five Leitner boxes, planned to your exam date", "A scheduler you can tune (FSRS or SM-2)"],
  ["Where a card comes from", "Every answer shows its line and page", "Whatever you put on the card"],
  ["Getting started", "Drop a file in the browser; no install, no account", "Install the app; an AnkiWeb account to sync"],
  ["Price", "Free", "Free on desktop, Android and web; the iPhone app is paid"],
  ["Moving between them", "Exports every question as an Anki deck", "Imports that deck with File → Import"],
] as const;

const FAQ = [
  { q: "Is Kelus free?", a: "Yes. Reading your notes, every question, the plan to your exam and the Anki export are free, with no account." },
  { q: "Can I still use Anki?", a: "Yes. Kelus exports its questions as an Anki deck, each card with its line and page on the back, so you can keep reviewing in Anki." },
  { q: "Is it spaced repetition?", a: "Yes, with five Leitner boxes: a line you recall moves to a later box and comes back less often; a line you miss goes back to the first box and comes back tomorrow." },
  { q: "Does it use AI to write cards?", a: "No chatbot writes them. Each question is built on your device from a sentence in your notes, so it never adds a fact your course does not contain." },
  { q: "Does it work on my phone?", a: "Yes, in the browser, and you can add it to your home screen to open it like an app. Nothing to install." },
  { q: "Are my notes uploaded?", a: "No. Your files are read on your device and stay there. Signing in to sync between devices is optional." },
] as const;

export default function AnkiAlternative() {
  return (
    <SearchLanding
      title={["An Anki alternative", "that writes the cards from your notes."]}
      lede="Spaced repetition without the hours of card-making. Drop in your lecture PDF or notes: Kelus writes the questions from your own lines, spaces them out to your exam, and exports them to Anki if you want both."
      action="Try it with your notes"
      note={<>Free. No account. Exports to Anki.</>}
      exampleLabel="A real example: one question Kelus wrote from the LibreTexts BIOL 101 lab manual"
      example={
        <div className={styles.question}>
          <p className={styles.questionAsk}>Which word completes this statement from your notes?</p>
          <p className={styles.questionLine}>“{QUESTION.before}<span className={styles.blank} aria-label="blank">_____</span>{QUESTION.after}”</p>
          <ul className={styles.choices} aria-label="Choices">
            {QUESTION.choices.map((choice) => <li key={choice} data-right={choice === QUESTION.answer ? "" : undefined}>{choice}</li>)}
          </ul>
          <p className={styles.questionSource}><b>Your notes, {QUESTION.page.toLowerCase()}</b> · {QUESTION.topic}</p>
        </div>
      }
      steps={STEPS}
      compare={{
        title: "Kelus and Anki, side by side.",
        other: "Anki",
        asOf: "Anki details as of October 2026. Check apps.ankiweb.net for current versions.",
        rows: ROWS,
        fair: "Anki is the better choice for years of review across thousands of cards, for decks your class already shares, and when you want full control over every card and its schedule. Kelus is for getting from this term’s notes to exam day without writing the cards yourself, and it can hand them to Anki.",
      }}
      why={{ title: "The cards are already in your notes.", body: "Making flashcards is the part of Anki that eats the evening. Kelus writes them from the lines you were taught and quotes each line back, so the time goes into remembering." }}
      faq={FAQ}
      credit="Example: LibreTexts BIOL 101: General Biology I Laboratory Manual by Brad Basehore, Michelle A. Bucks and Christine M. Mummert, CC BY 4.0. Anki is a trademark of its developers; Kelus is not affiliated with Anki or LibreTexts."
    />
  );
}
