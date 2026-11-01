import { MAX_ARCHIVE_NOTE_FILES, notesFromTexts, notesFromZip, sourceOfPaths, type ArchiveImportReport, type ArchiveOmission, type NotesFromZip } from "@/domain/notion-zip";
import { ZipError } from "@/domain/zip-read";

export const MAX_ZIP_BYTES = 40 * 1024 * 1024;
const MAX_FOLDER_OMISSION_DETAILS = 12;

/** A zip export becomes one Markdown notes file, so everything after this treats it like any other notes. */
export type PreparedNotesFile = { file: File; report: ArchiveImportReport | null };

export async function zipToNotesFile(file: File): Promise<PreparedNotesFile> {
  if (file.size > MAX_ZIP_BYTES) throw new ZipError("This zip is over 40 MB. Export fewer pages and try again.");
  const notes = await notesFromZip(await file.arrayBuffer());
  return asNotesFile(notes, file.name.replace(/\.zip$/i, "").replace(/\s+[0-9a-f]{32}$/i, ""));
}

// RFC 7763's variant parameter keeps where the notes came from, so the library can show Notion's or Obsidian's mark.
function asNotesFile({ markdown, source, report }: NotesFromZip, name: string) {
  return {
    file: new File([markdown], `${name.trim() || "notes"}.md`, { type: `text/markdown;variant=${source}` }),
    report: report.omittedCount ? report : null,
  };
}

/** The note files inside a folder dropped from Finder or Files (an Obsidian vault), read in the browser. */
async function readFolder(
  entry: FileSystemDirectoryEntry,
  prefix = "",
  out: Array<{ path: string; text: string }> = [],
  seen: string[] = [],
  omissions: { omittedCount: number; omissions: ArchiveOmission[] } = { omittedCount: 0, omissions: [] },
) {
  const children = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    const reader = entry.createReader();
    const all: FileSystemEntry[] = [];
    // readEntries returns at most 100 at a time; an empty batch means the folder is done.
    const next = () => reader.readEntries((batch) => (batch.length ? (all.push(...batch), next()) : resolve(all)), reject);
    next();
  });
  const omit = (path: string, reason: string) => {
    omissions.omittedCount += 1;
    if (omissions.omissions.length < MAX_FOLDER_OMISSION_DETAILS) omissions.omissions.push({ path, reason });
  };
  for (const child of children) {
    const path = `${prefix}${child.name}`;
    seen.push(child.isDirectory ? `${path}/` : path);
    if (child.isDirectory && child.name.startsWith(".")) continue;
    if (out.length >= MAX_ARCHIVE_NOTE_FILES) {
      if (child.isDirectory || /\.(md|markdown|txt)$/i.test(child.name)) {
        omit(path, `The ${MAX_ARCHIVE_NOTE_FILES}-note import limit was reached.`);
      }
      continue;
    }
    if (child.isDirectory) {
      await readFolder(child as FileSystemDirectoryEntry, `${path}/`, out, seen, omissions);
    } else if (/\.(md|markdown|txt)$/i.test(child.name)) {
      try {
        const file = await new Promise<File>((resolve, reject) => (child as FileSystemFileEntry).file(resolve, reject));
        out.push({ path, text: await file.text() });
      } catch {
        omit(path, "Kelus couldn't read this note file.");
      }
    }
  }
  return { out, seen, omissions };
}

export async function folderToNotesFile(entry: FileSystemDirectoryEntry): Promise<PreparedNotesFile> {
  const { out, seen, omissions } = await readFolder(entry);
  if (!out.length) throw new ZipError("That folder has no notes in it. Drop a folder of .md notes, like an Obsidian vault.");
  return asNotesFile(notesFromTexts(out, sourceOfPaths(seen), omissions), entry.name);
}
