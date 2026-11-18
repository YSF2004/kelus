"use client";

import { BrandIcon } from "@/components/BrandIcon";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { PackArt } from "@/components/PackArt";
import Link from "next/link";
import { PasteNotes } from "@/components/PasteNotes";
import { PhotoNotes } from "@/components/PhotoNotes";
import { MAX_NOTES_BYTES } from "@/domain/markdown-pages";
import { SOURCE_FILE_ACCEPT, isNotesFile, isSlidesFile, isSourceFile, isZipFile } from "@/domain/materials";
import { folderToNotesFile, zipToNotesFile, slidesToNotesFile } from "@/lib/zip-notes";
import { takePendingSetupFile } from "@/lib/pending-setup-file";
import { photosToPdfFile } from "@/lib/photo-notes";
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

/**
 * The first screen, and the screen for a course with no notes: one job. Put your notes in; Kelus reads them and
 * opens your first question. No stepper, no exam form, no topic checklist.
 */
export function DropNotes({ onFile, first = false, courseName }: { onFile: (file: File) => Promise<void>; first?: boolean; courseName?: string }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceDetail, setSourceDetail] = useState("");
  const [stage, setStage] = useState("");
  const importing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
      if (!isNotesFile(file) && file.size > 20 * 1024 * 1024) throw new Error("This PDF is over 20 MB. Choose a smaller export or split it first.");
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
    setDragging(false);
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
    setDragging(false);
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

  function drop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    // A whole folder (an Obsidian vault from Finder or Files) is read note by note into one notes file.
    const entry = event.dataTransfer.items?.[0]?.webkitGetAsEntry?.();
    if (entry?.isDirectory) {
      setDragging(false);
      void importSource(entry.name, () => folderToNotesFile(entry as FileSystemDirectoryEntry), "Opening your notes folder…", "Notes folder");
      return;
    }
    // Several photos of pages dropped together become one set of notes, in the order they were dropped.
    const files = [...event.dataTransfer.files];
    if (files.length > 1 && files.every(isPhoto)) { void takePhotos(files); return; }
    void take(files[0]);
  }

  function leaveDropTarget(event: DragEvent<HTMLLabelElement>) {
    // Child elements fire dragleave too. Only end the visual state when the file really leaves the whole target.
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  }

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
          <label
            className={`setup-first-upload${dragging ? " is-dragging" : ""}`}
            aria-busy={busy || undefined}
            onDragEnter={() => setDragging(true)}
            onDragLeave={leaveDropTarget}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <input ref={fileInput} type="file" aria-label="Choose a PDF or notes" accept={SOURCE_FILE_ACCEPT} disabled={busy} onChange={(event) => { void take(event.target.files?.[0]); event.target.value = ""; }} />
            <span className="setup-upload-mark" aria-hidden="true"><PackArt name="folder" size={44} /></span>
            <span className="setup-upload-copy" role={busy ? "status" : undefined} aria-live={busy ? "polite" : undefined}>
              {busy ? <>
                <span className="setup-upload-state">Reading your source</span>
                <strong title={sourceName}>{sourceName}</strong>
                <span>{sourceDetail}{sourceDetail ? " · " : ""}{stage}</span>
                <span className="setup-upload-progress" aria-hidden="true" />
              </> : <>
                <strong>{dragging ? "Drop it to add it" : "Choose a PDF or notes"}</strong>
                {/* Dragging only exists with a mouse or trackpad; a phone gets the file types instead. */}
                <span>{dragging ? "Release to begin reading it." : <><span className="drop-hint">or drop it here · </span>PDF, slides, plain text or a <span className="brand-inline"><BrandIcon brand="notion" size={14} />Notion</span> .zip</>}</span>
              </>}
            </span>
          </label>
          {!busy ? <div className="source-first-next" aria-label="What happens after you add a source">
            <span>Kelus reads the source</span><span aria-hidden="true">→</span><span>You check the topics</span><span aria-hidden="true">→</span><span>Your first recall question</span>
          </div> : null}
          <PhotoNotes onFile={(file) => void take(file)} disabled={busy} />
          <PasteNotes onFile={(file) => void take(file)} disabled={busy} />
          {first && !busy ? <Link className={styles.example} href="/today?sample=1">Try a short example first <span aria-hidden="true">→</span></Link> : null}
          {error ? <div className={styles.recovery}>
            <div role="alert"><strong>Couldn’t use {sourceName || "that source"}.</strong><p>{error}</p></div>
            <button type="button" onClick={() => fileInput.current?.click()}>Choose another file</button>
            <p>You can also paste the relevant section above. Any text you entered stays here.</p>
          </div> : null}
          <p className="setup-file-help">PDFs up to 20 MB; scans included. For Notion, export your notes and choose the .zip.</p>
          <p className="setup-privacy-note">Your notes stay on this device. Kelus uses them as reference for your questions—not as instructions. You can sign in later to sync.</p>
        </section>
      </div>
    </main>
  );
}
