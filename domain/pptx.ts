import { listZip, ZipError } from "./zip-read";

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'" };
const decode = (text: string) => text
  .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&(amp|lt|gt|quot|apos);/g, (_m, name) => ENTITIES[name]);

/** A slide's paragraphs in reading order: each <a:p> is one line, its <a:t> runs joined. */
export function slideParagraphs(xml: string) {
  return xml.split(/<\/a:p>/)
    .map((chunk) => [...chunk.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((run) => decode(run[1])).join("").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * A PowerPoint deck as notes: each slide's title becomes a heading and its other text the lines under it, in slide
 * order, so a deck goes the same way as pasted notes (one topic per titled slide). Only the slides' own text is read;
 * speaker notes, images and layouts are left out. A deck with no text says so rather than guessing.
 */
export async function pptxToMarkdown(input: ArrayBuffer | Uint8Array) {
  let entries;
  try { entries = listZip(input); } catch { throw new ZipError("This PowerPoint file couldn’t be opened. Save it again, or export it as a PDF."); }
  const slides = entries
    .map((entry) => ({ entry, number: Number(entry.path.match(/^ppt\/slides\/slide(\d+)\.xml$/)?.[1] ?? NaN) }))
    .filter((slide) => Number.isFinite(slide.number))
    .sort((a, b) => a.number - b.number);
  if (!slides.length) throw new ZipError("This doesn’t look like a PowerPoint deck. Export it as a PDF and add that instead.");
  const sections: string[] = [];
  for (const { entry, number } of slides.slice(0, 300)) {
    const lines = slideParagraphs(new TextDecoder("utf-8").decode(await entry.read()));
    if (!lines.length) continue;
    // A short first line is the slide's title; a slide that starts with a long line has none, so it is numbered.
    const [first, ...rest] = lines;
    const titled = first.length <= 80 && rest.length > 0;
    const body = (titled ? rest : lines).map((line) => (/[.!?:]$/.test(line) ? line : `${line}.`));
    sections.push(`# ${titled ? first.replace(/[.:]$/, "") : `Slide ${number}`}\n\n${body.join("\n")}`);
  }
  if (!sections.length) throw new ZipError("No text was found on these slides. If they are pictures of text, export the deck as a PDF.");
  return sections.join("\n\n");
}
