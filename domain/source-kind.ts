/**
 * Is this file something to revise? A CV, a cover letter, an invoice or a contract can be read, and its headings
 * look like topics ("Bachelor of Business", "Accounting Intern"), but nobody sits an exam on them. Kelus says so
 * before it builds a plan, and lets the student go on anyway: it never refuses a file, it only asks.
 */
export type SourceKind = "notes" | "cv" | "letter" | "invoice";

const CUES: Record<Exclude<SourceKind, "notes">, RegExp[]> = {
  cv: [
    /\b(?:curriculum vitae|résumé|resume)\b/i,
    /\b(?:work |professional )?experience\b/i,
    /\b(?:education|skills|languages|references|certifications|achievements|hobbies|interests)\b/i,
    /\b(?:intern(?:ship)?|internship|volunteer)\b/i,
    /\b(?:bachelor|master|bsc|ba|msc|mba|diploma)\b.{0,40}\b(?:of|in)\b/i,
    /\blinkedin\.com\b|\bgithub\.com\/\w/i,
    /\b(?:19|20)\d{2}\s*[–—-]\s*(?:(?:19|20)\d{2}|present|current|now|aujourd’hui)\b/i,
    /\b(?:expérience professionnelle|formation|compétences|langues|centres d’intérêt)\b/i,
  ],
  letter: [/\b(?:dear (?:sir|madam|hiring|mr|ms|mrs)|to whom it may concern|yours (?:sincerely|faithfully)|kind regards|madame, monsieur)\b/i, /\b(?:i am writing to|i am applying for|cover letter)\b/i],
  invoice: [/\b(?:invoice|facture|bill to|amount due|subtotal|vat|tva|total ttc|payment terms)\b/i, /\b(?:qty|quantity|unit price)\b/i],
};

const CONTACT = /[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d\s().-]{8,}\d/;

/** How much of the text teaches: sentences that define, explain or cause ("is", "are", "because", "means"). */
function teachingShare(text: string) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.split(/\s+/).length >= 6);
  if (!sentences.length) return 0;
  const teaching = sentences.filter((sentence) => /\b(?:is|are|means|refers to|because|causes?|leads? to|depends on|occurs|est|sont|signifie|parce que)\b/i.test(sentence));
  return teaching.length / sentences.length;
}

export function sourceKind(text: string): SourceKind {
  const sample = text.slice(0, 20_000);
  const hits = (kind: Exclude<SourceKind, "notes">) => CUES[kind].filter((cue) => cue.test(sample)).length;
  const teaches = teachingShare(sample);
  const contact = CONTACT.test(sample.slice(0, 1500));
  // A page that mostly explains is notes, whatever words it also contains (a lecture on CVs is still a lecture).
  if (teaches >= 0.45) return "notes";
  if (hits("invoice") >= 2) return "invoice";
  if (hits("letter") >= 1 && contact) return "letter";
  if (hits("cv") + (contact ? 1 : 0) >= 3) return "cv";
  return "notes";
}

export const KIND_NAME: Record<Exclude<SourceKind, "notes">, string> = { cv: "a CV", letter: "a letter", invoice: "an invoice" };
