"use client";

import { AiNote } from "@/components/AiConsent";
import { KIND_NAME, sourceKind } from "@/domain/source-kind";
import { toneOf } from "@/lib/topic-tone";
import { ArrowRight } from "@/components/Marks";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { kelusDuration, kelusEase } from "@/components/motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type DragEvent, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { FirstRunGate } from "@/components/FirstRunGate";
import { useLearner } from "@/components/LearnerProvider";
import { PAYWALL_DISMISS_KEY, SoftUpgradePrompt } from "@/components/SoftUpgradePrompt";
import { trackEvent } from "@/lib/analytics";
import type { CourseMaterial, ExtractedMaterialPage, MaterialRole, ProposedConcept } from "@/domain/types";
import { ReadingNotes } from "@/components/ReadingNotes";
import { MATERIAL_ROLES, materialRoleLabel } from "@/domain/materials";

function fileTypeLabel(fileName?: string | null, mimeType?: string | null) {
  const name = (fileName ?? "").toLocaleLowerCase();
  if (name.endsWith(".pdf") || mimeType === "application/pdf") return "PDF";
  if (name.endsWith(".zip") || /variant=notion/i.test(mimeType ?? "")) return "Notion export";
  return "Notes";
}
import { SourceArt } from "@/components/SourceArt";
import { BrandIcon, brandForFile } from "@/components/BrandIcon";

// AnimatePresence can defer mounting this heading until the previous phase exits.
// Focus on attachment, when the target actually exists, rather than on phase change.
function focusPhaseHeading(node: HTMLHeadingElement | null) {
  node?.focus();
}
import { documentTitle, buildConfirmedMaterialModel, isSourceBackedProposal, MAX_PROPOSED_TOPICS, proposalConfidence, proposeConceptsFromPages } from "@/domain/material-intelligence";
import {
  addLinkMaterial,
  addSourceMaterial,
  getMaterialsSnapshot,
  getServerMaterialsSnapshot,
  removeMaterial,
  subscribeMaterials,
  updateMaterialProcessingStatus,
  renameMaterial,
} from "@/lib/material-store";
import { readMaterialPdf, removeRemoteMaterial, uploadMaterialPdf } from "@/lib/material-sync";
import {
  INITIAL_INGEST_STATE,
  defaultStepMessage,
  errorKind as ingestErrorKind,
  errorMessage as ingestErrorMessage,
  focusTargetId,
  isBusy,
  isDragging,
  isOcrRunning,
  readySummary as ingestReadySummary,
  reduceIngest,
  reviewAnalysis,
  showIngestForm,
  statusMessage as ingestStatusMessage,
  type IngestState,
  type WorkingStep,
} from "@/lib/material-ingest-machine";
import type { AnalysisPayload } from "@/lib/material-ingest-machine";
import { assessPdfTextQuality, MAX_READ_PAGES, ocrPdfPages, pageNeedsOcr } from "@/lib/pdf-extraction";
import { extractSourcePages, NotesWithoutHeadingsError } from "@/lib/source-extraction";
import { SOURCE_FILE_ACCEPT, isNotesFile, isZipFile, sourceNoun } from "@/domain/materials";
import { MAX_NOTES_BYTES } from "@/domain/markdown-pages";
import { zipToNotesFile } from "@/lib/zip-notes";

