import type { Metadata } from "next";
import { BrandIcon } from "@/components/BrandIcon";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "PDF to Anki: Make Cards from Your Notes | Kelus",
  description: "Turn a lecture PDF, slides or a chapter into an Anki deck for free. Every card is written from a sentence on your page, with the line and page on the back. No account, imported with File → Import.",
  alternates: { canonical: "/pdf-to-anki/" },
  openGraph: {
    title: "PDF to Anki, from your own lecture pages",
    description: "Free, no account: an Anki deck written from the sentences in your PDF, each card with its line and page on the back.",
    url: "/pdf-to-anki/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns a PDF into an Anki deck written from its own pages." }],
  },
};

/**
 * One card as Kelus exported it from the LibreTexts BIOL 101 lab manual (CC BY 4.0) on 2026-10-29, through
 * domain/anki-export.ts: Anki's text import, Basic note type, a tag per topic. Not edited.
 */
const CARD = {
  front: ["Fill the gap from Page 25: “Glucose and fructose are examples of ", " and are often called simple sugars.”"],
  answer: "monosaccharides",
  quote: "Glucose and fructose are examples of monosaccharides and are often called simple sugars.",
  where: "Carbohydrates · Page 25",
  tags: "kelus Carbohydrates",
} as const;

const STEPS = [
  { title: "Drop in your PDF", body: "Lecture slides saved as PDF, a textbook chapter, a handout or a scan. Kelus reads it on your device and finds its topics." },
  { title: "Keep the topics on your exam", body: "Check the topics Kelus found and remove the ones you do not need. Every card comes from a line in what you keep." },
  { title: "Export, then File → Import", body: "In Topics, choose Export for Anki. In Anki, File → Import, pick the file, Import. The cards land in a deck named after your course." },
] as const;

const FAQ = [
  { q: "Is it free?", a: "Yes. Making the deck and exporting it is free, with no account and no limit on cards." },
  { q: "What does a card look like in Anki?", a: "The front is a question written from one of your sentences. The back has the answer in bold, the full line from your notes, and the topic and page it came from." },
  { q: "Which Anki note type does it use?", a: "Basic, from a tab-separated text file with HTML on. Anki reads the deck name and the tags from the file, so nothing needs setting up." },
  { q: "Does it work with lecture slides?", a: "Yes, once they are a PDF: in PowerPoint, Keynote or Google Slides, save or download the deck as PDF. Kelus does not open .pptx files directly." },
  { q: "Does it work with scanned PDFs and photos?", a: "Yes. Pages without selectable text are read on your device by text recognition. Printed pages and clear writing read best." },
  { q: "Are my files uploaded?", a: "No. Your PDF is read on your device and the Anki file is made there too. Signing in to sync is optional." },
] as const;

export default function PdfToAnki() {
  return (
    <SearchLanding
      title={["PDF to Anki,", "from your own lecture pages."]}
      lede="Drop in a lecture PDF, slides or a chapter. Kelus writes the cards from your own sentences, puts the line and its page on the back, and saves a deck Anki imports as it is."
      action="Turn a PDF into an Anki deck"
      landing="pdf-to-anki"
      note={<>Free. No account. Imports with <BrandIcon brand="anki" size={14} /> File → Import.</>}
      exampleLabel="A real example: one card Kelus exported to Anki from the LibreTexts BIOL 101 lab manual"
      example={
        <>
          {/* What Anki shows for one exported card, front then back, and what the file holds. */}
          <div className={styles.file}>
            <i aria-hidden="true" className={styles.txt}>TXT</i>
            <span><b>BIOL 101 Laboratory Manual – Anki.txt</b>216 cards from 123 pages · Basic · tagged by topic</span>
          </div>
          <div className={styles.ankiCard}>
            <p className={styles.ankiSide}>Front</p>
            <p className={styles.ankiFront}>{CARD.front[0]}<span className={styles.blank} aria-label="blank">_____</span>{CARD.front[1]}</p>
            <hr />
            <p className={styles.ankiSide}>Back</p>
            <p className={styles.ankiAnswer}>{CARD.answer}</p>
            <p className={styles.ankiQuote}>“{CARD.quote}”</p>
            <p className={styles.ankiWhere}>{CARD.where}</p>
          </div>
          <p className={styles.ankiTags}>Tags: <code>{CARD.tags}</code></p>
        </>
      }
      steps={STEPS}
      why={{ title: "A deck that matches what you were taught.", body: "Every card is written from a sentence in your lecture notes, and the back quotes it with its page. When your exam tests what the lecturer said, that is what you have practiced." }}
      faq={FAQ}
      credit="Example: LibreTexts BIOL 101: General Biology I Laboratory Manual by Brad Basehore, Michelle A. Bucks and Christine M. Mummert, CC BY 4.0. Kelus is not affiliated with LibreTexts or with Anki."
    />
  );
}
