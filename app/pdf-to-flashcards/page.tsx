import type { Metadata } from "next";
import { BrandIcon } from "@/components/BrandIcon";
import { SearchLanding, searchStyles as styles } from "@/components/seo/SearchLanding";

export const metadata: Metadata = {
  title: "PDF to Flashcards, Free: From Your Own Pages | Kelus",
  description: "Turn a lecture PDF, slides or a textbook chapter into flashcards for free. Every card is written from a sentence on your page and shows where it came from. No account. Export to Anki.",
  alternates: { canonical: "/pdf-to-flashcards/" },
  openGraph: {
    title: "PDF to flashcards, from your own pages",
    description: "Free, no account: flashcards written from the sentences in your PDF, each with its page. Export to Anki.",
    url: "/pdf-to-flashcards/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns a PDF into flashcards written from its own pages." }],
  },
};

/**
 * Real output: what Kelus made from the LibreTexts BIOL 101 lab manual (123 pages, CC BY 4.0) on 2026-10-29, with
 * the reader in domain/material-intelligence.ts and the cards from domain/anki-export.ts. Not edited.
 */
const CARDS = [
  { front: ["Glucose and fructose are examples of ", " and are often called simple sugars."], back: "monosaccharides", topic: "Carbohydrates", page: 25 },
  { front: ["Two simple sugars bound together form a ", "."], back: "disaccharide", topic: "Carbohydrates", page: 25 },
  { front: ["The ", " building blocks of proteins are amino acids."], back: "monomer", topic: "Proteins", page: 29 },
] as const;

const STEPS = [
  { title: "Drop in your PDF", body: "A lecture deck, a textbook chapter, a handout or a scan. Photos of printed pages work too. It is read on your device." },
  { title: "Check the topics", body: "Kelus finds the sections in your file and names them. Keep the ones on your exam, remove the rest." },
  { title: "Study, or take them to Anki", body: "Answer the cards in Kelus, where what you miss comes back first, or export the deck to Anki." },
] as const;

const FAQ = [
  { q: "Is it free?", a: "Yes. Turning a PDF into flashcards and studying them is free, with no account and no trial that runs out." },
  { q: "Where do the cards come from?", a: "From your own sentences. Each card is written from a line in your PDF and shows its page, so you can check it against what you were taught. Kelus does not add facts from elsewhere." },
  { q: "Does it work with scanned PDFs and photos?", a: "Yes. Pages without selectable text are read on your device by text recognition. Printed pages and clear writing read best; messy handwriting does not read well yet." },
  { q: "What about PowerPoint or Google Slides?", a: "Export the deck as a PDF (File, then Download or Save as PDF) and drop that in. Kelus does not open .pptx files directly." },
  { q: "Can I export the flashcards to Anki?", a: "Yes. Every card can be exported as a file Anki imports, with the answer and the line it came from on the back." },
  { q: "Are my files uploaded?", a: "No. Your PDF is read and kept on your device. Signing in to sync is optional." },
] as const;

export default function PdfToFlashcards() {
  return (
    <SearchLanding
      title={["PDF to flashcards,", "from your own pages."]}
      lede="Drop in a lecture PDF, slides or a chapter. Kelus finds its topics and writes flashcards from your own sentences, and every card shows the page it came from."
      action="Turn a PDF into flashcards"
      note={<>Free. No account. Export to <BrandIcon brand="anki" size={14} /> Anki.</>}
      exampleLabel="A real example: flashcards Kelus wrote from the LibreTexts BIOL 101 lab manual"
      example={
        <>
          {/* A real run, not a mock-up: the file, what Kelus found in it, and three of the cards it wrote. */}
          <div className={styles.file}>
            <i aria-hidden="true">PDF</i>
            <span><b>BIOL 101 Laboratory Manual</b>LibreTexts, 123 pages</span>
            <span className={styles.found}><b>37</b> topics · <b>216</b> cards</span>
          </div>
          <ol className={styles.cards}>
            {CARDS.map(({ front, back, topic, page }) => (
              <li key={back} className={styles.card}>
                <p className={styles.front}>{front[0]}<span className={styles.blank} aria-label="blank">_____</span>{front[1]}</p>
                <p className={styles.back}><b>{back}</b><small>{topic} · Page {page}</small></p>
              </li>
            ))}
          </ol>
        </>
      }
      steps={STEPS}
      why={{ title: "Cards you can trust, because they quote you.", body: "Kelus only asks about what is on your page. The back of every card quotes the line it came from, and the cards you miss come back first, before anything new." }}
      faq={FAQ}
      credit="Example: LibreTexts BIOL 101: General Biology I Laboratory Manual by Brad Basehore, Michelle A. Bucks and Christine M. Mummert, CC BY 4.0. Kelus is not affiliated with LibreTexts."
    />
  );
}
