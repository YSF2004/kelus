"use client";

import { ArrowOut } from "@/components/Marks";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import type { CourseMaterial } from "@/domain/types";
import { useAuth } from "@/components/AuthProvider";
import { readMaterialPdf } from "@/lib/material-sync";
import { markdownToPages } from "@/domain/markdown-pages";
import { NotesSection } from "@/components/NotesSection";
import notesStyles from "@/components/NotesSection.module.css";
import { findQuote } from "@/domain/source-quote";
import type { ExtractedMaterialPage } from "@/domain/types";

type Props = {
  id?: string;
  material: CourseMaterial | null;
  initialPage?: number;
  concealed?: boolean;
  onShowSource?: () => void;
  /** A line of the notes to mark on the page, the way a tutor circles it in pencil: a missed line, shown where it is. */
  highlight?: string | null;
};

type Mark = { left: number; top: number; width: number; height: number };

/** Letters and digits only, lower case: how a line from the notes is found again among the page's text pieces. */
const flat = (text: string) => text.toLocaleLowerCase().normalize("NFD").replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Where a sentence sits on a rendered page: the text pieces it spans, as rectangles in the canvas's own pixels. It
 * looks for the sentence's opening and closing words in the page's running text, so a line wrapped over several
 * rows (or hyphenated) is still found. Null when the sentence is not on this page.
 */
function findMarks(items: Array<{ str: string; transform: number[]; width: number; height: number }>, sentence: string, viewTransform: number[], scale: number): Mark[] | null {
  const target = flat(sentence);
  if (target.length < 12) return null;
  let running = "";
  const spans: Array<{ start: number; end: number; index: number }> = [];
  items.forEach((item, index) => {
    const piece = flat(item.str);
    if (!piece) return;
    spans.push({ start: running.length, end: running.length + piece.length, index });
    running += piece;
  });
  const head = target.slice(0, Math.min(40, target.length));
  const start = running.indexOf(head);
  if (start < 0) return null;
  const tail = target.slice(-Math.min(24, target.length));
  const tailAt = running.indexOf(tail, start);
  const end = tailAt >= 0 && tailAt - start < target.length * 1.4 ? tailAt + tail.length : start + target.length;
  const marks: Mark[] = [];
  for (const span of spans) {
    if (span.end <= start || span.start >= end) continue;
    const item = items[span.index];
    const [a, b, c, d, e, f] = item.transform;
    // The text piece's origin and size, carried into the viewport (pdf.js's Util.transform, written out).
    const x = viewTransform[0] * e + viewTransform[2] * f + viewTransform[4];
    const y = viewTransform[1] * e + viewTransform[3] * f + viewTransform[5];
    const height = Math.hypot(c, d) * scale || Math.hypot(a, b) * scale;
    // Only the part of the piece the sentence covers, by its share of the letters.
    const share = (from: number, to: number) => Math.max(0, Math.min(1, (to - span.start) / Math.max(1, span.end - span.start))) - Math.max(0, Math.min(1, (from - span.start) / Math.max(1, span.end - span.start)));
    const leftShare = Math.max(0, (start - span.start) / Math.max(1, span.end - span.start));
    const width = item.width * scale;
    marks.push({ left: x + width * leftShare, top: y - height, width: width * share(start, end), height });
  }
  if (!marks.length) return null;
  // One mark per printed row: pieces on the same baseline join into a single stroke.
  const rows: Mark[] = [];
  for (const mark of marks.sort((m, n) => m.top - n.top || m.left - n.left)) {
    const row = rows.find((other) => Math.abs(other.top - mark.top) < mark.height * 0.5);
    if (row) { const right = Math.max(row.left + row.width, mark.left + mark.width); row.left = Math.min(row.left, mark.left); row.width = right - row.left; row.height = Math.max(row.height, mark.height); }
    else rows.push({ ...mark });
  }
  return rows;
}

