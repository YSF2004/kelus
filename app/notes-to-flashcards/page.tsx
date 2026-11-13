import type { Metadata } from "next";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "Turn Notes into Flashcards for Free | Kelus",
  description: "Turn your notes into flashcards for free. Paste typed notes or drop in a Notion export, Markdown file or PDF: Kelus writes each card from your own lines and brings back the ones you miss. No account.",
  alternates: { canonical: "/notes-to-flashcards/" },
  openGraph: {
    title: "Notes to flashcards, written from your own lines",
    description: "Free, no account: paste your notes and Kelus turns them into questions that quote your own lines, then brings back what you miss.",
    url: "/notes-to-flashcards/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns your notes into flashcards." }],
  },
};

/**
 * One question as Kelus wrote it on 2026-10-30 from the sample Notion export in tests/fixtures/notion-export.md (a
 * term and its meaning, "Isotonic: no net movement of water"), shown answered as a session shows it. Not edited.
 */
const QUESTION = {
  topic: "Osmosis",
  ask: "Which one matches: “no net movement of water”?",
  choices: ["Isotonic", "Hypertonic", "Hypotonic"],
  answer: "Isotonic",
  line: "Isotonic: no net movement of water",
} as const;

const STEPS = [
  { title: "Paste your notes, or drop the file", body: "Typed notes as they are, a Notion export, a Markdown file, an Obsidian vault or a PDF. Each heading becomes a topic." },
  { title: "Answer cards written from your lines", body: "Terms and their meanings, cases, steps, true or false: each card is built from a sentence or a line in your notes." },
  { title: "Keep only what you still need", body: "Cards you know come back later and later; the ones you miss come back tomorrow. Export them all to Anki whenever you like." },
] as const;

const FAQ = [
  { q: "Is it free?", a: "Yes. Turning notes into cards, studying them and exporting them to Anki are free, with no account." },
  { q: "Do I have to format my notes?", a: "No. Paste them as they are. A short line above a paragraph is read as a heading; a line like “Isotonic: no net movement of water” becomes a term to match." },
  { q: "Does it work with Notion and Obsidian?", a: "Yes. In Notion, export as Markdown & CSV and drop in the .zip. An Obsidian vault can be dropped as a folder or a zip." },
  { q: "Can I edit or remove cards?", a: "You can remove a topic, flag a question that is wrong, and choose which topics to keep before you start. The cards always come from your own lines." },
  { q: "Is it AI?", a: "No chatbot writes the cards. Kelus builds them from your notes on your device, so it never adds a fact your notes do not contain." },
  { q: "Are my notes uploaded?", a: "No. They are read on your device and stay there. Signing in to sync between devices is optional." },
] as const;

export default function NotesToFlashcards() {
  return (
    <SearchLanding
      title={["Notes to flashcards,", "written from your own lines."]}
      lede="Paste your notes or drop in a Notion export, a Markdown file or a PDF. Kelus turns each line worth knowing into a question, shows the line with the answer, and brings back the cards you miss."
      action="Turn my notes into flashcards"
      landing="notes-to-flashcards"
      note={<>Free. No account. Your notes stay on your device.</>}
      exampleLabel="A real example: one question Kelus wrote from sample Notion notes, answered"
      example={
        <div className={styles.question}>
          <p className={styles.questionAsk}>{QUESTION.topic}</p>
          <p className={styles.questionLine}>{QUESTION.ask}</p>
          <ul className={styles.choices} aria-label="Choices">
            {QUESTION.choices.map((choice) => <li key={choice} data-right={choice === QUESTION.answer ? "" : undefined}>{choice}</li>)}
          </ul>
          <p className={styles.verdict}>Right. <span>Box 1 to Box 2</span></p>
          <p className={styles.questionSource}><b>Your notes</b> · “{QUESTION.line}”</p>
        </div>
      }
      steps={STEPS}
      why={{ title: "Your notes already hold the cards.", body: "Writing flashcards by hand takes longer than revising. Kelus reads the notes you already have and asks about every line worth knowing, in your own words." }}
      faq={FAQ}
      credit="Example: sample cell biology notes exported from Notion, written for Kelus’s tests. Kelus is not affiliated with Notion or Obsidian."
    />
  );
}
