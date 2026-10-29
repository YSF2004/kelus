import type { Metadata } from "next";
import { BrandIcon } from "@/components/BrandIcon";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "Lecture Slides to Flashcards, Free: From Your Own Deck | Kelus",
  description: "Turn lecture slides into flashcards for free. Save your PowerPoint, Keynote or Google Slides deck as a PDF; Kelus writes cards from what each slide says, each with its page (one slide per page). Export to Anki.",
  alternates: { canonical: "/lecture-slides-to-flashcards/" },
  openGraph: {
    title: "Lecture slides to flashcards, from your own deck",
    description: "Free, no account: flashcards written from the words on your lecture slides, each with the page it came from. Export to Anki.",
    url: "/lecture-slides-to-flashcards/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns lecture slides into flashcards written from each slide." }],
  },
};

/**
 * Real output: Kelus's own example deck (tests/fixtures/course-pdfs/econ-lecture-4-elasticity.pdf, a 7-slide
 * economics lecture saved as PDF), read on 2026-10-29: 4 topics, 18 cards. Each card is shown beside its slide.
 */
const PAIRS = [
  { slide: 3, heading: "Price elasticity of demand", front: ["Which idea from your notes does this describe? “This idea measures how much the quantity demanded responds to a change in price.”", ""], back: "Price elasticity of demand" },
  { slide: 4, heading: "Determinants of elasticity", front: ["Demand becomes more elastic over a ", " time period."], back: "longer" },
  { slide: 6, heading: "Cross-price elasticity", front: ["Substitutes have ", " cross-price elasticity; complements such as printers and ink have negative cross-price elasticity."], back: "positive" },
] as const;

const STEPS = [
  { title: "Save the deck as a PDF", body: "PowerPoint: File, Save As, PDF. Keynote: File, Export To, PDF. Google Slides: File, Download, PDF. Then drop it in." },
  { title: "One topic per slide heading", body: "Kelus reads each slide's heading and text, groups them into topics, and skips the title slide and the learning-objectives slide." },
  { title: "Study, or export to Anki", body: "Answer the cards in Kelus, where the ones you miss come back first, or take the deck to Anki. Every card shows its page: one slide per page." },
] as const;

const FAQ = [
  { q: "Is it free?", a: "Yes. Turning a deck into flashcards and studying them is free, with no account." },
  { q: "Can I upload a .pptx file?", a: "Not directly. Save or download the deck as a PDF first (PowerPoint, Keynote and Google Slides all can), then drop the PDF in." },
  { q: "What if my slides are mostly pictures?", a: "Kelus writes cards from the words on a slide, so slides that are mostly images or diagrams give few cards. A deck with headings and short points works best." },
  { q: "Are the cards made up by AI?", a: "No. Each card is written from a line on one of your slides and shows its page (one slide per page in the PDF), so you can check it against the lecture." },
  { q: "Can I export to Anki?", a: "Yes. The deck exports as a file Anki imports with File → Import, with the answer and the slide's line on the back." },
  { q: "Are my slides uploaded?", a: "No. The PDF is read on your device. Signing in to sync is optional." },
] as const;

export default function LectureSlidesToFlashcards() {
  return (
    <SearchLanding
      title={["Lecture slides to flashcards,", "from your own deck."]}
      lede="Save your lecture slides as a PDF and drop them in. Kelus writes flashcards from what each slide says, and every card shows the page it came from: one slide per page."
      action="Turn slides into flashcards"
      note={<>Free. No account. Export to <BrandIcon brand="anki" size={14} /> Anki.</>}
      exampleLabel="A real example: flashcards Kelus wrote from a seven-slide economics lecture"
      example={
        <>
          {/* A real run: the deck, what Kelus found in it, and three cards, each beside the slide it came from. */}
          <div className={styles.file}>
            <i aria-hidden="true">PDF</i>
            <span><b>Lecture 4: Elasticity</b>Economics slides, saved as PDF · 7 slides</span>
            <span className={styles.found}><b>4</b> topics · <b>18</b> cards</span>
          </div>
          <ol className={styles.cards}>
            {PAIRS.map(({ slide, heading, front, back }) => (
              <li key={slide} className={styles.slideRow}>
                <span className={styles.slide} aria-label={`Slide ${slide}: ${heading}`}><small>Slide {slide}</small><b>{heading}</b></span>
                <span className={styles.card}>
                  <p className={styles.front}>{front[0]}{front[1] ? <><span className={styles.blank} aria-label="blank">_____</span>{front[1]}</> : null}</p>
                  <p className={styles.back}><b>{back}</b><small>Page {slide}</small></p>
                </span>
              </li>
            ))}
          </ol>
        </>
      }
      steps={STEPS}
      why={{ title: "Practise what the lecture actually said.", body: "The cards come from your lecturer's own slides, not from a summary of the subject. When the exam follows the lecture, so does your practice." }}
      faq={FAQ}
      credit="Example: Kelus's own example lecture deck (Economics, Lecture 4: Elasticity), the slides file Kelus is tested on."
    />
  );
}
