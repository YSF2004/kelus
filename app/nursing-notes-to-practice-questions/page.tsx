import type { Metadata } from "next";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

const title = "Nursing Notes to Practice Questions | Kelus";
const description = "Turn nursing lecture notes, slides and past papers into source-backed recall practice. Kelus shows the line behind each answer and what your notes do not yet support. Free pilot.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/nursing-notes-to-practice-questions/" },
  openGraph: {
    title: "Nursing revision from the notes you were taught",
    description,
    url: "/nursing-notes-to-practice-questions/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns a course source into source-backed recall practice." }],
  },
};

/**
 * This is an actual question from Kelus's test notes, not a nursing or NCLEX question. The pilot does not pretend
 * that a generic demo proves nursing accuracy; students bring the sources their own programme uses.
 */
const QUESTION = {
  topic: "Cell transport",
  ask: "Which one matches: “no net movement of water”?",
  choices: ["Isotonic", "Hypertonic", "Hypotonic"],
  answer: "Isotonic",
  line: "Isotonic: no net movement of water",
} as const;

const STEPS = [
  { title: "Bring the material your course uses", body: "Add lecture slides, readings, revision notes, or a past paper. Kelus reads the files on your device and proposes the topics it finds." },
  { title: "Answer before opening the source", body: "Practise short recall questions from the lines in your notes. After each answer, check the exact source line instead of trusting a plausible explanation." },
  { title: "See the gap while it is still useful", body: "Add a past paper after your notes. Kelus maps each prompt to the topics and sources it can support, so you can check a bad match and revisit the right material." },
] as const;

const FAQ = [
  { q: "Is this NCLEX preparation?", a: "Kelus is an early nursing-student pilot for revising the notes and past papers your own programme uses. It does not claim NCLEX alignment, offer clinical advice, or predict an exam result." },
  { q: "Can I add a past paper?", a: "Yes. Add your teaching material first, then label a second file as a past paper. Kelus shows which topics and source lines support each prompt; you can reject a wrong match." },
  { q: "Does Kelus invent medical answers?", a: "No. Kelus writes study prompts from your uploaded or pasted sources and keeps the supporting line nearby. Always check the source and your course guidance, especially for clinical material." },
  { q: "What files should I use?", a: "Start with one lecture or a focused revision sheet, then add a past paper if you have permission to use it. PDFs, slide exports, text, Markdown and Notion exports work best when their text can be selected." },
  { q: "Are my notes uploaded?", a: "No. Kelus reads files on this device and keeps them there unless you choose to sign in and sync. Its anonymous pilot label records only how the study flow is used, never your notes or answers." },
  { q: "Why call this a pilot?", a: "The workflow is available now, but the nursing fit still needs to be tested with real students and real course materials. Kelus will not claim results before that work is done." },
] as const;

export default function NursingNotesToPracticeQuestions() {
  return (
    <SearchLanding
      title={["Nursing revision,", "with your evidence beside you."]}
      lede="Bring the slides, readings, notes and past papers your course gave you. Kelus turns their lines into recall practice, then shows which past-paper prompts your notes do—or do not—support."
      action="Start the nursing pilot"
      landing="nursing-pilot"
      pilot="nursing-pilot"
      note={<>Free to start. No account. An early pilot for students revising their own course material—not clinical guidance.</>}
      exampleLabel="A real Kelus question from sample biology notes, with the source line shown after the answer"
      example={
        <div className={styles.question}>
          <p className={styles.questionAsk}>{QUESTION.topic} · a source-linked recall question</p>
          <p className={styles.questionLine}>{QUESTION.ask}</p>
          <ul className={styles.choices} aria-label="Choices">
            {QUESTION.choices.map((choice) => <li key={choice} data-right={choice === QUESTION.answer ? "" : undefined}>{choice}</li>)}
          </ul>
          <p className={styles.verdict}>Checked against your source. <span>Not a predicted exam score.</span></p>
          <p className={styles.questionSource}><b>Your notes</b> · “{QUESTION.line}”</p>
        </div>
      }
      steps={STEPS}
      why={{ title: "Use the notes you were taught. Check every link.", body: "A past-paper prompt can look familiar while asking about a gap in your course material. Kelus keeps the original line beside the answer and lets you reject a bad topic match, so the route improves without pretending to grade your readiness." }}
      faq={FAQ}
      credit="Example: sample cell-biology notes written for Kelus’s tests. This page is an early nursing-student pilot. Kelus is not affiliated with NCSBN or an educational institution."
    />
  );
}
