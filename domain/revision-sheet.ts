import { explainMatch } from "./answer-evaluation";
import type { MissedLine } from "./return-visit";
import type { Concept, LearningActivity, LearningEvent } from "./types";

export type SheetEntry = {
  id: string;
  name: string;
  /** The student's own latest explanation of the topic, as they wrote it. Null until they have explained it. */
  words: string | null;
  wordsAt: string | null;
  /** The line from their notes the explanation was compared with. */
  notes: string;
  /** Key words of that line their explanation left out, at most three. */
  leftOut: string[];
  /** A word they turned around: what they wrote, and what the notes say. */
  flipped: { said: string; page: string } | null;
  /** Lines of this topic they missed and that come back first. */
  comingBack: string[];
};

export type RevisionSheet = { entries: SheetEntry[]; written: number; total: number; comingBack: number };

/** The explanation part of a saved answer: everything before the "Application:" a run appends. */
export function ownWords(responseText: string | null | undefined) {
  const words = (responseText ?? "").split(/\n\nApplication:/)[0].trim();
  // A shrug is not an explanation: fewer than three words, or nothing but "I don't remember".
  if (words.split(/\s+/).filter(Boolean).length < 3 || /^i\s*(?:do not|don['’]t)\s*(?:remember|know)\b/i.test(words)) return null;
  return words;
}

/**
 * The sheet a student wrote: every topic in the order of their notes, with their own latest explanation, the line it
 * was checked against, the key words it left out, and the lines that still come back. Nothing here is written by
 * Kelus; it only lays the student's words beside their notes.
 */
export function revisionSheet(input: { concepts: Concept[]; activities: LearningActivity[]; events: LearningEvent[]; missed: MissedLine[] }): RevisionSheet {
  const entries = input.concepts.map((concept) => {
    const activity = input.activities.find((item) => item.conceptId === concept.id);
    const notes = activity?.retrieve.modelAnswer ?? "";
    const latest = input.events
      .filter((event) => event.conceptId === concept.id && event.kind === "retrieval" && !event.promptId?.startsWith("checkpoint-") && ownWords(event.responseText))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
    const words = latest ? ownWords(latest.responseText) : null;
    const match = words && notes ? explainMatch(words, notes, concept.name) : null;
    // A missed line that is the very line shown under "Your notes" is already on the sheet: no second copy.
    const comingBack = [...new Set(input.missed.filter((line) => line.conceptId === concept.id).map((line) => line.quote.trim()))].filter((line) => line !== notes.trim()).slice(0, 3);
    return {
      id: concept.id,
      name: concept.name,
      words,
      wordsAt: latest?.createdAt ?? null,
      notes,
      leftOut: match && match.keys >= 3 ? match.missed.slice(0, 3) : [],
      flipped: match?.flipped[0] ? { said: match.flipped[0].said, page: match.flipped[0].page } : null,
      comingBack,
    };
  });
  return {
    entries,
    written: entries.filter((entry) => entry.words).length,
    total: entries.length,
    comingBack: entries.reduce((sum, entry) => sum + entry.comingBack.length, 0),
  };
}
