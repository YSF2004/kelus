import type { ExtractedMaterialLine, ExtractedMaterialPage } from "../domain/types";

type PdfTextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
};

type PositionedItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_PAGES = 120;
const MIN_USEFUL_TEXT_CHARACTERS = 24;
const OCR_MIN_LONG_EDGE = 1800;
const OCR_MAX_LONG_EDGE = 2800;

type OcrWorker = {
  recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

type RenderablePdfPage = {
  getViewport: (input: { scale: number }) => { width: number; height: number };
  render: (input: { canvas: HTMLCanvasElement; canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<unknown> };
};

function withTimeout<T>(promise: Promise<T>, deadline: number, message: string) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return Promise.reject(new Error(message));
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), remaining);
    promise.then(
      (value) => { window.clearTimeout(timeout); resolve(value); },
      (error) => { window.clearTimeout(timeout); reject(error); },
    );
  });
}

function textItem(raw: unknown): PositionedItem | null {
  const item = raw as PdfTextItem;
  const text = item.str?.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const transform = item.transform ?? [];
  const fontSize = Math.max(
    1,
    Number(item.height) || Math.hypot(Number(transform[0]) || 0, Number(transform[1]) || 0) || 1,
  );
  return {
    text,
    x: Number(transform[4]) || 0,
    y: Number(transform[5]) || 0,
    width: Math.max(0, Number(item.width) || 0),
    fontSize,
  };
}

function joinItems(items: PositionedItem[]) {
  const ordered = [...items].sort((a, b) => a.x - b.x);
  let text = "";
  let rightEdge = ordered[0]?.x ?? 0;
  for (const item of ordered) {
    const averageCharacterWidth = item.text.length ? item.width / item.text.length : item.fontSize * 0.45;
    const gap = item.x - rightEdge;
    if (text && gap > Math.max(1.5, averageCharacterWidth * 0.45)) text += " ";
    text += item.text;
    rightEdge = Math.max(rightEdge, item.x + item.width);
  }
  return text.replace(/\s+/g, " ").trim();
}

export function groupPdfTextItems(rawItems: unknown[]): ExtractedMaterialLine[] {
  const items = rawItems.map(textItem).filter((item): item is PositionedItem => Boolean(item));
  const rows: Array<{ y: number; items: PositionedItem[] }> = [];
  for (const item of [...items].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= Math.max(2, item.fontSize * 0.24));
    if (row) row.items.push(item);
    else rows.push({ y: item.y, items: [item] });
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((row, index) => {
    const ordered = [...row.items].sort((a, b) => a.x - b.x);
    const previous = rows[index - 1];
    const fontSize = Math.max(...ordered.map((item) => item.fontSize));
    const previousFontSize = previous ? Math.max(...previous.items.map((item) => item.fontSize)) : fontSize;
    const verticalGap = previous ? previous.y - row.y : 0;
    return {
      text: joinItems(ordered),
      x: Math.min(...ordered.map((item) => item.x)),
      y: row.y,
      width: Math.max(...ordered.map((item) => item.x + item.width)) - Math.min(...ordered.map((item) => item.x)),
      fontSize,
      paragraphBreakBefore: index > 0 && verticalGap > Math.max(previousFontSize, fontSize) * 1.55,
    };
  }).filter((line) => line.text);
}

function linesToText(lines: ExtractedMaterialLine[]) {
  return lines.map((line, index) => `${index > 0 && line.paragraphBreakBefore ? "\n" : ""}${line.text}`).join("\n").trim();
}

function ocrLines(text: string): ExtractedMaterialLine[] {
  let y = 0;
  let paragraphBreakBefore = true;
  return text.split("\n").flatMap((raw) => {
    const value = raw.replace(/\s+/g, " ").trim();
    if (!value) {
      paragraphBreakBefore = true;
      return [];
    }
    y -= 14;
    const line = { text: value, x: 0, y, width: value.length * 7, fontSize: 0, paragraphBreakBefore };
    paragraphBreakBefore = false;
    return [line];
  });
}

