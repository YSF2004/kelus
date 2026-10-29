import { noteLanguage } from "./note-language";
import type { ExtractedMaterialPage } from "./types";

/**
 * Turns Markdown (or plain text with # headings) into the same "pages" a PDF produces, so the topic finder,
 * content engine and source viewer need no special case. A section is one page; headings keep a larger size
 * so they are recognised as headings; lists, steps, tables and links are flattened to plain lines.
 */

export const MAX_NOTES_BYTES = 2_000_000;
const MAX_SECTIONS = 40;
const MAX_CHARS = 200_000;
const BODY_SIZE = 12;
const HEADING_SIZE: Record<number, number> = { 1: 22, 2: 20, 3: 17, 4: 15, 5: 14, 6: 14 };

type Line = { kind: "heading"; level: number; text: string } | { kind: "body"; text: string; highlights?: string[] };

/** The phrases a student marked with Obsidian's ==highlight==, as plain text. */
function highlightsIn(value: string) {
  return [...value.matchAll(/==(?=\S)(.+?)(?<=\S)==/g)].map((match) => plainInline(match[1])).filter((text) => text.length >= 3);
}

/** Removes Markdown markup but keeps the words. Obsidian's own syntax too: embeds, note links with a heading or
 * block ("[[Osmosis#Tonicity]]" reads "Osmosis"), ==highlights==, inline #tags and ^block-ids. */
export function plainInline(value: string) {
  return value
    .replace(/!\[\[[^\]]*\]\]/g, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_m, target: string, label?: string) => label ?? (target.replace(/#.*$/, "").trim() || target.replace(/^#\^?/, "").trim()))
    .replace(/==(?=\S)(.+?)(?<=\S)==/g, "$1")
    .replace(/(^|\s)#(?=[\p{L}_])[\p{L}\p{N}_/-]+/gu, "$1")
    .replace(/\s\^[A-Za-z0-9-]+\s*$/, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>\n]+>/g, "")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_(?!\s)(.+?)(?<!\s)_(?![\w_])/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\\([\\`*_{}[\]()#+\-.!|>])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const SEPARATOR_ROW = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function tableCells(line: string) {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((cell) => plainInline(cell)).filter(Boolean);
}

export function parseMarkdownLines(markdown: string): Line[] {
  const source = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/^﻿/, "")
    .replace(/^---\n[\s\S]*?\n---\n/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    // Obsidian comments, inline or across lines: %%like this%%.
    .replace(/%%[\s\S]*?%%/g, "")
    .slice(0, MAX_CHARS);
  const raw = source.split("\n");
  const out: Line[] = [];
  let paragraph: string[] = [];
  let inFence = false;

  const flush = () => {
    const joined = paragraph.join(" ");
    const text = plainInline(joined);
    const highlights = highlightsIn(joined);
    if (text) out.push(highlights.length ? { kind: "body", text, highlights } : { kind: "body", text });
    paragraph = [];
  };

  for (let index = 0; index < raw.length; index += 1) {
    const line = raw[index];
    if (/^\s*(```|~~~)/.test(line)) { flush(); inFence = !inFence; continue; }
    if (inFence) {
      const code = line.trim();
      if (code) out.push({ kind: "body", text: code });
      continue;
    }
    if (!line.trim()) { flush(); continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); continue; }
    // Notion toggles use a disclosure label as chrome, not part of the lesson sentence beneath it.
    if (/^\s*<summary(?:\s[^>]*)?>.*<\/summary>\s*$/i.test(line)) { flush(); continue; }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flush();
      const text = plainInline(heading[2]);
      if (text) out.push({ kind: "heading", level: heading[1].length, text });
      continue;
    }

    // A table: skip the header row (it is followed by a separator) and flatten the rest to "A: B".
    if (line.includes("|") && raw[index + 1] && SEPARATOR_ROW.test(raw[index + 1]) && !SEPARATOR_ROW.test(line)) { flush(); continue; }
    if (SEPARATOR_ROW.test(line) && line.includes("-") && line.includes("|")) { flush(); continue; }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      flush();
      const cells = tableCells(line);
      if (cells.length === 2) out.push({ kind: "body", text: `${cells[0]}: ${cells[1]}` });
      else if (cells.length > 2) out.push({ kind: "body", text: `${cells[0]}: ${cells.slice(1).join(" · ")}` });
      continue;
    }

    // An Obsidian callout ("> [!note] Tonicity") keeps its title as a line of its own and drops the marker.
    const callout = line.match(/^\s{0,3}>\s?\s*\[![\w-]+\][+-]?\s*(.*)$/);
    if (callout) {
      flush();
      const title = plainInline(callout[1]);
      if (title) out.push({ kind: "body", text: title });
      continue;
    }
    const quote = line.replace(/^\s{0,3}>\s?/, "");
    const item = quote.match(/^\s*(?:([-*+•])|(\d{1,2})[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/);
    if (item) {
      flush();
      const text = plainInline(item[3]);
      const highlights = highlightsIn(item[3]);
      if (text) out.push({ kind: "body", text: item[2] ? `${Number(item[2])}. ${text}` : `• ${text}`, ...(highlights.length ? { highlights } : {}) });
      continue;
    }
    paragraph.push(quote.trim());
  }
  flush();
  return out;
}

/** The shallowest heading level used at least twice, else the shallowest used at all. */
function splitLevel(lines: Line[]) {
  const counts = new Map<number, number>();
  for (const line of lines) if (line.kind === "heading") counts.set(line.level, (counts.get(line.level) ?? 0) + 1);
  const levels = [...counts.keys()].sort((a, b) => a - b);
  return levels.find((level) => (counts.get(level) ?? 0) >= 2) ?? levels[0] ?? null;
}

