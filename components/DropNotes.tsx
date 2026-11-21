"use client";

import { BrandIcon } from "@/components/BrandIcon";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone, type DropEvent, type FileRejection } from "react-dropzone";
import { PackArt } from "@/components/PackArt";
import Link from "next/link";
import { PasteNotes } from "@/components/PasteNotes";
import { PhotoNotes } from "@/components/PhotoNotes";
import { MAX_NOTES_BYTES } from "@/domain/markdown-pages";
import { isNotesFile, isSlidesFile, isSourceFile, isZipFile } from "@/domain/materials";
import { folderToNotesFile, zipToNotesFile, slidesToNotesFile } from "@/lib/zip-notes";
import { takePendingSetupFile } from "@/lib/pending-setup-file";
import { photosToPdfFile } from "@/lib/photo-notes";
import { trackEvent } from "@/lib/analytics";
import { getSourceIntakeVariant, type SourceIntakeVariant } from "@/lib/source-intake-experiment";
import styles from "./DropNotes.module.css";

const isPhoto = (file: File) => file.type.startsWith("image/") || /\.(?:jpe?g|png|heic|heif|webp)$/i.test(file.name);

function sourceType(file: File) {
  if (isSlidesFile(file)) return "Slides";
  if (isZipFile(file)) return "Notes export";
  if (isNotesFile(file)) return "Notes";
  return "PDF";
}