function formatBytes(bytes: number | null) {
  if (bytes === null) return null;
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1_000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function sourceHost(value: string | null) {
  try {
    return new URL(value ?? "https://kelus.me").hostname.replace(/^www\./, "");
  } catch {
    return "Saved link";
  }
}

/** What Kelus actually read, said plainly. A cut-off document must never look complete. */
function ReadCoverage({ coverage, found }: { coverage: NonNullable<AnalysisPayload["coverage"]>; found: number }) {
  const unit = coverage.unit === "section" ? "section" : "page";
  const plural = (count: number) => `${count} ${unit}${count === 1 ? "" : "s"}`;
  const all = coverage.pagesRead >= coverage.totalPages;
  return (
    <p className="read-coverage" role="status">
      {all ? (coverage.totalPages === 1 ? `Read the whole ${unit}.` : `Read all ${plural(coverage.totalPages)}.`) : `Read the first ${plural(coverage.pagesRead)} of ${coverage.totalPages}. Add the rest as a separate file to include it.`}
      {coverage.lowTextPages ? ` ${coverage.lowTextPages} ${unit}${coverage.lowTextPages === 1 ? " has" : "s have"} little readable text; check the original before trusting this topic list.` : ""}
      {coverage.topicCapHit ? ` Showing the first ${found} topics; remove the ones you don’t need, or add the rest as another file.` : ""}
    </p>
  );
}

function addedLabel(iso: string) {
  const added = Date.parse(iso);
  if (!Number.isFinite(added)) return null;
  const days = Math.floor((Date.now() - added) / 86_400_000);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 7) return `Added ${days} days ago`;
  return `Added ${new Date(added).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

function MaterialRow({
  item,
  onAnalyze,
  onRemoved,
  linkedTopics,
  topicNames = [],
  topicTones = [],
  userId,
  syncState,
  quiet = false,
}: {
  item: CourseMaterial;
  onAnalyze: (item: CourseMaterial) => void;
  onRemoved: (item: CourseMaterial) => void;
  linkedTopics: number;
  topicNames?: string[];
  /** Each topic's colour, in the same order as topicNames. */
  topicTones?: number[];
  userId?: string;
  syncState?: "syncing" | "synced" | "retrying";
  quiet?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function downloadPdf() {
    setBusy(true);
    setDownloadError(null);
    const blob = await readMaterialPdf(item.id, userId);
    setBusy(false);
    if (!blob) {
      setDownloadError("PDF isn’t available on this device anymore. Add the file again to download it.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = item.fileName ?? `${item.title}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function remove() {
    setBusy(true);
    try {
      await removeMaterial(item.id);
      onRemoved(item);
      if (userId) await removeRemoteMaterial(userId, item.id, item).catch(() => undefined);
    } catch {
      setDownloadError("This source could not be removed. Try again.");
      setBusy(false);
    }
  }

  const statusLabel =
    item.processingStatus === "failed"
      ? "Couldn’t read"
      : item.processingStatus === "processing"
        ? "Reading…"
        : quiet
          ? null
          : item.processingStatus === "ready"
            ? "Ready"
            : null;

  const syncLabel = !userId
    ? quiet
      ? null
      : "Saved on this device"
    : syncState === "syncing"
      ? "Saving across devices…"
      : syncState === "retrying"
        ? "Saved here · cloud retry queued"
        : quiet
          ? null
          : "Saved across devices";

  const isBuiltInExample = item.id.startsWith("material-demo-");
  const host = item.storage === "url" && item.sourceUrl ? sourceHost(item.sourceUrl) : null;
  const metaBits = item.storage === "local"
    // What the file is (PDF, notes, a Notion export) reads better than the role Kelus guessed from its name.
    ? [quiet ? fileTypeLabel(item.fileName, item.mimeType) : null, item.fileName, formatBytes(item.sizeBytes)].filter(Boolean)
    : isBuiltInExample
      ? ["Built-in example · no original PDF"]
      : [quiet ? materialRoleLabel(item.role) : null, host ? (quiet ? `Link · ${host}` : `Bookmark · ${host}`) : "Saved link"].filter(Boolean);

  return (
    <li className={`material-row${item.processingStatus === "failed" ? " is-failed" : ""}${quiet ? " is-quiet material-card" : ""}`}>
      {quiet ? <span className="material-card-art">{brandForFile(item.fileName, item.mimeType) ? <span className="material-card-brand"><BrandIcon brand={brandForFile(item.fileName, item.mimeType)!} size={28} /></span> : <SourceArt role={item.role} isLink={item.storage === "url"} />}</span> : <span className="material-kind">{isBuiltInExample ? "Example" : materialRoleLabel(item.role)}</span>}
      <span className="material-name">
        <strong>{isBuiltInExample ? "Built-in Microeconomics example" : item.title}</strong>
        {metaBits.length ? <small>{metaBits.join(", ")}</small> : null}
        {quiet && !isBuiltInExample ? (
          <small className="material-card-facts">
            {[addedLabel(item.addedAt), linkedTopics ? `${linkedTopics} topic${linkedTopics === 1 ? "" : "s"} from this source` : item.processingStatus === "ready" ? "No topics confirmed yet" : null].filter(Boolean).join(", ")}
          </small>
        ) : null}
        {quiet && topicNames.length ? <small className="material-card-topics" aria-label={`Topics: ${topicNames.join(", ")}`}>{topicNames.slice(0, 6).map((name, at) => <span key={name} data-tone={topicTones[at] ?? at % 6 + 1}>{name}</span>)}{topicNames.length > 6 ? <span>+{topicNames.length - 6}</span> : null}</small> : null}
        {statusLabel ? <small className={`material-status-badge is-${item.processingStatus}`}>{statusLabel}</small> : null}
        {syncLabel ? <small className={`material-sync-label is-${syncState ?? "synced"}`}>{syncLabel}</small> : null}
        {downloadError ? <small className="material-download-error" role="alert">{downloadError}</small> : null}
      </span>
      <span className="material-actions">
        {item.storage === "local" ? (
          <button type="button" onClick={() => onAnalyze(item)} disabled={busy || item.processingStatus === "processing"}>
            {item.processingStatus === "processing"
              ? "Reading…"
              : item.processingStatus === "failed"
                ? "Retry"
                : item.processingStatus === "ready"
                  ? quiet
                    ? "Topics"
                    : "Review concepts"
                  : quiet
                    ? "Find topics"
                    : "Build concepts"}
          </button>
        ) : null}
        {item.storage === "url" ? (
          item.sourceUrl ? (
            <a href={item.sourceUrl} target="_blank" rel="noreferrer">
              {quiet ? "Open" : "Open bookmark"}
            </a>
          ) : null
        ) : (
          <button type="button" onClick={() => void downloadPdf()} disabled={busy}>
            {busy ? "Preparing…" : "Download"}
          </button>
        )}
        {confirmRemove ? (
          <span className="material-remove-confirm" role="group" aria-label={`Confirm remove ${item.title}`}>
            <span className="material-remove-question">{linkedTopics ? `Remove this source and its ${linkedTopics} topic${linkedTopics === 1 ? "" : "s"}? Your answers stay in your history.` : "Remove this source?"}</span>
            <span className="material-remove-actions">
              <button type="button" className="k-btn k-btn--paper k-btn--small" onClick={() => setConfirmRemove(false)} disabled={busy}>Keep it</button>
              <button type="button" className="k-btn k-btn--small material-remove-yes" onClick={() => void remove()} disabled={busy}>{busy ? "Removing…" : "Remove"}</button>
            </span>
          </span>
        ) : (
          <button type="button" onClick={() => setConfirmRemove(true)} disabled={busy}>
            Remove
          </button>
        )}
      </span>
    </li>
  );
}

/**
 * What went wrong reading a file, in words a student can act on. Kelus's own messages pass through; the PDF library's
 * internal ones ("Invalid PDF structure", "Missing PDF") become a plain sentence.
 */
function readableReadError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "";
  if (!message) return "Kelus couldn’t read this file.";
  if (/invalid pdf|missing pdf|unexpected server response|bad xref|password|encrypted|corrupt|unknown error/i.test(message)) {
    return /password|encrypted/i.test(message)
      ? "This PDF is locked with a password. Open it, save a copy without the password, then add that copy."
      : "This file doesn’t open as a PDF. It may be damaged or only part-downloaded; try downloading it again.";
  }
  return message;
}