export function markdownToPages(markdown: string): ExtractedMaterialPage[] {
  const lines = parseMarkdownLines(markdown);
  const level = splitLevel(lines);
  if (level === null) return [];

  const sections: Line[][] = [];
  let current: Line[] = [];
  for (const line of lines) {
    if (line.kind === "heading" && line.level <= level && current.some((entry) => entry.kind === "body" || entry.kind === "heading")) {
      sections.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) sections.push(current);

  // A title with a properties block ("Created: ...", "Tags: ...") is not a study topic. Drop an opening section
  // that is only a document title above the split level and has little text of its own.
  const first = sections[0];
  if (first && first[0]?.kind === "heading" && first[0].level < level) {
    const body = first.filter((entry) => entry.kind === "body").map((entry) => entry.text).join(" ");
    if (body.length < 300) sections.shift();
  }
  // Pasting notes removes the standalone course title before parsing. A short Notion properties block left above
  // the first real heading is still document furniture, not a page to study or a topic to name the course from.
  const preamble = sections[0];
  if (sections.length > 1 && preamble?.every((entry) => entry.kind === "body")) {
    const body = preamble.map((entry) => entry.text).join(" ");
    if (body.length < 300 && preamble.some((entry) => /^(?:created|updated|tags|author|status):\s/i.test(entry.text))) sections.shift();
  }

  return sections.slice(0, MAX_SECTIONS).map((section, index) => {
    let text = "";
    const blocks: NonNullable<ExtractedMaterialPage["blocks"]> = [];
    section.forEach((line, position) => {
      const size = line.kind === "heading" ? (HEADING_SIZE[line.level] ?? 14) : BODY_SIZE;
      const previous = section[position - 1];
      if (position > 0) text += line.kind === "heading" || previous?.kind === "heading" ? "\n\n" : "\n";
      text += line.text;
      blocks.push({ text: line.text, x: 40, y: 760 - position * 20, width: line.text.length * 6, height: size, fontSize: size });
    });
    const highlights = section.flatMap((line) => (line.kind === "body" ? line.highlights ?? [] : []));
    return { pageNumber: index + 1, text: text.trim(), blocks, ...(highlights.length ? { highlights } : {}) };
  });
}

export function looksLikeMarkdownHeadings(markdown: string) {
  return /^\s{0,3}#{1,6}\s+\S/m.test(markdown);
}

/**
 * Pasted text without headings still has a shape: a short line standing alone above a paragraph is a title.
 * Those become "# Title" so the usual import finds the topics. With no such lines the whole paste is one topic,
 * named from its first words, so nobody is sent back to add "#" by hand.
 */
function titleCase(value: string, french = false) {
  // French headings are not title-cased: "La photosynthèse" stays as written, never "La Photosynthèse".
  if (french) return value.replace(/^\p{Ll}/u, (letter) => letter.toLocaleUpperCase());
  return value.replace(/\p{L}[\p{L}'’/&-]*/gu, (word, offset) => (offset > 0 && /^(?:a|an|and|of|the|to|in|on|for|or|vs)$/i.test(word) ? word.toLowerCase() : word[0].toUpperCase() + word.slice(1)));
}

export function structurePastedText(raw: string) {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const french = noteLanguage(text) === "fr";
  if (looksLikeMarkdownHeadings(text)) return text;
  const lines = text.split("\n");
  const isTitle = (line: string, next: string | undefined) => {
    const trimmed = line.trim().replace(/:$/, "");
    return trimmed.length >= 3 && trimmed.length <= 60 && !/[.!?;,]$/.test(trimmed) && trimmed.split(/\s+/).length <= 8 && Boolean(next?.trim());
  };
  let titles = 0;
  const out = lines.map((line, index) => {
    const alone = index === 0 || !lines[index - 1].trim();
    if (alone && isTitle(line, lines[index + 1]) && !/^[•\-*\d]/.test(line.trim())) { titles += 1; return `# ${titleCase(line.trim().replace(/:$/, ""), french)}`; }
    return line;
  });
  if (titles > 0) return out.join("\n");
  const first = text.replace(/^[•\-*\s]+/, "").split(/\s+/).slice(0, 4).join(" ").replace(/[^\p{L}\p{N}]+$/u, "");
  return `# ${titleCase(first, french) || "My Notes"}\n${text}`;
}

/**
 * A title at the top of pasted notes ("Cell biology", or "# Cell biology" above the topics) names the course.
 * Only a short line standing alone counts: one with its own text beneath it is a topic, not a title.
 */
export function pastedTitle(raw: string) {
  const lines = raw.replace(/\r\n?/g, "\n").split("\n");
  const at = lines.findIndex((line) => line.trim());
  if (at < 0) return null;
  const first = lines[at].trim().replace(/^#\s+/, "").replace(/:$/, "");
  const next = lines.slice(at + 1).find((line) => line.trim()) ?? "";
  const standsAlone = !lines[at + 1]?.trim() || /^#{1,6}\s/.test(next.trim()) && /^#\s/.test(lines[at].trim()) && !/^#\s/.test(next.trim());
  const looksLikeTitle = first.length >= 3 && first.length <= 60 && first.split(/\s+/).length <= 6 && !/[.!?;,]$/.test(first) && !/^#{2,}/.test(lines[at].trim());
  return standsAlone && looksLikeTitle && next ? first : null;
}
