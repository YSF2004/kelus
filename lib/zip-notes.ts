import { notesFromTexts, notesFromZip, sourceOfPaths, type NotesFromZip } from "@/domain/notion-zip";
import { ZipError } from "@/domain/zip-read";

export const MAX_ZIP_BYTES = 40 * 1024 * 1024;

/** A zip export becomes one Markdown notes file, so everything after this treats it like any other notes. */
export async function zipToNotesFile(file: File): Promise<File> {
  if (file.size > MAX_ZIP_BYTES) throw new ZipError("This zip is over 40 MB. Export fewer pages and try again.");
  const notes = await notesFromZip(await file.arrayBuffer());
  return asNotesFile(notes, file.name.replace(/\.zip$/i, "").replace(/\s+[0-9a-f]{32}$/i, ""));
}

// RFC 7763's variant parameter keeps where the notes came from, so the library can show Notion's or Obsidian's mark.
function asNotesFile({ markdown, source }: NotesFromZip, name: string) {
  return new File([markdown], `${name.trim() || "notes"}.md`, { type: `text/markdown;variant=${source}` });
}

/** The note files inside a folder dropped from Finder or Files (an Obsidian vault), read in the browser. */
async function readFolder(entry: FileSystemDirectoryEntry, prefix = "", out: Array<{ path: string; text: string }> = [], seen: string[] = []) {
  const children = await new Promise<FileSystemEntry[]>((resolve, reject) => {
    const reader = entry.createReader();
    const all: FileSystemEntry[] = [];
    // readEntries returns at most 100 at a time; an empty batch means the folder is done.
    const next = () => reader.readEntries((batch) => (batch.length ? (all.push(...batch), next()) : resolve(all)), reject);
    next();
  });
  for (const child of children) {
    const path = `${prefix}${child.name}`;
    seen.push(child.isDirectory ? `${path}/` : path);
    if (child.isDirectory) {
      if (!child.name.startsWith(".") && out.length < 60) await readFolder(child as FileSystemDirectoryEntry, `${path}/`, out, seen);
    } else if (/\.(md|markdown|txt)$/i.test(child.name) && out.length < 60) {
      const file = await new Promise<File>((resolve, reject) => (child as FileSystemFileEntry).file(resolve, reject));
      out.push({ path, text: await file.text() });
    }
  }
  return { out, seen };
}

export async function folderToNotesFile(entry: FileSystemDirectoryEntry): Promise<File> {
  const { out, seen } = await readFolder(entry);
  if (!out.length) throw new ZipError("That folder has no notes in it. Drop a folder of .md notes, like an Obsidian vault.");
  return asNotesFile(notesFromTexts(out, sourceOfPaths(seen)), entry.name);
}
