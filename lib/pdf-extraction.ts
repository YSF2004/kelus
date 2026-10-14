import type { ExtractedMaterialPage, ExtractedTextBlock } from "../domain/types";

type PdfTextItem = { str?: string; hasEOL?: boolean; transform?: number[]; width?: number; height?: number; fontName?: string };
type PdfOutlineNode = { title?: string; items?: PdfOutlineNode[] };

export type PdfTextDensity = "empty" | "sparse" | "ok";

export type PdfTextQuality = {
  totalChars: number;
  pagesWithText: number;
  pageCount: number;
  density: PdfTextDensity;
};

export function assessPdfTextQuality(pages: ExtractedMaterialPage[]): PdfTextQuality {
  const pageCount = pages.filter((page) => page.pageNumber > 0).length || pages.length;
  const contentPages = pages.filter((page) => page.pageNumber > 0);
  const target = contentPages.length ? contentPages : pages;
  const pagesWithText = target.filter((page) => page.text.trim().length > 0).length;
  const totalChars = target.reduce((sum, page) => sum + page.text.trim().length, 0);
  let density: PdfTextDensity = "ok";
  if (totalChars < 40) density = "empty";
  else if (totalChars < 400 || (target.length > 0 && pagesWithText / target.length < 0.25)) density = "sparse";
  return { totalChars, pagesWithText, pageCount: pageCount || target.length, density };
}

type OcrLine = { text: string; confidence: number };
type OcrData = { text: string; confidence?: number; blocks?: Array<{ paragraphs: Array<{ lines: OcrLine[] }> }> | null };

/** Below this, a recognised line is more likely a misreading ("Alrerat all acation") than what the page says. */
export const MIN_OCR_LINE_CONFIDENCE = 70;

/**
 * Keeps only the lines the text recogniser is reasonably sure of, paragraphs kept apart. A diagram or a blurry scan
 * yields mostly unsure lines; questions built from them would quote noise as if it were the student's notes.
 */
