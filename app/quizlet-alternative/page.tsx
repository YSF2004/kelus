import type { Metadata } from "next";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "Kelus",
  description: "Looking for a free Quizlet alternative? Kelus reads your lecture PDF or notes, writes the questions from your own lines, and plans what to revise until the exam. Free, no account, nothing invented by a chatbot.",
  alternates: { canonical: "/quizlet-alternative/" },
  openGraph: {
    title: "A free Quizlet alternative that quizzes you on your own notes",
    description: "No sets to make or borrow: Kelus writes the questions from your lecture notes, shows the line each comes from, and plans your revision. Free, no account.",
    url: "/quizlet-alternative/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus writes questions from your own notes." }],
  },
};

/**
 * One question as Kelus wrote it on 2026-10-30 from the LibreTexts BIOL 101 lab manual (CC BY 4.0): a first-visit
 * word choice, through domain/quick-run.ts. Not edited.
 */
const QUESTION = {
  topic: "Importance of a Control Group",
  page: "Page 10",
  before: "The control group is the group used for a ",
  after: "; it serves as a baseline against which the effects of a treatment can be evaluated.",
  choices: ["possible", "manipulated", "comparison", "experience"],
  answer: "comparison",
} as const;

const STEPS = [
  { title: "Bring the notes you were taught", body: "A lecture PDF, slides saved as PDF, a chapter, a photo of a page or pasted notes. Kelus reads it on your device and finds its topics." },
  { title: "Answer questions from your own lines", body: "Each question is written from a sentence in your notes, and the answer shows that line and its page. No sets to make, nothing borrowed from strangers." },
  { title: "Let the plan bring back what you missed", body: "A line you get right waits longer before it comes back; one you miss opens tomorrow’s one-minute warm-up, until the exam." },
] as const;

// Quizlet details as listed in October 2026 (plan pages and reviews); worded so each stays true if a plan changes.
const ROWS = [
  ["Study material from your own notes", "Free: drop in a PDF, a photo or pasted notes", "Magic Notes, part of Quizlet Plus"],
  ["Quiz rounds", "Unlimited, free", "A few Learn and Test rounds a day on the free plan"],
  ["Where each question comes from", "Shown on every answer: the line and its page", "The card set you made or found"],
  ["What to revise next", "A plan to your exam date; missed lines come back first", "Learn mode rounds within a set"],
  ["Account", "None needed; notes stay on your device", "Needed to make and save sets"],
  ["Price", "Free", "Free plan; Quizlet Plus is about $8 a month"],
] as const;

const FAQ = [
  { q: "Is Kelus really free?", a: "Yes. Reading your notes, every question, the study plan and the Anki export are free, with no account and no trial that runs out." },
  { q: "Does it use AI to write the questions?", a: "No chatbot writes them. Kelus builds each question from a sentence in your own notes, on your device, so it never invents a fact your course does not contain." },
  { q: "Can I import my Quizlet sets?", a: "Not yet. Kelus starts from your notes rather than from term lists. If you also use Anki, Kelus exports its questions as an Anki deck." },
  { q: "Does it work on my phone?", a: "Yes. Kelus runs in the browser on a phone or a laptop, and you can add it to your home screen to open it like an app." },
  { q: "What notes work best?", a: "Text you can select: lecture PDFs, chapters, handouts, Markdown or Notion exports, and pasted notes. Scans and photos are read on your device too." },
  { q: "Are my notes uploaded?", a: "No. Your files are read on your device and stay there. Signing in to sync between devices is optional." },
] as const;

export default function QuizletAlternative() {
  return (
    <SearchLanding
      title={["A free Quizlet alternative", "that quizzes you on your own notes."]}
      lede="No sets to make or borrow. Drop in the notes you were taught: Kelus writes the questions from your own lines, shows the line behind every answer, and plans what to revise until the exam."
      action="Try it with your notes"
      note={<>Free. No account. Your notes stay on your device.</>}
      exampleLabel="A real example: one question Kelus wrote from the LibreTexts BIOL 101 lab manual"
      example={
        <div className={styles.question}>
          <p className={styles.questionAsk}>Which word completes this statement from your notes?</p>
          <p className={styles.questionLine}>
            “{QUESTION.before}<span className={styles.blank} aria-label="blank">_____</span>{QUESTION.after}”
          </p>
          <ul className={styles.choices} aria-label="Choices">
            {QUESTION.choices.map((choice) => <li key={choice} data-right={choice === QUESTION.answer ? "" : undefined}>{choice}</li>)}
          </ul>
          <p className={styles.questionSource}><b>Your notes, {QUESTION.page.toLowerCase()}</b> · {QUESTION.topic}</p>
        </div>
      }
      steps={STEPS}
      compare={{
        title: "Kelus and Quizlet, side by side.",
        other: "Quizlet",
        asOf: "Quizlet details as listed in October 2026. Check quizlet.com for its current plans.",
        rows: ROWS,
        fair: "Quizlet is the better choice when someone has already made a good set for your course, when you want its games and native apps, or when you are learning vocabulary lists. Kelus is for revising the notes your own lecturer gave you.",
      }}
      why={{ title: "Questions from what your lecturer said.", body: "A borrowed set is someone else’s course. Kelus asks about the sentences in your own notes and quotes them back, so what you practise is what your exam will test." }}
      faq={FAQ}
      credit="Example: LibreTexts BIOL 101: General Biology I Laboratory Manual by Brad Basehore, Michelle A. Bucks and Christine M. Mummert, CC BY 4.0. Quizlet is a trademark of Quizlet, Inc.; Kelus is not affiliated with Quizlet or LibreTexts."
    />
  );
}