export function materialPageFromOcr(pageNumber: number, text: string): ExtractedMaterialPage {
  const normalized = text
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([A-Za-z])-\n([a-z])/g, "$1$2")
    .trim();
  return {
    pageNumber,
    text: normalized,
    lines: ocrLines(normalized),
    needsOcr: normalized.replace(/\s/g, "").length < MIN_USEFUL_TEXT_CHARACTERS,
  };
}

export function ocrScaleForPage(width: number, height: number) {
  const longEdge = Math.max(width, height, 1);
  return Math.max(1.6, Math.min(3.2, Math.min(OCR_MAX_LONG_EDGE / longEdge, OCR_MIN_LONG_EDGE / longEdge)));
}

export function enhanceOcrPixels(data: Uint8ClampedArray) {
  let darkest = 255;
  let lightest = 0;
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    darkest = Math.min(darkest, gray);
    lightest = Math.max(lightest, gray);
  }
  const range = Math.max(48, lightest - darkest);
  for (let index = 0; index < data.length; index += 4) {
    const gray = Math.round(data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114);
    const normalized = Math.max(0, Math.min(255, Math.round(((gray - darkest) / range) * 255)));
    data[index] = normalized;
    data[index + 1] = normalized;
    data[index + 2] = normalized;
  }
  return data;
}

async function createOcrWorker(): Promise<OcrWorker> {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng") as unknown as Promise<OcrWorker>;
}

async function recognizePage(page: RenderablePdfPage, worker: OcrWorker) {
  const baseViewport = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: ocrScaleForPage(baseViewport.width, baseViewport.height) });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Kelus could not prepare this scanned page for OCR.");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  enhanceOcrPixels(pixels.data);
  context.putImageData(pixels, 0, 0);
  const result = await worker.recognize(canvas);
  return result.data.text.replace(/\r/g, "").trim();
}

export async function extractPdfPages(file: File, options: {
  timeoutMs?: number;
  maxPages?: number;
  ocr?: boolean;
  ocrPage?: (pageNumber: number) => Promise<string>;
} = {}): Promise<ExtractedMaterialPage[]> {
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const document = await withTimeout(loadingTask.promise, deadline, "This PDF took too long to open.");
  const pages: ExtractedMaterialPage[] = [];
  let ocrWorkerPromise: Promise<OcrWorker> | null = null;
  const ocrWorkers: OcrWorker[] = [];
  try {
    if (document.numPages > (options.maxPages ?? DEFAULT_MAX_PAGES)) {
      throw new Error(`This PDF has ${document.numPages} pages. Use a section of ${options.maxPages ?? DEFAULT_MAX_PAGES} pages or fewer.`);
    }
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await withTimeout(document.getPage(pageNumber), deadline, "This PDF took too long to read.");
      const content = await withTimeout(page.getTextContent(), deadline, "This PDF took too long to read.");
      let lines = groupPdfTextItems(content.items);
      let text = linesToText(lines);
      const needsOcr = text.replace(/\s/g, "").length < MIN_USEFUL_TEXT_CHARACTERS;
      if (needsOcr && options.ocr !== false) {
        const ocrText = options.ocrPage
          ? await withTimeout(options.ocrPage(pageNumber), deadline, "OCR took too long to read this PDF.")
          : await (async () => {
              ocrWorkerPromise ??= withTimeout(createOcrWorker(), deadline, "OCR took too long to start.");
              const worker = await ocrWorkerPromise;
              if (!ocrWorkers.includes(worker)) ocrWorkers.push(worker);
              return withTimeout(recognizePage(page as unknown as RenderablePdfPage, worker), deadline, "OCR took too long to read this PDF.");
            })();
        if (ocrText.replace(/\s/g, "").length >= MIN_USEFUL_TEXT_CHARACTERS) {
          const recognized = materialPageFromOcr(pageNumber, ocrText);
          text = recognized.text;
          lines = recognized.lines ?? [];
        }
      }
      pages.push({ pageNumber, text, lines, needsOcr: text.replace(/\s/g, "").length < MIN_USEFUL_TEXT_CHARACTERS });
      page.cleanup();
    }
  } finally {
    await Promise.allSettled(ocrWorkers.map((worker) => worker.terminate()));
    await document.destroy();
  }
  return pages;
}