/** A printed bullet that OCR reads as a lone letter or mark ("e Demand curve…", "« Supply…") is dropped. */
function stripOcrBullet(line: string) {
  return line.replace(/^(?:[eo«»©®*°¢•·◦‣▪]|\(?[-–—]\)?)\s+(?=[\p{Lu}\d"“(])/u, "");
}

export function confidentOcrText(data: OcrData) {
  const paragraphs = (data.blocks ?? []).flatMap((block) => block.paragraphs);
  if (!paragraphs.length) return (data.confidence ?? 0) >= MIN_OCR_LINE_CONFIDENCE ? data.text : "";
  return paragraphs
    .map((paragraph) => paragraph.lines.filter((line) => line.confidence >= MIN_OCR_LINE_CONFIDENCE).map((line) => stripOcrBullet(line.text.trim())).filter(Boolean).join("\n"))
    .filter(Boolean)
    .join("\n\n");
}

function flattenOutline(nodes: PdfOutlineNode[] | null | undefined, depth = 0): string[] {
  if (!nodes?.length || depth > 4) return [];
  const titles: string[] = [];
  for (const node of nodes) {
    const title = node.title?.replace(/\s+/g, " ").trim();
    if (title && title.length >= 3 && title.length <= 72) titles.push(title);
    titles.push(...flattenOutline(node.items, depth + 1));
    if (titles.length >= 40) break;
  }
  return titles;
}

function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 12;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Bullet glyphs from slide fonts (LaTeX beamer, PowerPoint symbol fonts) that arrive as stray characters. */
const BULLET_GLYPHS = /^[\s˝´•‣▪◦▸►·∙●○■□✓✔➢➤]+/u;

/**
 * Words that lose their "fi" or "fl" when a PDF draws the ligature as one glyph pdf.js cannot map ("frm", "Defnition",
 * "fndings"). Only exact non-words are repaired, so real text is never changed.
 */
const LIGATURE_FIXES: Array<[RegExp, string]> = [
  [/\b([Ff])rm(s?)\b/g, "$1irm$2"], [/\b([Ff])rst\b/g, "$1irst"], [/\b([Ff])nd(s|ing|ings)?\b/g, "$1ind$2"],
  [/\b([Ff])nal(ly)?\b/g, "$1inal$2"], [/\b([Ff])eld(s?)\b/g, "$1ield$2"], [/\b([Ff])xed\b/g, "$1ixed"],
  [/\b([Ff])nanc/g, "$1inanc"], [/\b([Dd])efn/g, "$1efin"], [/\b([Rr])efn/g, "$1efin"], [/([Pp])roft(s?)\b/g, "$1rofit$2"],
  [/([Bb])eneft(s?)\b/g, "$1enefit$2"], [/([Ss])pecifc/g, "$1pecific"], [/([Ss])ignifcan/g, "$1ignifican"],
  [/([Ee])fcien/g, "$1fficien"], [/\b([Cc])onfict/g, "$1onflict"], [/\b([Ii])nfuen/g, "$1nfluen"], [/\b([Rr])efect/g, "$1eflect"],
  [/\b([Ff])ow(s|ing)?\b/g, "$1low$2"], [/([Ff])exib/g, "$1lexib"], [/([Cc])oefcient/g, "$1oefficient"],
  [/([Ss])ufcien/g, "$1ufficien"], [/\b([Oo])fce/g, "$1ffice"], [/\b([Dd])ifcult/g, "$1ifficult"], [/\b([Aa])fect/g, "$1ffect"], [/\b([Ee])fect/g, "$1ffect"], [/\b([Ee])fort/g, "$1ffort"], [/\b([Tt])radeof(s?)\b/g, "$1radeoff$2"], [/\b([Oo])fer/g, "$1ffer"], [/\b([Dd])ifer/g, "$1iffer"],
];

function repairLigatures(text: string) {
  return LIGATURE_FIXES.reduce((value, [pattern, fix]) => value.replace(pattern, fix), text);
}

/**
 * LaTeX slide decks set formula delimiters and operators in a symbol font whose characters pdf.js labels as letters:
 * "D(p)" arrives as "Dppq", "−" as "´", ">" as "ą". Only a font whose every character is one of these is remapped, so
 * a real "p" or "q" in running text is never touched.
 */
const SYMBOL_FONT_MAP: Record<string, string> = { p: "(", q: ")", "´": "−", "“": "=", "¨": "·", "ą": ">", "ă": "<", "ď": "≤", "ě": "≥" };
const SYMBOL_ONLY = new RegExp(`^[\\s${Object.keys(SYMBOL_FONT_MAP).join("")}]+$`, "u");

function symbolFonts(rawItems: PdfTextItem[]) {
  // Only-these-characters and at least one that is plainly not a letter: a maths font that happens to draw only "p"
  // on a page is a variable, not a bracket.
  const seen = new Map<string, { only: boolean; symbol: boolean }>();
  for (const item of rawItems) {
    if (!item.fontName || !item.str?.trim()) continue;
    const entry = seen.get(item.fontName) ?? { only: true, symbol: false };
    entry.only &&= SYMBOL_ONLY.test(item.str);
    entry.symbol ||= /[´“¨ąăďě]/u.test(item.str);
    seen.set(item.fontName, entry);
  }
  return new Set([...seen].filter(([, entry]) => entry.only && entry.symbol).map(([font]) => font));
}

/**
 * PowerPoint and Word draw bullets in symbol fonts (Wingdings, Monotype Sorts); pdf.js reads them as letters, so a
 * bullet arrives as "X", "u", "*" or "Ø". A font that only ever draws one of these single characters is a bullet font.
 */
const BULLET_LETTERS = new Set(["X", "u", "*", "Ø", "§", "q", "n", "l", "ü", "v", "o", "Ÿ", "¨", "•", "–", "»", "w"]);

function bulletFonts(rawItems: PdfTextItem[]) {
  const seen = new Map<string, { only: boolean; count: number }>();
  for (const item of rawItems) {
    const text = item.str?.trim();
    if (!item.fontName || !text) continue;
    const entry = seen.get(item.fontName) ?? { only: true, count: 0 };
    entry.only &&= BULLET_LETTERS.has(text);
    entry.count += 1;
    seen.set(item.fontName, entry);
  }
  return new Set([...seen].filter(([, entry]) => entry.only && entry.count >= 2).map(([font]) => font));
}

type Fragment = { text: string; x: number; width: number; fontSize: number };
type Line = ExtractedTextBlock & { hasEOL: boolean; fragments: Fragment[] };

/** A line's text from its fragments in left-to-right order; touching fragments join without a space. */
function lineText(fragments: Fragment[]) {
  const sorted = [...fragments].sort((a, b) => a.x - b.x);
  // A lone dash first on a line, with a gap after it, is a slide bullet from the symbol font, not a minus sign.
  if (sorted.length > 1 && /^[−–-]$/.test(sorted[0].text) && sorted[1].x - (sorted[0].x + sorted[0].width) > sorted[0].fontSize * 0.3) sorted.shift();
  let text = "";
  let right = -Infinity;
  for (const part of sorted) {
    const gap = part.x - right;
    text += text && !(gap < part.fontSize * 0.1) ? ` ${part.text}` : part.text;
    right = Math.max(right, part.x + part.width);
  }
  return text.replace(/\s+/g, " ").trim();
}

export function buildLayoutPage(pageNumber: number, rawItems: PdfTextItem[]): ExtractedMaterialPage {
  const symbols = symbolFonts(rawItems);
  const bullets = bulletFonts(rawItems);
  const items = rawItems.flatMap((item) => {
    if (item.fontName && bullets.has(item.fontName)) return [];
    const raw = item.fontName && symbols.has(item.fontName) ? [...(item.str ?? "")].map((char) => SYMBOL_FONT_MAP[char] ?? char).join("") : item.str;
    const text = raw?.replace(/\s+/g, " ").trim();
    if (!text) return [];
    const transform = item.transform ?? [];
    const measuredSize = item.height ?? Math.hypot(transform[0] ?? 0, transform[1] ?? 0);
    const fontSize = Math.max(1, measuredSize || 12);
    return [{ text: repairLigatures(text.replace(BULLET_GLYPHS, "").trim()), x: transform[4] ?? 0, y: transform[5] ?? 0, width: item.width ?? 0, height: item.height ?? fontSize, fontSize, hasEOL: Boolean(item.hasEOL) }];
  }).filter((item, index, all) => {
    if (!item.text) return false;
    // Fake bold: the same run drawn twice a hair apart ("Acidity/BasicityAcidity/Basicity"). Keep the first.
    const before = all[index - 1];
    return !(before && before.text === item.text && Math.abs(before.x - item.x) < 2 && Math.abs(before.y - item.y) < 2);
  });
  const lines: Line[] = [];
  // Same row: level with the line, or a small superscript or subscript (f′, x₂) sitting within half a line of it.
  const sameRow = (line: Line, item: { y: number; fontSize: number }) => Math.abs(line.y - item.y) <= Math.max(2, Math.min(line.fontSize, item.fontSize) * 0.28)
    || (item.fontSize <= line.fontSize * 0.8 && Math.abs(line.y - item.y) <= line.fontSize * 0.6);
  for (const item of items) {
    const previous = lines.at(-1);
    const fragment = { text: item.text, x: item.x, width: item.width, fontSize: item.fontSize };
    // Usually the next run continues the last line. A formula drawn after its sentence belongs to the earlier line it
    // sits inside; a neighbouring column starts beyond that line's right edge, so it is never pulled in.
    const target = previous && sameRow(previous, item) && !previous.hasEOL
      ? previous
      : lines.slice(-40).reverse().find((line) => sameRow(line, item) && item.x >= line.x - 1 && item.x <= line.x + line.width + item.fontSize * 0.6);
    if (target) {
      // Fake bold slotted into the same line: a copy of a fragment already there, at the same spot, is the same text.
      if (target.fragments.some((part) => part.text === fragment.text && Math.abs(part.x - fragment.x) < 2)) continue;
      target.fragments.push(fragment);
      target.text = lineText(target.fragments);
      target.width = Math.max(target.width, item.x + item.width - target.x);
      target.x = Math.min(target.x, item.x);
      target.height = Math.max(target.height, item.height);
      target.fontSize = Math.max(target.fontSize, item.fontSize);
      if (target === previous) target.hasEOL = item.hasEOL;
    } else {
      lines.push({ ...item, fragments: [fragment] });
    }
  }
  const bodySize = median(lines.map((line) => line.fontSize));
  // How wide a full line of body text is, per column (lines that start at the same left edge).
  const fullWidth = (line: { x: number; fontSize: number }) => Math.max(0, ...lines
    .filter((other) => Math.abs(other.x - line.x) < 4 && Math.abs(other.fontSize - line.fontSize) < 0.5)
    .map((other) => other.width));
  let text = "";
  lines.forEach((line, index) => {
    const previous = lines[index - 1];
    if (previous) {
      const gap = Math.abs(previous.y - line.y);
      const paragraphBreak = gap > bodySize * 1.65 || line.fontSize >= bodySize * 1.18 || previous.fontSize >= bodySize * 1.18;
      // Justified text splits words at the line end ("de-" / "fend"): the word is joined back. "Austria-" / "Hungary" keeps its dash.
      if (!paragraphBreak && /\p{Ll}-$/u.test(text) && /^\p{Ll}/u.test(line.text)) {
        text = text.slice(0, -1);
        text += line.text;
        return;
      }
      // A line that ran to the column's edge without ending a sentence wrapped: the next line is the same sentence.
      // A short slide bullet stops well before the edge, so it keeps its own line.
      const wrapped = !paragraphBreak && previous.width >= fullWidth(previous) * 0.85 && fullWidth(previous) > bodySize * 15
        && !/[.!?:;]["”)]?$/.test(previous.text) && Math.abs(line.x - previous.x) < 4;
      text += paragraphBreak ? "\n\n" : wrapped ? " " : "\n";
    }
    text += line.text;
  });
  return { pageNumber, text: text.trim(), blocks: lines.map(({ hasEOL: _hasEOL, fragments: _fragments, ...line }) => line) };
}

/**
 * Lines printed on most pages (a slide footer "Mansfield University · Chapter 1 · Slide 5", a running header) are page
 * furniture, not content. With at least three pages, a line found on half of them or more is removed; page and slide
 * numbers are ignored when comparing, so "Slide 5" and "Slide 6" count as the same line.
 */
export function stripRunningLines(pages: ExtractedMaterialPage[]) {
  const content = pages.filter((page) => page.pageNumber > 0);
  if (content.length < 3) return pages;
  const key = (line: string) => line.trim().toLocaleLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ");
  const count = new Map<string, number>();
  for (const page of content) for (const line of new Set(page.text.split("\n").map(key).filter((line) => line.length > 1))) count.set(line, (count.get(line) ?? 0) + 1);
  const threshold = Math.max(3, Math.ceil(content.length * 0.5));
  const running = new Set([...count].filter(([, n]) => n >= threshold).map(([line]) => line));
  if (!running.size) return pages;
  return pages.map((page) => page.pageNumber === 0 ? page : {
    ...page,
    text: page.text.split("\n").filter((line) => !running.has(key(line))).join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    blocks: page.blocks?.filter((block) => !running.has(key(block.text))),
  });
}

/** Most pages read from one PDF. Extracting text is fast (31 pages take well under a second); this only guards memory. */
export const MAX_READ_PAGES = 150;

export async function extractPdfPages(file: File, options?: { maxContentPages?: number; onInfo?: (info: { totalPages: number }) => void }): Promise<ExtractedMaterialPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const document = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: ExtractedMaterialPage[] = [];
  const maxContentPages = options?.maxContentPages ?? MAX_READ_PAGES;
  options?.onInfo?.({ totalPages: document.numPages });
  try {
    try {
      const outline = (await document.getOutline()) as PdfOutlineNode[] | null;
      const titles = flattenOutline(outline);
      if (titles.length) {
        pages.push({ pageNumber: 0, text: titles.join("\n") });
      }
    } catch {
      // Outline is optional; text extraction continues.
    }

    const lastPage = Math.min(document.numPages, maxContentPages);
    for (let pageNumber = 1; pageNumber <= lastPage; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(buildLayoutPage(pageNumber, content.items as PdfTextItem[]));
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return stripRunningLines(pages);
}

export type OcrProgress = {
  phase: "rendering" | "recognizing" | "done";
  pageNumber: number;
  totalPages: number;
  message: string;
};

const OCR_MIN_PAGE_CHARS = 40;

export function pageNeedsOcr(page: ExtractedMaterialPage) {
  if (page.pageNumber <= 0) return false;
  const text = page.text.trim();
  if (text.length < OCR_MIN_PAGE_CHARS) return true;
  const letters = (text.match(/[A-Za-z]/g) ?? []).length;
  // Selectable junk / OCR leftovers: enough length but almost no letters.
  return text.length >= OCR_MIN_PAGE_CHARS && letters / text.length < 0.35;
}

function synthesizeBlocksFromText(text: string): ExtractedTextBlock[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((line, index) => ({
      text: line,
      x: 0,
      y: -index * 16,
      width: Math.max(24, line.length * 7),
      height: 14,
      fontSize: line.length <= 48 ? 16 : 13,
    }));
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("OCR cancelled.");
    error.name = "AbortError";
    throw error;
  }
}

export async function ocrPdfPages(
  file: File,
  pages: ExtractedMaterialPage[],
  options?: {
    maxPages?: number;
    timeBudgetMs?: number;
    scale?: number;
    stopAfterRecoveredPages?: number;
    signal?: AbortSignal;
    onProgress?: (progress: OcrProgress) => void;
  },
): Promise<{ pages: ExtractedMaterialPage[]; ocrPages: number; timedOut: boolean }> {
  throwIfAborted(options?.signal);

  if (typeof document === "undefined") {
    return { pages, ocrPages: 0, timedOut: false };
  }

  const maxPages = options?.maxPages ?? 8;
  const timeBudgetMs = options?.timeBudgetMs ?? 60_000;
  const scale = options?.scale ?? 1.5;
  const stopAfter = options?.stopAfterRecoveredPages ?? maxPages;
  const startedAt = Date.now();
  const targets = pages
    .filter((page) => pageNeedsOcr(page))
    .slice(0, maxPages);

  if (!targets.length) {
    return { pages, ocrPages: 0, timedOut: false };
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  throwIfAborted(options?.signal);
  const documentProxy = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  throwIfAborted(options?.signal);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  const byNumber = new Map(pages.map((page) => [page.pageNumber, page]));
  let ocrPages = 0;
  let timedOut = false;

  try {
    for (let index = 0; index < targets.length; index += 1) {
      throwIfAborted(options?.signal);
      if (Date.now() - startedAt >= timeBudgetMs) {
        timedOut = true;
        break;
      }
      if (ocrPages >= stopAfter) break;
      const target = targets[index];
      options?.onProgress?.({
        phase: "rendering",
        pageNumber: target.pageNumber,
        totalPages: targets.length,
        message: `Preparing scanned page ${index + 1} of ${targets.length}…`,
      });

      const page = await documentProxy.getPage(target.pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) {
        page.cleanup();
        continue;
      }

      await page.render({ canvasContext: context, canvas, viewport }).promise;
      page.cleanup();
      throwIfAborted(options?.signal);

      options?.onProgress?.({
        phase: "recognizing",
        pageNumber: target.pageNumber,
        totalPages: targets.length,
        message: `Reading scanned page ${index + 1} of ${targets.length}…`,
      });

      const result = await worker.recognize(canvas, {}, { text: true, blocks: true });
      throwIfAborted(options?.signal);
      const text = confidentOcrText(result.data as OcrData).replace(/[ \t]+\n/g, "\n").trim();
      if (text.length > target.text.trim().length) {
        byNumber.set(target.pageNumber, {
          pageNumber: target.pageNumber,
          text,
          blocks: synthesizeBlocksFromText(text),
        });
        ocrPages += 1;
      }
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
    await documentProxy.destroy();
  }

  options?.onProgress?.({
    phase: "done",
    pageNumber: targets.at(-1)?.pageNumber ?? 0,
    totalPages: targets.length,
    message: ocrPages
      ? `Recovered text from ${ocrPages} scanned page${ocrPages === 1 ? "" : "s"}.`
      : timedOut
        ? "Scan reading stopped after the time limit without usable text."
        : "Scan reading finished without usable text.",
  });

  return {
    pages: pages.map((page) => byNumber.get(page.pageNumber) ?? page),
    ocrPages,
    timedOut,
  };
}
