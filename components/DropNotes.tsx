"use client";

import { BrandIcon } from "@/components/BrandIcon";
import { useEffect, useState, type DragEvent } from "react";
import { PackArt } from "@/components/PackArt";
import { PasteNotes } from "@/components/PasteNotes";
import { MAX_NOTES_BYTES } from "@/domain/markdown-pages";
import { SOURCE_FILE_ACCEPT, isNotesFile, isSourceFile, isZipFile } from "@/domain/materials";
import { folderToNotesFile, zipToNotesFile } from "@/lib/zip-notes";
import { takePendingSetupFile } from "@/lib/pending-setup-file";

/**
 * The first screen, and the screen for a course with no notes: one job. Put your notes in; Kelus reads them and
 * opens your first question. No stepper, no exam form, no topic checklist.
 */
export function DropNotes({ onFile, first = false, courseName }: { onFile: (file: File) => Promise<void>; first?: boolean; courseName?: string }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function take(picked: File | undefined) {
    setDragging(false);
    if (!picked || busy) return;
    if (!isSourceFile(picked)) return setError("Choose a PDF, notes as a .md or .txt file, a Notion export or an Obsidian vault (.zip or a folder).");
    setBusy(true);
    setError("");
    try {
      const file = isZipFile(picked) ? await zipToNotesFile(picked) : picked;
      if (isNotesFile(file) && file.size > MAX_NOTES_BYTES) throw new Error("These notes are over 2 MB. Choose a smaller file or split them.");
      if (!isNotesFile(file) && file.size > 20 * 1024 * 1024) throw new Error("This PDF is over 20 MB. Choose a smaller export or split it first.");
      await onFile(file);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Kelus couldn’t read that file. Try another one.");
      setBusy(false);
    }
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
      if (busy) return;
      setBusy(true);
      setError("");
      void folderToNotesFile(entry as FileSystemDirectoryEntry).then((file) => { setBusy(false); return take(file); }, (caught: unknown) => {
        setError(caught instanceof Error && caught.message ? caught.message : "Kelus couldn’t read that folder. Try a zip of it instead.");
        setBusy(false);
      });
      return;
    }
    void take(event.dataTransfer.files[0]);
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
              ? "A PDF, a Notion export or pasted text. Kelus finds the topics, and your first question is ready in about a minute."
              : "A PDF, a Notion export or pasted text. Kelus finds the topics and adds them to today’s plan."}
          </p>
          <label
            className={`setup-first-upload${dragging ? " is-dragging" : ""}`}
            aria-busy={busy || undefined}
            onDragEnter={() => setDragging(true)}
            onDragLeave={() => setDragging(false)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={drop}
          >
            <input type="file" title="" accept={SOURCE_FILE_ACCEPT} disabled={busy} onChange={(event) => { void take(event.target.files?.[0]); event.target.value = ""; }} />
            <span className="setup-upload-mark" aria-hidden="true"><PackArt name="folder" size={44} /></span>
            <strong>{busy ? "Reading your file…" : "Choose a PDF or notes"}</strong>
            {/* Dragging only exists with a mouse or trackpad; a phone gets the file types instead. */}
            <span>{busy ? "This takes a few seconds." : <><span className="drop-hint">or drop it here · </span>PDF, <span className="brand-inline"><BrandIcon brand="markdown" size={15} />Markdown</span>, .txt or a <span className="brand-inline"><BrandIcon brand="notion" size={14} />Notion</span> .zip</>}</span>
          </label>
          <PasteNotes onFile={(file) => void take(file)} disabled={busy} />
          {error ? <p className="setup-error" role="alert">{error}</p> : null}
          <p className="setup-file-help">PDFs up to 20 MB, scans included. From Notion: Export, then Markdown &amp; CSV, and choose the .zip.</p>
          <p className="setup-privacy-note">Your notes stay on this device. You can sign in later to sync.</p>
        </section>
      </div>
    </main>
  );
}