/** "biology-ch7-cell-transport.pdf" reads as "biology ch7 cell transport": no extension, dashes as spaces. */
function readableFileName(name: string) {
  return name.replace(/\.(pdf|md|markdown|txt|zip)$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || name;
}

export function MaterialLibrary({ embedded = false, incomingFile = null, onIncomingFileHandled, interceptFile, quiet = false, onStartOver }: { embedded?: boolean; incomingFile?: File | null; onIncomingFileHandled?: () => void; interceptFile?: (file: File) => boolean; quiet?: boolean; onStartOver?: () => void } = {}) {
  const reduceMotion = useReducedMotion();
  const auth = useAuth();
  const router = useRouter();
  const { state, confirmConcepts, removeMaterialSource, renameCourse } = useLearner();
  const materials = useSyncExternalStore(subscribeMaterials, getMaterialsSnapshot, getServerMaterialsSnapshot);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [role, setRole] = useState<MaterialRole>("notes");
  const [ingest, setIngest] = useState<IngestState>(INITIAL_INGEST_STATE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // The student chose to study a file that does not look like notes: respected, and not asked again for this file.
  const [useAnyway, setUseAnyway] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [syncStates, setSyncStates] = useState<Record<string, "syncing" | "synced" | "retrying">>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const ocrAbortRef = useRef<AbortController | null>(null);
  const resumedMaterialId = useRef<string | null>(null);
  const previewObjectUrl = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const course = state.snapshot.courses[0];

  useEffect(() => () => {
    if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
  }, []);

  const dispatch = (event: Parameters<typeof reduceIngest>[1]) => {
    setIngest((current) => reduceIngest(current, event));
  };

  const phase = ingest.phase;
  const busy = isBusy(phase);
  const ocrRunning = isOcrRunning(phase);
  const dragging = isDragging(phase);
  const analysis = reviewAnalysis(phase);
  const readySummary = ingestReadySummary(phase);
  const statusMessage = ingestStatusMessage(phase);
  const hardError = ingestErrorMessage(phase);
  const softNotice = ingest.softNotice;
  const errorKind = ingestErrorKind(phase);
  const workingStep = phase.status === "working" ? phase.step : null;

  const WORKING_STEPS: WorkingStep[] = ["saving", "extracting", "ocr", "building"];
  const workingStepLabel: Record<WorkingStep, string> = {
    saving: "Saving",
    extracting: "Reading",
    ocr: "Scanning",
    building: "Building",
  };

  useEffect(() => {
    const id = focusTargetId(phase);
    if (!id) return;
    const frame = requestAnimationFrame(() => document.getElementById(id)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const courseMaterials = materials.filter((item) => item.courseId === course?.id);
  const concepts = state.snapshot.concepts.filter((item) => item.courseId === course?.id);
  const hasCoursePdf = courseMaterials.some((item) => item.storage === "local" && !item.id.startsWith("material-demo-"));
  const sourceFirst = embedded && !hasCoursePdf && !analysis && !readySummary;

  function cancelOcr() {
    ocrAbortRef.current?.abort();
  }

  async function analyzePdf(material: CourseMaterial, file?: File) {
    dispatch({ type: "CLEAR_FEEDBACK" });
    dispatch({ type: "WORK_STARTED", step: "extracting", message: defaultStepMessage("extracting") });
    updateMaterialProcessingStatus(material.id, "processing");
    ocrAbortRef.current?.abort();
    const controller = new AbortController();
    ocrAbortRef.current = controller;
    let attemptedOcr = false;
    try {
      const stored = file ?? await readMaterialPdf(material.id, auth.user?.id);
      if (!stored) throw new Error(material.kind === "text" ? "These notes are no longer available on this device. Add them again to continue." : "This PDF is no longer available on this device. Add it again to continue.");
      const isNotesSource = material.kind === "text";
      const pdfFile = stored instanceof File
        ? stored
        : new File([stored], material.fileName ?? `${material.title}.${isNotesSource ? "md" : "pdf"}`, { type: material.mimeType ?? (isNotesSource ? "text/markdown" : "application/pdf") });
      if (previewObjectUrl.current) URL.revokeObjectURL(previewObjectUrl.current);
      // A PDF can be opened in its own layout; notes have no separate layout, the text Kelus read is the source.
      const nextPreviewUrl = isNotesSource ? null : URL.createObjectURL(pdfFile);
      previewObjectUrl.current = nextPreviewUrl;
      setPreviewUrl(nextPreviewUrl);
      setPreviewPage(1);
      dispatch({ type: "WORK_STEP", step: "extracting", message: defaultStepMessage("extracting") });
      const extraction = await extractSourcePages(pdfFile);
      const { isNotes, locatorLabel, totalPages, pagesRead } = extraction;
      // A partial PDF must never look like a complete course.
      if (quiet && !isNotes && pagesRead < totalPages) {
        throw new Error(`This PDF has ${totalPages} pages, but Kelus can read only the first ${MAX_READ_PAGES} in one file. Split it into smaller PDFs and add each part so your route does not miss lessons.`);
      }
      let pages = extraction.pages;
      let quality = assessPdfTextQuality(pages);
      let usedOcr = false;
      let proposals: ProposedConcept[] = [];

      function mergeProposals(extra: ProposedConcept[]) {
        const seen = new Set(proposals.map((item) => item.name.toLocaleLowerCase()));
        for (const item of extra) {
          const key = item.name.toLocaleLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          proposals.push(item);
        }
      }

      proposals = proposeConceptsFromPages({ materialId: material.id, sourceLabel: material.title, pages, locatorLabel }).filter(isSourceBackedProposal);
      if (proposals.length < 3) {
        mergeProposals(proposeConceptsFromPages({
          materialId: material.id,
          sourceLabel: material.title,
          pages,
          mode: "relaxed",
          locatorLabel,
        }).filter(isSourceBackedProposal));
      }

      async function runOcr(reason: string) {
        attemptedOcr = true;
        dispatch({ type: "WORK_STEP", step: "ocr", message: reason });
        const ocr = await ocrPdfPages(pdfFile, pages, {
          maxPages: 8,
          timeBudgetMs: 45_000,
          scale: 1.5,
          stopAfterRecoveredPages: 4,
          signal: controller.signal,
          onProgress: (progress) => dispatch({ type: "WORK_PROGRESS", message: progress.message }),
        });
        if (ocr.ocrPages > 0) {
          pages = ocr.pages;
          quality = assessPdfTextQuality(pages);
          usedOcr = true;
        }
        return ocr;
      }

      const needsScanHelp = !isNotes && (quality.density === "sparse" || quality.density === "empty" || pages.some(pageNeedsOcr));
      if (proposals.length < 3 && needsScanHelp) {
        const ocrResult = await runOcr("Scanned or weak PDF text — reading pages with on-device OCR…");
        if (ocrResult.ocrPages === 0 && quality.density === "empty") {
          const ocrError = new Error(
            ocrResult.timedOut
              ? "This scan is taking too long to read. Try a smaller file, or export the notes as a text PDF."
              : "Kelus can read typed scans, but not handwriting or blurry photos yet. If these are handwritten notes, type the key lines into “Or paste your notes”.",
          );
          (ocrError as Error & { kind?: string }).kind = "ocr";
          throw ocrError;
        }
        dispatch({
          type: "WORK_STEP",
          step: "building",
          message: defaultStepMessage("building"),
        });
        proposals = proposeConceptsFromPages({ materialId: material.id, sourceLabel: material.title, pages, locatorLabel }).filter(isSourceBackedProposal);
        if (proposals.length < 3) {
          mergeProposals(proposeConceptsFromPages({
            materialId: material.id,
            sourceLabel: material.title,
            pages,
            mode: "relaxed",
            locatorLabel,
          }).filter(isSourceBackedProposal));
        }
      } else {
        dispatch({ type: "WORK_STEP", step: "building", message: defaultStepMessage("building") });
      }

      if (!proposals.length) {
        const emptyScan = attemptedOcr && quality.density === "empty";
        const fail = new Error(
          emptyScan
            ? "Kelus can read typed scans, but not handwriting or blurry photos yet. If these are handwritten notes, type the key lines into “Or paste your notes”."
            : isNotes
              ? "Kelus found no topics with a supporting passage under a heading. Put each topic under its own heading (for example “## Osmosis”) with a few sentences beneath it; it will not invent a lesson from the filename."
              : "Kelus found no topics with a readable supporting passage. Try lecture notes with selectable text or a clearer scan; it will not invent a lesson from the filename.",
        );
        if (emptyScan) (fail as Error & { kind?: string }).kind = "ocr";
        throw fail;
      }
      updateMaterialProcessingStatus(material.id, "ready");
      const nextAnalysis = {
        material: { ...material, processingStatus: "ready" as const },
        proposals,
        pages,
        coverage: { totalPages, pagesRead, unit: isNotes ? ("section" as const) : ("page" as const), topicCapHit: proposals.length >= MAX_PROPOSED_TOPICS, lowTextPages: isNotes ? 0 : pages.filter((page) => page.text.trim().length < 20).length },
      };
      setSelectedIds(new Set(proposals.map((proposal) => proposal.id)));
      setDraftNames(Object.fromEntries(proposals.map((proposal) => [proposal.id, proposal.name])));
      dispatch({ type: "REVIEW_READY", analysis: nextAnalysis });
      trackEvent({ name: "material_processing_completed", source_type: isNotes ? "notes" : "pdf", topic_count: proposals.length, used_ocr: usedOcr, course_type: "real" });
      trackEvent({ name: "concept_review_started", concept_count: proposals.length });
      if (courseMaterials.filter((item) => item.storage === "local").length >= 3) {
        try {
          if (window.localStorage.getItem(PAYWALL_DISMISS_KEY) !== "1") {
            setShowUpgrade(true);
          }
        } catch {
          setShowUpgrade(true);
        }
      }
    } catch (caught) {
      updateMaterialProcessingStatus(material.id, "failed");
      const cancelled = caught instanceof Error && caught.name === "AbortError";
      const ocrFailure = attemptedOcr || (caught instanceof Error && (caught as Error & { kind?: string }).kind === "ocr");
      trackEvent({ name: "material_processing_failed", source_type: material.kind === "text" ? "notes" : "pdf", reason: cancelled ? "cancelled" : ocrFailure ? "ocr" : "extraction", course_type: "real" });
      if (cancelled) {
        dispatch({
          type: "FAIL",
          kind: "ocr",
          message: "OCR cancelled. You can retry this file or export a text PDF.",
        });
      } else {
        const kind = caught instanceof Error && (caught as Error & { kind?: string }).kind === "ocr" && !(caught instanceof NotesWithoutHeadingsError) ? "ocr" : "generic";
        dispatch({
          type: "FAIL",
          kind,
          message: readableReadError(caught),
        });
      }
    } finally {
      if (ocrAbortRef.current === controller) ocrAbortRef.current = null;
    }
  }

  async function savePdf(picked: File | undefined) {
    if (!picked || !course) return;
    // The sample course asks before anything of yours goes near it.
    if (interceptFile?.(picked)) { if (fileRef.current) fileRef.current.value = ""; return; }
    let file = picked;
    if (isZipFile(picked)) {
      dispatch({ type: "WORK_STARTED", step: "saving", message: "Reading your export…" });
      try {
        file = await zipToNotesFile(picked);
      } catch (caught) {
        dispatch({ type: "FAIL", kind: "generic", message: caught instanceof Error && caught.message ? caught.message : "Kelus couldn’t read this zip. Export your notes from Notion and try again." });
        return;
      }
    }
    trackEvent({ name: "material_upload_started", role, course_type: "real" });
    if (file.size > (isNotesFile(file) ? MAX_NOTES_BYTES : 20 * 1024 * 1024)) {
      dispatch({
        type: "SIZE_REJECTED",
        message: isNotesFile(file) ? "These notes are larger than 2 MB. Split them into smaller files, then try again." : "This PDF is larger than 20 MB. Export a smaller file, or split it, then try again.",
      });
      return;
    }
    dispatch({ type: "WORK_STARTED", step: "saving", message: defaultStepMessage("saving") });
    try {
      const material = await addSourceMaterial({ courseId: course.id, file, role });
      trackEvent({ name: "material_upload_completed", role, course_type: "real" });
      if (auth.user?.id) {
        setSyncStates((current) => ({ ...current, [material.id]: "syncing" }));
        void uploadMaterialPdf(auth.user.id, material, file).then(() => {
          setSyncStates((current) => ({ ...current, [material.id]: "synced" }));
        }).catch(() => {
          setSyncStates((current) => ({ ...current, [material.id]: "retrying" }));
          dispatch({
            type: "SOFT_NOTICE",
            message: `The ${sourceNoun(material.kind)} ${material.kind === "text" ? "are" : "is"} ready here. The account copy will retry when the connection returns.`,
          });
        });
      }
      await analyzePdf(material, file);
    } catch (caught) {
      trackEvent({ name: "material_upload_failed", role, course_type: "real" });
      dispatch({
        type: "FAIL",
        kind: "generic",
        message: caught instanceof Error ? caught.message : "This file could not be saved.",
      });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const handleIncomingFile = useEffectEvent((file: File) => {
    onIncomingFileHandled?.();
    void savePdf(file);
  });
  useEffect(() => {
    if (!incomingFile) return;
    const frame = requestAnimationFrame(() => handleIncomingFile(incomingFile));
    return () => cancelAnimationFrame(frame);
  }, [incomingFile]);

  const resumeFirstAnalysis = useEffectEvent((material: CourseMaterial) => { void analyzePdf(material); });
  useEffect(() => {
    if (!embedded || concepts.length || phase.status !== "idle") return;
    const pending = courseMaterials.find((item) => item.storage === "local" && item.processingStatus !== "failed");
    if (!pending || resumedMaterialId.current === pending.id) return;
    resumedMaterialId.current = pending.id;
    resumeFirstAnalysis(pending);
  }, [embedded, concepts.length, phase.status, courseMaterials]);

  if (!state.onboardingCompleted || !course) {
    const gate = (
      <FirstRunGate
        kicker="Course material"
        title="Add a course PDF first."
        body="Add a lecture PDF, slides or notes, and Kelus finds the topics and writes your first question from them."
        preview="materials"
      />
    );
    return embedded ? gate : <AppShell>{gate}</AppShell>;
  }

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    dispatch({ type: "DROP_RESET" });
    void savePdf(event.dataTransfer.files[0]);
  }

  function addLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch({ type: "CLEAR_FEEDBACK" });
    setLinkError(null);
    try {
      addLinkMaterial({ courseId: course.id, title, value: url, role });
      setTitle("");
      setUrl("");
    } catch (caught) {
      // Said right under the link field, where the mistake is.
      setLinkError(caught instanceof Error ? caught.message : "The link could not be saved. Check the URL and try again.");
    }
  }

  function toggleProposal(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      trackEvent({ name: "concept_review_updated", action: next.has(id) ? "selected" : "removed" });
      return next;
    });
  }

  /** Confirms the student's reviewed topics and moves on. */
  function confirmProposals(selected: ProposedConcept[], pages: ExtractedMaterialPage[]) {
    try {
      const normalizedNames = selected.map((proposal) => proposal.name.toLocaleLowerCase());
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        throw new Error("Each confirmed concept needs a distinct name.");
      }
      const preview = buildConfirmedMaterialModel({
        proposals: selected,
        courseId: course.id,
        userId: state.snapshot.profile.id,
        nowIso: state.nowIso,
        pages,
      });
      const first = [...preview.concepts].sort((left, right) => right.examImportance - left.examImportance)[0];
      confirmConcepts(selected, pages);
      trackEvent({ name: "material_confirmed", concept_count: selected.length });
      dispatch({
        type: "CONFIRM",
        conceptCount: selected.length,
        firstName: first?.name ?? selected[0]?.name ?? null,
      });
      // Continue the booklet: diagnosis is next — do not park on a ready interstitial.
      router.replace("/today");
      return true;
    } catch (caught) {
      dispatch({
        type: "CONFIRM_FAILED",
        message: caught instanceof Error ? caught.message : "Kelus could not build the map. Check concept names and try again.",
      });
      return false;
    }
  }

  function buildMap() {
    if (!analysis) return;
    const selected = analysis.proposals
      .filter((proposal) => selectedIds.has(proposal.id))
      .map((proposal) => ({ ...proposal, name: draftNames[proposal.id]?.trim() || proposal.name }));
    if (!confirmProposals(selected, analysis.pages)) return;
    if (quiet && selected.length) {
      const firstTopics = !state.snapshot.concepts.some((concept) => concept.courseId === course.id);
      const name = documentTitle(analysis.pages, { fromLayout: analysis.material.kind !== "text" }) ?? (/^pasted notes$/i.test(analysis.material.title) ? null : analysis.material.title);
      if (firstTopics && name) renameCourse(course.id, name);
      const ownTitle = documentTitle(analysis.pages, { fromLayout: analysis.material.kind !== "text" });
      if (ownTitle) renameMaterial(analysis.material.id, ownTitle);
    }
  }

  // First run: show the exact source-backed proposals before any topic changes the route.
  const kind = analysis ? sourceKind(analysis.pages.map((page) => page.text).join("\n")) : "notes";
  const notNotes = kind === "notes" ? null : kind;
  const asking = Boolean(notNotes && !useAnyway);
  if (quiet && embedded) {
    if (analysis) return (
      <section className="first-source-review" aria-labelledby="first-source-review-title">
        <header>
          <h2 id="first-source-review-title" tabIndex={-1} ref={focusPhaseHeading}>{asking ? "Is this a file to revise?" : "Check the topics Kelus found."}</h2>
          {asking ? null : <>
            {analysis.coverage ? <ReadCoverage coverage={analysis.coverage} found={analysis.proposals.length} /> : null}
            <p>These come from <b>{readableFileName(analysis.material.fileName ?? analysis.material.title)}</b>. Remove anything that is not part of your exam.</p>
            <AiNote />
          </>}
        </header>
        {/* A CV or a letter reads fine and its headings look like topics, but nobody sits an exam on them: ask first. */}
        {asking && notNotes ? (
          <div className="first-source-kind" role="status">
            <p><strong>This looks like {KIND_NAME[notNotes]}, not course notes.</strong> Kelus writes exam questions from what you need to learn, so its headings would become topics like “{analysis.proposals[0]?.name ?? "a job title"}”.</p>
            <div className="first-source-kind-actions">
              {onStartOver ? <button type="button" className="cta" onClick={onStartOver}>Choose your course notes</button> : null}
              <button type="button" className="text-btn" onClick={() => { setUseAnyway(true); requestAnimationFrame(() => document.getElementById("first-source-review-title")?.focus()); }}>Use it anyway</button>
            </div>
          </div>
        ) : null}
        {asking ? null : <ol className="first-source-review-list">
          {analysis.proposals.map((proposal) => (
            <li key={proposal.id}>
              <label>
                <input type="checkbox" checked={selectedIds.has(proposal.id)} onChange={() => toggleProposal(proposal.id)} />
                <span><strong>{proposal.name}</strong><small>{proposal.locator} · “{proposal.sourceExcerpt.slice(0, 150)}{proposal.sourceExcerpt.length > 150 ? "…" : ""}”</small></span>
              </label>
            </li>
          ))}
        </ol>}
        <div className="first-source-review-actions" hidden={asking}>
          <button type="button" className="cta" disabled={!selectedIds.size} onClick={buildMap}>Use {selectedIds.size} {selectedIds.size === 1 ? "topic" : "topics"} <ArrowRight /></button>
          {previewUrl ? <a href={previewUrl} target="_blank" rel="noreferrer">Open original PDF ↗</a> : null}
          {onStartOver ? <button type="button" className="text-btn" onClick={onStartOver}>Choose another file</button> : null}
        </div>
      </section>
    );
    return <ReadingNotes message={statusMessage ?? "Finding the topics in your notes."} topics={[]} error={hardError} onStartOver={onStartOver} />;
  }

  // A source's topics in the order of the notes, each with its colour.
  const sourceTopics = (materialId: string) => {
    const ids = new Set(state.snapshot.learningActivities.filter((activity) => activity.sourceReferences.some((reference) => reference.materialId === materialId)).map((activity) => activity.conceptId));
    const topics = state.snapshot.concepts.filter((concept) => ids.has(concept.id));
    return { topicNames: topics.map((concept) => concept.name), topicTones: topics.map((concept) => toneOf(concept.id, state.snapshot.concepts)) };
  };

  const shelf = (
      <>
      {embedded ? null : (
      <header className={`materials-head${readySummary ? " is-complete" : ""}`}>
        <div><h1>{course.name}: materials</h1></div>
        <p>
          {readySummary
            ? "Your topics are on the map. Continue below, or add another source from the shelf when you need it."
            : "Add the lessons you want to revise for this exam. PDFs supply proposed revision topics; links are bookmarks only."}
        </p>
      </header>
      )}

      {showUpgrade ? <SoftUpgradePrompt moment="third_material" /> : null}

      {embedded && showIngestForm(phase) ? (
        <details
          className="material-add-page"
          open={busy || Boolean(hardError) || sourceFirst || undefined}
        >
          <summary>Add a PDF or notes</summary>
          {/* One drop area, one line of help, then the two optional choices: what kind of source, or a link instead. */}
          <section className="material-ingest is-embedded material-add-body" aria-labelledby="add-material-title">
            <h2 id="add-material-title" className="sr-only">Add your course source</h2>
            <label
              className={`material-drop material-add-drop${dragging ? " is-dragging" : ""}${busy ? " is-busy" : ""}`}
              aria-busy={busy || undefined}
              onDragEnter={() => dispatch({ type: "DRAG_ENTER" })}
              onDragLeave={() => dispatch({ type: "DRAG_LEAVE" })}
              onDragOver={(event) => event.preventDefault()}
              onDrop={drop}
            >
              <input ref={fileRef} type="file" title="" accept={SOURCE_FILE_ACCEPT} onChange={(event) => void savePdf(event.target.files?.[0])} disabled={busy} />
              <strong>{busy ? (statusMessage ?? "Reading your file…") : "Choose a file"}</strong>
              <span>{busy && statusMessage ? statusMessage : "or drop it here · PDF, plain text or a Notion .zip"}</span>
            </label>
            <p className="material-ingest-hint">Kelus finds the topics in it and adds them to your plan. PDFs with selectable text are read fastest.</p>
            <div className="material-role-field">
              <label htmlFor="material-role">Type</label>
              <select id="material-role" value={role} onChange={(event) => setRole(event.target.value as MaterialRole)} disabled={busy}>
                {MATERIAL_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div>
            {busy && workingStep ? (
              <div className="material-work-status" role="status" aria-live="polite">
                <ol className="material-work-steps" aria-label="PDF processing steps">
                  {WORKING_STEPS.map((step) => {
                    const currentIndex = WORKING_STEPS.indexOf(workingStep);
                    const stepIndex = WORKING_STEPS.indexOf(step);
                    const state = stepIndex < currentIndex ? "done" : stepIndex === currentIndex ? "current" : "todo";
                    return (
                      <li key={step} className={`is-${state}`} aria-current={state === "current" ? "step" : undefined}>
                        {workingStepLabel[step]}
                      </li>
                    );
                  })}
                </ol>
                <p>{statusMessage ?? defaultStepMessage(workingStep)}</p>
                {ocrRunning ? (
                  <button type="button" className="text-btn" onClick={cancelOcr}>Cancel OCR</button>
                ) : null}
              </div>
            ) : null}
            <details className="material-bookmarks"><summary>Save a video or web link instead</summary>
            <form className="material-link-form" onSubmit={addLink}>
              <div><label htmlFor="material-title">Title <span>optional</span></label><input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Week 3 lecture video" disabled={busy} /></div>
              <div className="material-url-field"><label htmlFor="material-url">Bookmark a video or web link</label><input id="material-url" value={url} onChange={(event) => { setUrl(event.target.value); setLinkError(null); }} placeholder="https://…" inputMode="url" disabled={busy} aria-invalid={linkError ? true : undefined} aria-describedby={linkError ? "material-url-error" : undefined} />{linkError ? <p id="material-url-error" className="material-link-error" role="alert">{linkError}</p> : null}</div>
              <button className="cta" type="submit" disabled={!url.trim() || busy}>Save bookmark</button>
            </form>
            <p className="material-link-hint">Bookmarks stay on your shelf for quick open. Upload a PDF when you want Kelus to propose topics.</p>
            </details>
            {errorKind === "ocr" ? (
              <div className="material-error-rescue" role="group" aria-label="Ways to continue after OCR">
                <p>Kelus needs selectable page text for a reliable topic map. Export a digital PDF from your notes app and try again.</p>
                <div className="material-error-actions">
                  <a className="text-btn" href="#source-shelf-title">Retry with another file</a>
                </div>
              </div>
            ) : null}
            {errorKind === "generic" ? (
              <div className="material-error-actions">
                <a className="text-btn" href="#source-shelf-title">Choose another file</a>
              </div>
            ) : null}
          </section>
        </details>
      ) : null}

      {!embedded ? (
      <section className="material-ingest" aria-labelledby="add-material-title" hidden={!showIngestForm(phase)}>
        <div className="material-ingest-title">
          <h2 id="add-material-title">Bring the course into one place.</h2>
        </div>
        <div className="material-role-field">
            <label htmlFor="material-role">This source is</label>
            <select id="material-role" value={role} onChange={(event) => setRole(event.target.value as MaterialRole)} disabled={busy}>
              {MATERIAL_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <p>
              Digital PDFs with selectable text work fastest. You review every suggested topic before it changes your revision route.
            </p>
          </div>
        <label
          className={`material-drop${dragging ? " is-dragging" : ""}${busy ? " is-busy" : ""}`}
          aria-busy={busy || undefined}
          onDragEnter={() => dispatch({ type: "DRAG_ENTER" })}
          onDragLeave={() => dispatch({ type: "DRAG_LEAVE" })}
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
        >
          <input ref={fileRef} type="file" title="" accept={SOURCE_FILE_ACCEPT} onChange={(event) => void savePdf(event.target.files?.[0])} disabled={busy} />
          <svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 33V10m0 0-8 8m8-8 8 8M10 31v7h28v-7" /></svg>
          <strong>{busy ? (statusMessage ?? "Working on your PDF…") : "Drop a PDF here"}</strong>
          <span>{busy && statusMessage ? statusMessage : "or choose a file · up to 20 MB · clear text works fastest"}</span>
        </label>
        {busy && workingStep ? (
          <div className="material-work-status" role="status" aria-live="polite">
            <ol className="material-work-steps" aria-label="PDF processing steps">
              {WORKING_STEPS.map((step) => {
                const currentIndex = WORKING_STEPS.indexOf(workingStep);
                const stepIndex = WORKING_STEPS.indexOf(step);
                const state = stepIndex < currentIndex ? "done" : stepIndex === currentIndex ? "current" : "todo";
                return (
                  <li key={step} className={`is-${state}`} aria-current={state === "current" ? "step" : undefined}>
                    {workingStepLabel[step]}
                  </li>
                );
              })}
            </ol>
            <p>{statusMessage ?? defaultStepMessage(workingStep)}</p>
            {ocrRunning ? (
              <button type="button" className="text-btn" onClick={cancelOcr}>Cancel OCR</button>
            ) : null}
          </div>
        ) : null}

        <details className="material-bookmarks"><summary>Save a video or web link instead</summary>
        <form className="material-link-form" onSubmit={addLink}>
          <div><label htmlFor="material-title">Title <span>optional</span></label><input id="material-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Week 3 lecture video" disabled={busy} /></div>
          <div className="material-url-field"><label htmlFor="material-url">Bookmark a video or web link</label><input id="material-url" value={url} onChange={(event) => { setUrl(event.target.value); setLinkError(null); }} placeholder="https://…" inputMode="url" disabled={busy} aria-invalid={linkError ? true : undefined} aria-describedby={linkError ? "material-url-error" : undefined} />{linkError ? <p id="material-url-error" className="material-link-error" role="alert">{linkError}</p> : null}</div>
          <button className="cta" type="submit" disabled={!url.trim() || busy}>Save bookmark</button>
        </form>
        <p className="material-link-hint">
          Bookmarks stay on your shelf for quick open. They do not become concepts — upload a PDF for that.
        </p>
        </details>
        {errorKind === "ocr" ? (
          <div className="material-error-rescue" role="group" aria-label="Ways to continue after OCR">
            <p>Kelus needs selectable page text for a reliable topic map. Export a digital PDF from your notes app and try again.</p>
            <div className="material-error-actions">
              <a className="text-btn" href="#source-shelf-title">Retry with another file</a>
            </div>
          </div>
        ) : null}
        {errorKind === "generic" ? (
          <div className="material-error-actions">
            <a className="text-btn" href="#source-shelf-title">Choose another file</a>
          </div>
        ) : null}
      </section>
      ) : null}

      {hardError ? <p className="material-error" role="alert">{hardError}</p> : null}
      {softNotice && !hardError ? <p className="material-error is-soft" role="status">{softNotice}</p> : null}
      <AnimatePresence initial={false} mode="wait">
        {readySummary ? (
          <motion.section
            key="material-ready"
            className="material-ready"
            aria-labelledby="material-ready-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? kelusDuration.micro : kelusDuration.normal, ease: kelusEase }}
          >
            <h2 id="material-ready-title" tabIndex={-1} ref={focusPhaseHeading}>
              {readySummary.conceptCount} confirmed concept{readySummary.conceptCount === 1 ? "" : "s"} from your file.
            </h2>
            <p>
              Your topics are saved. Next, check what you remember so Kelus can suggest where to begin. You can inspect the map whenever you need it.</p>
            <div className="material-ready-actions">
              <Link className="cta" href="/today">Continue: short check, then study <ArrowRight /></Link>
              <div className="material-ready-secondary">
                <Link href="/today?section=map">Review the index</Link>
                <button type="button" onClick={() => dispatch({ type: "ADD_ANOTHER" })}>Add another source</button>
              </div>
            </div>
          </motion.section>
        ) : null}
        {analysis ? (
          <motion.section
            key="concept-confirmation"
            className="concept-confirmation"
            aria-labelledby="concept-confirmation-title"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? kelusDuration.micro : kelusDuration.normal, ease: kelusEase }}
          >
            <header>
              <div><h2 id="concept-confirmation-title" tabIndex={-1} ref={focusPhaseHeading}>Kelus found {analysis.proposals.length} proposed concepts.</h2>{analysis.coverage ? <ReadCoverage coverage={analysis.coverage} found={analysis.proposals.length} /> : null}</div>
              <p>
                Keep only the concepts this exam actually covers. Each one retains the page where Kelus found it.
                {state.diagnosisCompleted
                  ? " Confirming a new set replaces your current map and asks you to redo the short familiarity check."
                  : null}
              </p>
            </header>
            <p className="concept-review-selection" role="status" aria-live="polite">
              {selectedIds.size} selected · Select a topic to inspect the exact text Kelus used.
            </p>
            <div className="material-review-workspace">
            <aside className="material-source-preview" aria-label="Original course PDF">
              <div className="material-source-preview-head">
                <div><span>Your source</span><strong>{analysis.material.fileName ?? analysis.material.title}</strong></div>
                {previewUrl ? <a href={`${previewUrl}#page=${previewPage}`} target="_blank" rel="noreferrer">Open PDF ↗</a> : null}
              </div>
              <div className="material-source-page" aria-label={`Extracted text from ${analysis.material.kind === "text" ? "section" : "page"} ${previewPage}`}>
                <span>{analysis.material.kind === "text" ? "Section" : "Page"} {previewPage} · text Kelus read</span>
                <p>{analysis.pages.find((page) => page.pageNumber === previewPage)?.text.slice(0, 2200) || (analysis.material.kind === "text" ? "This section is empty." : "No readable text on this page. Open the original PDF to inspect it.")}</p>
              </div>
              <p>{analysis.material.kind === "text" ? "Select a topic to check its source section." : "Select a topic to check its source page. Open PDF shows the original layout."}</p>
            </aside>
            <ol className="concept-proposal-list">
              {analysis.proposals.map((proposal, index) => (
                <li key={proposal.id} className={selectedIds.has(proposal.id) ? "is-selected" : undefined} onFocusCapture={() => setPreviewPage(Number(proposal.locator.match(/\d+/)?.[0] ?? 1))} onMouseEnter={() => setPreviewPage(Number(proposal.locator.match(/\d+/)?.[0] ?? 1))}>
                  <div className="proposal-row">
                    <input
                      id={`proposal-${proposal.id}`}
                      type="checkbox"
                      checked={selectedIds.has(proposal.id)}
                      onChange={() => toggleProposal(proposal.id)}
                      aria-labelledby={`proposal-name-${proposal.id}`}
                    />
                    <span className="proposal-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <span className="proposal-fields">
                      <input
                        id={`proposal-name-${proposal.id}`}
                        className="proposal-name-input"
                        value={draftNames[proposal.id] ?? proposal.name}
                        onChange={(event) => setDraftNames((current) => ({ ...current, [proposal.id]: event.target.value }))}
                        aria-label={`Concept name from ${proposal.locator}`}
                      />
                      <small>{analysis.material.title} · {proposal.locator}</small>
                      <small className={`proposal-confidence is-${proposalConfidence(proposal)}`}>
                        {proposalConfidence(proposal) === "high"
                          ? "High confidence · grounded in page text"
                          : "Review carefully · inferred from limited source text"}
                      </small>
                      <span className="proposal-source-excerpt">“{proposal.sourceExcerpt.slice(0, 260)}{proposal.sourceExcerpt.length > 260 ? "…" : ""}”</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
            </div>
            <div className="concept-confirmation-actions">
              <button type="button" className="cta" disabled={!selectedIds.size} onClick={buildMap}>Confirm topics <ArrowRight /></button>
              <div className="concept-confirmation-secondary">
                <button type="button" onClick={() => dispatch({ type: "REVIEW_LATER" })}>Review later</button>
              </div>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>

      <section className={`material-shelf${embedded ? " is-binder" : ""}`} aria-labelledby="source-shelf-title">
        <header>
          <div>
            <h2 id="source-shelf-title">
              {courseMaterials.length
                ? embedded ? <>Your notes <span className="material-shelf-count">{courseMaterials.length} {courseMaterials.length === 1 ? "source" : "sources"}</span></> : `${courseMaterials.length} saved`
                : concepts.length
                  ? "Sample model ready"
                  : embedded
                    ? "No notes yet"
                    : "Nothing saved yet"}
            </h2>
          </div>
          {embedded ? null : <span>This device</span>}
        </header>
        {courseMaterials.length ? (
          <ul>{courseMaterials.map((item) => <MaterialRow key={item.id} item={item} userId={auth.user?.id} syncState={syncStates[item.id]} quiet={embedded} onAnalyze={(material) => void analyzePdf(material)} onRemoved={(material) => removeMaterialSource(material.id)} linkedTopics={state.snapshot.learningActivities.filter((activity) => activity.sourceReferences.some((reference) => reference.materialId === item.id)).length} {...sourceTopics(item.id)} />)}</ul>
        ) : concepts.length ? (
          <div className="material-shelf-empty">
            <p>Sample model is ready. Add your own syllabus when you want Kelus grounded in your files.</p>
            <Link className="cta" href="/today">
              Continue to study plan <ArrowRight />
            </Link>
          </div>
        ) : (
          <div className="material-shelf-empty">
            <p>{embedded ? "Add the syllabus or lecture for this exam. Kelus proposes topics you confirm." : "No sources on this shelf yet. Add the syllabus or lecture you’re studying — Kelus will propose topics you confirm."}</p>
            <div className="materials-empty-actions">
              <a className="cta" href="#add-material-title">
                Add first PDF <ArrowRight />
              </a>
            </div>
          </div>
        )}
      </section>

      {embedded ? (
        <p className="material-binder-note">Everything stays on this device unless you sign in to sync.</p>
      ) : (
        <aside className="material-honesty">
          <p>{auth.user ? "Signed-in materials are stored in your private Kelus account and cached on this device. " : "Materials stay on this device until you sign in. "}Kelus uses only the concepts you confirm, and every learning activity keeps its source page visible.</p>
        </aside>
      )}
      </>
  );
  return embedded ? <div className={`material-binder-stack${sourceFirst ? " is-source-first" : ""}`}>{shelf}</div> : <AppShell>{shelf}</AppShell>;
}