function formatSize(bytes: number) {
  return bytes < 1_000_000 ? `${Math.max(1, Math.round(bytes / 1_000))} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

const importSteps = ["Reading your source", "Finding study topics", "Opening your first question"] as const;
const ease = [0.22, 1, 0.36, 1] as const;
const SOURCE_ACCEPT = {
  "application/pdf": [".pdf"],
  "text/markdown": [".md", ".markdown"],
  "text/plain": [".txt"],
  "application/zip": [".zip"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "image/*": [".jpg", ".jpeg", ".png", ".heic", ".heif", ".webp"],
} as const;
const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

function describeRejectedFile(rejection: FileRejection) {
  const name = rejection.file.name || "That file";
  const code = rejection.errors[0]?.code;
  if (code === "file-too-large") return `${name} is over the 20 MB limit. Choose a smaller export or split it first.`;
  if (code === "file-invalid-type") return `${name} is not a PDF, slide deck, notes file, export or photo of notes.`;
  return `${name} couldn’t be added. Choose a PDF, slides, notes, export or photo of notes.`;
}

/** A source receipt, not a generic spinner: the learner can see their own file and exactly what Kelus is doing with it. */
function ImportReceipt({ name, detail, stage, reduce }: { name: string; detail: string; stage: string; reduce: boolean }) {
  const activeStep = /finding topics/i.test(stage) ? 1 : 0;
  return (
    <motion.span
      className="setup-import-receipt"
      initial={reduce ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease }}
    >
      <span className="setup-upload-state">Kept on this device</span>
      <strong title={name}>{name}</strong>
      <span>{detail || "Preparing your source"}{stage ? ` · ${stage}` : ""}</span>
      <ol className="setup-upload-steps" aria-label="Preparing your first question">
        {importSteps.map((label, index) => {
          const state = index < activeStep ? "done" : index === activeStep ? "current" : "next";
          return <li key={label} data-state={state}>
            <i aria-hidden="true">{state === "done" ? "✓" : ""}</i><span>{label}</span>
          </li>;
        })}
      </ol>
    </motion.span>
  );
}

/**
 * The first screen, and the screen for a course with no notes: one job. Put your notes in; Kelus reads them and
 * opens your first question. No stepper, no exam form, no topic checklist.
 */
export function DropNotes({ onFile, first = false, courseName }: { onFile: (file: File) => Promise<void>; first?: boolean; courseName?: string }) {
  const reduce = useReducedMotion() === true;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [stage, setStage] = useState("");
  // The source picker is server-rendered too; this only changes two pieces of
  // explanatory copy, so the browser may take its persisted assignment once it
  // hydrates without changing the action or the surrounding layout.
  const [intakeVariant] = useState<SourceIntakeVariant>(() => first && typeof window !== "undefined" ? getSourceIntakeVariant() : "reference");
  const importing = useRef(false);

  async function importSource(name: string, prepare: () => Promise<File>, preparation: string, kind?: string) {
    if (importing.current) return;
    importing.current = true;
    setBusy(true);
    setError("");
    setSourceName(name);
    setStage(preparation);
    try {
      const file = await prepare();
      if (isNotesFile(file) && file.size > MAX_NOTES_BYTES) throw new Error("These notes are over 2 MB. Choose a smaller file or split them.");
      if (!isNotesFile(file) && file.size > MAX_SOURCE_BYTES) throw new Error("This file is over 20 MB. Choose a smaller export or split it first.");
      // The upload target becomes the source itself as soon as we have a real file, rather than a generic loader.
      setSourceName(file.name || name);
      setSourceDetail(`${kind ?? sourceType(file)} · ${formatSize(file.size)}`);
      setStage("Finding topics in your notes…");
      await onFile(file);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "That source couldn’t be read. Try another file or paste the text below.");
    } finally {
      importing.current = false;
      setBusy(false);
      setStage("");
    }
  }

  async function take(picked: File | undefined) {
    if (!picked || importing.current) return;
    // A photo of a page dropped here goes the way "Take photos of your notes" goes, rather than being refused.
    if (isPhoto(picked)) return takePhotos([picked]);
    if (!isSourceFile(picked)) {
      setSourceName(picked.name);
      return setError("Choose a PDF, PowerPoint slides, a notes text file, a Notion export or an Obsidian vault (.zip or a folder).");
    }
    await importSource(picked.name, async () => isSlidesFile(picked) ? slidesToNotesFile(picked) : isZipFile(picked) ? zipToNotesFile(picked) : picked,
      isSlidesFile(picked) ? "Reading your slides…" : isZipFile(picked) ? "Opening your notes archive…" : "Reading your file…",
      sourceType(picked));
  }

  async function takePhotos(photos: File[]) {
    if (!photos.length) return;
    await importSource(photos.length === 1 ? photos[0].name : `${photos.length} photos`,
      () => photosToPdfFile(photos), "Preparing your photos…", "Photos");
  }

  // A file chosen while this screen is open, or shared from another app: start from it instead of asking again.
  useEffect(() => {
    const waiting = takePendingSetupFile();
    if (waiting) queueMicrotask(() => void take(waiting));
    // Once, when this screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This compares two explanations of the same action, not two different
  // study experiences. It deliberately records neither file details nor text.
  useEffect(() => {
    if (!first) return;
    trackEvent({ name: "source_intake_viewed", variant: intakeVariant });
  }, [first, intakeVariant]);

  const handleDrop = useCallback((accepted: File[], rejected: FileRejection[], event: DropEvent) => {
    if (rejected.length) setError(describeRejectedFile(rejected[0]));
    if (!accepted.length || importing.current) return;
    // A whole folder (an Obsidian vault from Finder or Files) is read note by note into one notes file.
    const dataTransfer = (event as unknown as { dataTransfer?: DataTransfer }).dataTransfer ?? null;
    const entry = dataTransfer?.items?.[0]?.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      void importSource(entry.name, () => folderToNotesFile(entry as FileSystemDirectoryEntry), "Opening your notes folder…", "Notes folder");
      return;
    }
    // Several photos of pages dropped together become one set of notes, in the order they were dropped.
    if (accepted.length > 1 && accepted.every(isPhoto)) { void takePhotos(accepted); return; }
    void take(accepted[0]);
  // Existing file intake remains the single validator; Dropzone only owns the reliable browser interaction.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { getInputProps, getRootProps, isDragActive, isDragReject, open } = useDropzone({
    accept: SOURCE_ACCEPT,
    disabled: busy,
    maxSize: MAX_SOURCE_BYTES,
    multiple: true,
    onDrop: handleDrop,
    validator: (file) => isPhoto(file) || isSourceFile(file) ? null : { code: "file-invalid-type", message: "Choose a supported study source." },
  });

  return (
    <main id="main" className="destination-page is-booklet-product is-marked-setup is-material-first start-page">
      <div className="destination-form">
        <section className="setup-stage-content empty-course" aria-labelledby="start-title">
          <div className="source-onboarding-heading">
            <div>
              <h1 id="start-title" className="destination-page-title">{first ? "Start with your notes." : courseName ? `Add notes to ${courseName}.` : "Add your notes."}</h1>
              <p className="destination-support">
                {first
                  ? "Bring the material you are actually studying. Kelus finds its topics, then asks your first question from the source."
                  : "Add another source and Kelus will connect its topics to today’s plan."}
              </p>
            </div>
            {/* From the founder's Notion-style illustration pack: a learner with their material. */}
            <PackArt name="taking-note" className="empty-course-art" size={156} />
          </div>
          <div
            {...getRootProps({
              className: `setup-first-upload${isDragActive ? " is-dragging" : ""}${isDragReject ? " is-rejecting" : ""}`,
              "aria-busy": busy || undefined,
              "aria-label": "Choose a PDF, notes, slides, export or photo of notes",
            })}
          >
            <input {...getInputProps({ "aria-label": "Choose a PDF or notes" })} />
            <span className="setup-upload-mark" aria-hidden="true"><PackArt name="folder" size={44} /></span>
            <span className="setup-upload-copy" role={busy ? "status" : undefined} aria-live={busy ? "polite" : undefined}>
              {busy ? <>
                <AnimatePresence mode="wait" initial={false}>
                  <ImportReceipt key={sourceName || stage} name={sourceName} detail={sourceDetail} stage={stage} reduce={reduce} />
                </AnimatePresence>
              </> : <>
                <strong suppressHydrationWarning>{isDragReject ? "That file will not work here" : isDragActive ? "Drop it to add it" : intakeVariant === "course_story" ? "Add your course file" : "Choose a course file"}</strong>
                {/* Dragging only exists with a mouse or trackpad; a phone gets the file types instead. */}
                <span suppressHydrationWarning>{isDragReject ? "Use a PDF, slide deck, notes file, Notion export or photo of your notes." : isDragActive ? "Release to begin reading it." : intakeVariant === "course_story" ? <>PDF, slides, notes or a course export. Kelus finds topics, then asks your first question.</> : <><span className="drop-hint">or drop it here · </span>PDF, slides, plain text, a <span className="brand-inline"><BrandIcon brand="notion" size={14} />Notion</span> .zip or a photo</>}</span>
              </>}
            </span>
          </div>
          {!busy ? <div className="source-first-next" aria-label="What happens after you add a source">
            <span>Kelus reads the source</span><span aria-hidden="true">→</span><span>You check the topics</span><span aria-hidden="true">→</span><span>Your first recall question</span>
          </div> : null}
          <PhotoNotes onFile={(file) => void take(file)} disabled={busy} />
          <PasteNotes onFile={(file) => void take(file)} disabled={busy} />
          {first && !busy ? <Link className={styles.example} href="/today?sample=1">See a 1-minute example first <span aria-hidden="true">→</span></Link> : null}
          {error ? <div className={styles.recovery}>
            <div role="alert"><strong>Couldn’t use {sourceName || "that source"}.</strong><p>{error}</p></div>
            <button type="button" onClick={open}>Choose another file</button>
            <p>You can also paste the relevant section above. Any text you entered stays here.</p>
          </div> : null}
          <p className="setup-file-help">PDFs up to 20 MB. Printed scans can be read; blurred or handwritten pages may need pasted text. For Notion, export your notes and choose the .zip.</p>
          <p className="setup-privacy-note">Your notes stay on this device. Kelus uses them as reference for your questions—not as instructions. You can sign in later to sync.</p>
        </section>
      </div>
    </main>
  );
}