/** The original course page, not a generated facsimile. */
export function CourseSourceReader({ id, material, initialPage = 1, concealed = false, onShowSource, highlight = null }: Props) {
  const auth = useAuth();
  const canvas = useRef<HTMLCanvasElement>(null);
  const textLayer = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [sections, setSections] = useState<ExtractedMaterialPage[]>([]);
  const [marks, setMarks] = useState<Mark[] | null>(null);
  const reduce = useReducedMotion() === true;
  const isNotes = material?.kind === "text";
  const displayPage = Math.min(page, pages || page);

  useEffect(() => {
    if (!material || material.storage !== "local" || concealed) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let textLayerTask: { cancel: () => void; render: () => Promise<void> } | null = null;
    let renderedTextLayer: HTMLDivElement | null = null;
    let loadingTask: { destroy: () => Promise<void> } | null = null;
    let observer: ResizeObserver | null = null;

    async function open() {
      setStatus("loading");
      try {
        const blob = await readMaterialPdf(material!.id, auth.user?.id);
        if (cancelled) return;
        if (!blob) { setStatus("missing"); return; }
        if (material!.kind === "text") {
          const parsed = markdownToPages(await blob.text());
          if (cancelled) return;
          setSections(parsed);
          setPages(parsed.length);
          setStatus(parsed.length ? "ready" : "error");
          return;
        }
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url,
        ).toString();
        const task = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
        loadingTask = task;
        const pdf = await task.promise;
        if (cancelled) return;
        setPages(pdf.numPages);
        const pdfPage = await pdf.getPage(Math.min(Math.max(page, 1), pdf.numPages));
        if (cancelled) return;
        const textContent = await pdfPage.getTextContent();
        async function draw() {
          if (!canvas.current || !viewport.current || !textLayer.current || cancelled) return;
          renderTask?.cancel();
          textLayerTask?.cancel();
          const element = canvas.current;
          const textLayerElement = textLayer.current;
          renderedTextLayer = textLayerElement;
          const context = element.getContext("2d");
          if (!context) return;
          const natural = pdfPage.getViewport({ scale: 1 });
          const scale = Math.min(1.8, Math.max(0.45, (viewport.current.clientWidth - 32) / natural.width));
          const view = pdfPage.getViewport({ scale });
          const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
          element.width = Math.floor(view.width * pixelRatio);
          element.height = Math.floor(view.height * pixelRatio);
          element.style.width = `${view.width}px`;
          element.style.height = `${view.height}px`;
          textLayerElement.replaceChildren();
          textLayerTask = new pdfjs.TextLayer({
            textContentSource: textContent,
            container: textLayerElement,
            viewport: view,
          });
          renderTask = pdfPage.render({ canvas: element, canvasContext: context, viewport: view, transform: [pixelRatio, 0, 0, pixelRatio, 0, 0] });
          setMarks(highlight ? findMarks(textContent.items.flatMap((item) => ("str" in item ? [item as { str: string; transform: number[]; width: number; height: number }] : [])), highlight, view.transform, scale) : null);
          void textLayerTask.render().catch((error: unknown) => {
            if (!cancelled && !(error instanceof Error && error.name === "AbortException")) setStatus("error");
          });
          try {
            await renderTask.promise;
            if (!cancelled) setStatus("ready");
          } catch (error) {
            if (!cancelled && !(error instanceof Error && error.name === "RenderingCancelledException")) setStatus("error");
          }
        }
        await draw();
        if (!cancelled && viewport.current) {
          observer = new ResizeObserver(() => { void draw(); });
          observer.observe(viewport.current);
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    void open();
    return () => {
      cancelled = true;
      observer?.disconnect();
      renderTask?.cancel();
      textLayerTask?.cancel();
      renderedTextLayer?.replaceChildren();
      if (loadingTask) void loadingTask.destroy();
    };
  }, [material, page, concealed, auth.user?.id, highlight]);

  // Pasted or Markdown notes: the quote is found word for word in a section's own blocks.
  const blockTexts = useMemo(() => sections.map((section) => (section.blocks ?? [{ text: section.text }]).map((block) => block.text)), [sections]);
  const noteRanges = useMemo(() => (isNotes && highlight && blockTexts[displayPage - 1] ? findQuote(blockTexts[displayPage - 1], highlight) : null), [isNotes, highlight, blockTexts, displayPage]);
  // If the quote is in another section, open that section once per requested quote; the student can still page away.
  const jumpedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!isNotes || !highlight || !blockTexts.length) return;
    const key = `${material?.id}:${highlight}`;
    if (jumpedFor.current === key) return;
    if (blockTexts[displayPage - 1] && findQuote(blockTexts[displayPage - 1], highlight)) {
      jumpedFor.current = key;
      return;
    }
    const index = blockTexts.findIndex((texts) => findQuote(texts, highlight));
    if (index < 0) { jumpedFor.current = key; return; }
    const frame = requestAnimationFrame(() => {
      jumpedFor.current = key;
      setPage(index + 1);
    });
    return () => cancelAnimationFrame(frame);
  }, [isNotes, highlight, blockTexts, displayPage, material?.id]);
  useEffect(() => {
    if (!noteRanges || !viewport.current) return;
    const frame = requestAnimationFrame(() => {
      viewport.current?.querySelector('[data-source-quote="first"]')?.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [noteRanges, reduce]);

  // The marked line is brought into view once it is drawn.
  useEffect(() => {
    if (!marks?.length || !viewport.current) return;
    const top = Math.min(...marks.map((mark) => mark.top));
    viewport.current.scrollTo({ top: Math.max(0, top - 120), behavior: reduce ? "auto" : "smooth" });
  }, [marks, reduce]);

  return (
    <section id={id} className="core-source-reader" aria-label="Course source">
      <header className="core-source-toolbar">
        <div className="core-source-title">
          <strong title={material?.title}>{material?.title ?? "Your material"}</strong>
          {highlight ? <span className="core-source-evidence" role="status">Evidence line marked below</span> : null}
        </div>
        {material?.storage === "local" && pages > 0 && !concealed ? (
          <div className="core-page-controls" aria-label={isNotes ? "Note sections" : "PDF pages"}>
            <button type="button" onClick={() => setPage(Math.max(1, displayPage - 1))} disabled={displayPage <= 1} aria-label={isNotes ? "Previous section" : "Previous page"}>←</button>
            <span>{displayPage} / {pages}</span>
            <button type="button" onClick={() => setPage(Math.min(pages, displayPage + 1))} disabled={displayPage >= pages} aria-label={isNotes ? "Next section" : "Next page"}>→</button>
          </div>
        ) : null}
      </header>
      <div className={`core-source-stage${isNotes ? " is-notes" : ""}`} ref={viewport}>
        {concealed ? (
          <div className="core-source-state is-concealed"><span aria-hidden="true">◌</span><strong>Source closed for recall</strong><p>Try the question from memory. You can reopen the original page if you need it.</p>{onShowSource ? <button type="button" onClick={onShowSource}>Show source</button> : null}</div>
        ) : !material ? (
          <div className="core-source-state"><ArrowOut /><strong>Your course, beside your plan.</strong><p>Add a PDF to keep the original page within reach while you revise.</p><Link href="/today?section=materials">Add a source →</Link></div>
        ) : material.id.startsWith("material-demo-") ? (
          <div className="core-source-state"><strong>Course source unavailable</strong><p>Add your course PDF to read the original pages beside your plan.</p><Link href="/today?section=materials">Add a source →</Link></div>
        ) : material.storage === "url" ? (
          <div className="core-source-state"><ArrowOut /><strong>{material.title}</strong><p>This source was saved as a link. Open the original in a new tab.</p>{material.sourceUrl ? <a href={material.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a> : null}</div>
        ) : (
          <>
            {status === "loading" ? <p className="core-source-loading" role="status">Opening original page…</p> : null}
            {status === "missing" ? <div className="core-source-state"><strong>{isNotes ? "Notes not available here" : "PDF not available here"}</strong><p>The source is saved, but its file could not be opened on this device.</p><Link href="/today?section=materials">Add the PDF again →</Link></div> : null}
            {status === "error" ? <div className="core-source-state"><strong>Couldn’t show this page</strong><p>Your source and study plan are still saved. Try the PDF from Materials.</p><Link href="/today?section=materials">Open Materials →</Link></div> : null}
            {isNotes ? (
              status === "ready" && sections[displayPage - 1] ? (
                <div className={notesStyles.stack}>
                  {highlight ? (
                    noteRanges
                      ? <p className="sr-only" role="status">The passage is marked in section {displayPage}: {highlight}</p>
                      : <p className={notesStyles.notice} role="status">This passage is not in section {displayPage} as written. It may have been edited or reworded since the question was made: “{highlight}”</p>
                  ) : null}
                  <NotesSection page={sections[displayPage - 1]} title={material.title} ranges={noteRanges} />
                </div>
              ) : null
            ) : (
              <>
                <div className="core-source-page">
                  <canvas ref={canvas} aria-hidden="true" hidden={status !== "ready"} />
                  <div ref={textLayer} className="core-source-text-layer" aria-label={`Selectable text from page ${displayPage} of ${material.title}`} />
                  {status === "ready" && marks?.length ? <PencilMarks marks={marks} reduce={reduce} /> : null}
                </div>
                {status === "ready" && highlight ? (
                  marks?.length
                    ? <p className="sr-only" role="status">The line is marked on page {displayPage}: {highlight}</p>
                    : <p className={notesStyles.notice} role="status">This line could not be found on page {displayPage}. It may sit on another page or be part of an image: “{highlight}”</p>
                ) : null}
              </>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * A tutor's marks on the student's own page: a marigold highlighter stroke along each printed row of the line, and a
 * loose pencil loop drawn around the whole of it, as if by hand. Drawn over the canvas, never into it.
 */
function PencilMarks({ marks, reduce }: { marks: Mark[]; reduce: boolean }) {
  const left = Math.min(...marks.map((mark) => mark.left)) - 14;
  const top = Math.min(...marks.map((mark) => mark.top)) - 12;
  const right = Math.max(...marks.map((mark) => mark.left + mark.width)) + 14;
  const bottom = Math.max(...marks.map((mark) => mark.top + mark.height)) + 14;
  const w = right - left;
  const h = bottom - top;
  // A hand-drawn loop: an ellipse that overshoots where it closes, slightly tilted.
  const loop = `M ${w * 0.08} ${h * 0.18} C ${w * 0.32} ${-h * 0.12}, ${w * 0.86} ${-h * 0.08}, ${w * 0.98} ${h * 0.34} C ${w * 1.06} ${h * 0.72}, ${w * 0.7} ${h * 1.1}, ${w * 0.4} ${h * 1.02} C ${w * 0.08} ${h * 0.96}, ${-w * 0.04} ${h * 0.6}, ${w * 0.06} ${h * 0.3} C ${w * 0.1} ${h * 0.14}, ${w * 0.2} ${h * 0.06}, ${w * 0.3} ${h * 0.03}`;
  return (
    <div className="core-source-marks" aria-hidden="true">
      {marks.map((mark, index) => (
        <motion.span
          key={`${mark.top}-${mark.left}`}
          className="core-source-marker"
          style={{ left: mark.left - 2, top: mark.top + mark.height * 0.12, width: mark.width + 4, height: mark.height * 0.92 }}
          initial={reduce ? false : { scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.36, delay: reduce ? 0 : 0.15 + index * 0.18, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      <svg className="core-source-loop" style={{ left, top, width: w, height: h }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <motion.path d={loop} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: reduce ? 0 : 0.2 + marks.length * 0.18, ease: [0.45, 0, 0.2, 1] }} />
      </svg>
    </div>
  );
}
