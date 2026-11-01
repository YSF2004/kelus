"use client";

import { BrandIcon } from "@/components/BrandIcon";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { PackArt } from "@/components/PackArt";
import { PasteNotes } from "@/components/PasteNotes";
import { PhotoNotes } from "@/components/PhotoNotes";
import { MAX_NOTES_BYTES } from "@/domain/markdown-pages";
import { SOURCE_FILE_ACCEPT, isNotesFile, isSourceFile, isZipFile } from "@/domain/materials";
import { folderToNotesFile, zipToNotesFile } from "@/lib/zip-notes";
import { takePendingSetupFile } from "@/lib/pending-setup-file";
import { photosToPdfFile } from "@/lib/photo-notes";
import styles from "./DropNotes.module.css";

const isPhoto = (file: File) => file.type.startsWith("image/") || /\.(?:jpe?g|png|heic|heif|webp)$/i.test(file.name);

/**
 * The first screen, and the screen for a course with no notes: one job. Put your notes in; Kelus reads them and
 * opens your first question. No stepper, no exam form, no topic checklist.
 */
export function DropNotes({ onFile, first = false, courseName }: { onFile: (file: File) => Promise<void>; first?: boolean; courseName?: string }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [stage, setStage] = useState("");
  const importing = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function importSource(name: string, prepare: () => Promise<File>, preparation: string) {
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
      setStage("Finding topics in your notes…");
      await onFile(file);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Kelus couldn’t read that source. Try another file or paste the text below.");
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
      return setError("Choose a PDF, notes as a .md or .txt file, a Notion export or an Obsidian vault (.zip or a folder).");
    }
    await importSource(picked.name, async () => isZipFile(picked) ? zipToNotesFile(picked) : picked,
      isZipFile(picked) ? "Opening your notes archive…" : "Reading your file…");
  }

  async function takePhotos(photos: File[]) {
    setDragging(false);
    if (!photos.length) return;
    await importSource(photos.length === 1 ? photos[0].name : `${photos.length} photos`,
      () => photosToPdfFile(photos), "Preparing your photos…");
  }

  // A file chosen while the sample was open, or shared from another app: start from it instead of asking again.
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
      void importSource(entry.name, () => folderToNotesFile(entry as FileSystemDirectoryEntry), "Opening your notes folder…");
      return;
    }
    // Several photos of pages dropped together become one set of notes, in the order they were dropped.
    const files = [...event.dataTransfer.files];
    if (files.length > 1 && files.every(isPhoto)) { void takePhotos(files); return; }
    void take(files[0]);
  }

  return (
    <main id="main" className="destination-page is-booklet-product is-marked-setup is-material-first start-page">
      <div className="destination-form">
        <section className="setup-stage-content empty-course" aria-labelledby="start-title">
          {/* From the Kelus illustration pack (public/art/notion-pack): a student climbing with a pencil. */}
          <PackArt name="growing" className="empty-course-art" size={170} />
          <h1 id="start-title" className="destination-page-title">{first ? "Start with your notes." : courseName ? `Add notes to ${courseName}.` : "Add your notes."}</h1>
          <p className="destination-support">
            {first
              ? "A PDF, photos of your pages, a Notion export or pasted text. Check the topics Kelus finds, then start your first question."
              : "A PDF, photos of your pages, a Notion export or pasted text. Kelus finds the topics and adds them to today’s plan."}
          </p>
          <label
            className={`setup-first-upload${dragging ? " is-dragging" : ""}`}
            aria-busy={busy || undefined}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <input ref={fileInput} type="file" aria-label="Choose a PDF or notes" accept={SOURCE_FILE_ACCEPT} disabled={busy} onChange={(event) => { void take(event.target.files?.[0]); event.target.value = ""; }} />
            <span className="setup-upload-mark" aria-hidden="true"><PackArt name="folder" size={44} /></span>
            <strong>{busy ? stage : "Choose a PDF or notes"}</strong>
            {/* Dragging only exists with a mouse or trackpad; a phone gets the file types instead. */}
            <span>{busy ? "Larger files and scanned pages can take longer." : <><span className="drop-hint">or drop it here · </span>PDF, <span className="brand-inline"><BrandIcon brand="markdown" size={15} />Markdown</span>, .txt or a <span className="brand-inline"><BrandIcon brand="notion" size={14} />Notion</span> .zip</>}</span>
          </label>
          <div role="status" aria-live="polite" aria-atomic="true" className={styles.status}>
            {busy ? <><strong>{sourceName}</strong><span>{stage} Keep this page open while Kelus reads the source.</span></> : null}
          </div>
          <PhotoNotes onFile={(file) => void take(file)} disabled={busy} />
          <PasteNotes onFile={(file) => void take(file)} disabled={busy} />
          {error ? <div className={styles.recovery}>
            <div role="alert"><strong>Couldn’t use {sourceName || "that source"}.</strong><p>{error}</p></div>
            <button type="button" onClick={() => fileInput.current?.click()}>Choose another file</button>
            <p>You can also paste the relevant section above. Any text you entered stays here.</p>
          </div> : null}
          <p className="setup-file-help">PDFs up to 20 MB, scans included. From Notion: Export, then Markdown &amp; CSV, and choose the .zip.</p>
          <p className="setup-privacy-note">Your notes stay on this device. You can sign in later to sync.</p>
        </section>
      </div>
    </main>
  );
}
