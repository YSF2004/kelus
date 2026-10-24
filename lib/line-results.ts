/**
 * One answer's lines, saved the moment it is given rather than when the topic ends: a right answer adds each line to
 * the lines you can recall (one box right on a new day); a miss sends it back to be asked first next time. The same
 * stores the end of a topic writes to, so finishing later changes nothing that was already saved.
 */

import { addKnownLines, forgetKnownLines } from "@/lib/known-lines";
import { addMissedLines, resolveMissedLines } from "@/lib/missed-lines";

export function saveLineResult(input: { conceptId: string; name: string; quotes: string[]; result: "right" | "missed"; at: string }) {
  const quotes = input.quotes.map((quote) => quote.trim()).filter(Boolean);
  if (!quotes.length) return;
  const lines = quotes.map((quote) => ({ conceptId: input.conceptId, name: input.name, quote, at: input.at }));
  if (input.result === "right") {
    addKnownLines(lines);
    resolveMissedLines(quotes);
    return;
  }
  addMissedLines(lines);
  forgetKnownLines(quotes);
}
