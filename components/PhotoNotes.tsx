"use client";

import { useState } from "react";
import { photosToPdfFile } from "@/lib/photo-notes";

/** Enough pages for a lesson; more would take long to read on a phone. */
const MAX_PHOTOS = 12;

/**
 * "Take photos of your notes": on a phone it opens the camera, one page at a time; on a computer it picks images.
 * The pages wait here until the student says they are done, then become one PDF for the usual reader.
 */
export function PhotoNotes({ onFile, disabled }: { onFile: (file: File) => void; disabled?: boolean }) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  // The camera / image picker is made when asked for and removed after, so the start screen keeps a single file
  // input (the PDF one). It sits in the page while open, which some phone browsers need to show the picker.
  function pick() {
    if (disabled || working) return;
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = "image/*";
    picker.multiple = true;
    picker.setAttribute("capture", "environment");
    picker.hidden = true;
    const done = () => picker.remove();
    picker.addEventListener("change", () => { add(picker.files); done(); }, { once: true });
    picker.addEventListener("cancel", done, { once: true });
    document.body.append(picker);
    picker.click();
  }

  function add(list: FileList | null) {
    const picked = [...(list ?? [])].filter((file) => file.type.startsWith("image/"));
    if (!picked.length) return;
    setError("");
    setPhotos((current) => [...current, ...picked].slice(0, MAX_PHOTOS));
  }

  async function read() {
    setWorking(true);
    setError("");
    try {
      onFile(await photosToPdfFile(photos));
      setPhotos([]);
    } catch (caught) {
      setError(caught instanceof Error && caught.message ? caught.message : "Kelus couldn’t read those photos. Try again.");
    } finally {
      setWorking(false);
    }
  }

  const count = photos.length;
  return (
    <div className="photo-notes">
      {count === 0 ? (
        <button type="button" className="photo-notes-start" disabled={disabled} onClick={pick}>
          Take photos of your notes
        </button>
      ) : (
        <div className="photo-notes-pages" aria-live="polite">
          <p><b>{count === 1 ? "1 page" : `${count} pages`}</b> ready. Printed pages and clear writing read best.</p>
          <div className="photo-notes-actions">
            <button type="button" className="k-btn" disabled={disabled || working} onClick={() => void read()}>
              {working ? "Preparing…" : count === 1 ? "Read this page" : `Read these ${count} pages`}
            </button>
            {count < MAX_PHOTOS ? <button type="button" className="photo-notes-more" disabled={disabled || working} onClick={pick}>Add another page</button> : null}
            <button type="button" className="photo-notes-more" disabled={working} onClick={() => setPhotos([])}>Start again</button>
          </div>
        </div>
      )}
      {error ? <p className="setup-error" role="alert">{error}</p> : null}
    </div>
  );
}
