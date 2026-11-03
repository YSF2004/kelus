/**
 * The lines from your notes you have answered right and not missed since: what "lines you can recall" counts.
 * They live in the learner state, so they sync with an account. A miss takes a line off; a right answer puts it back.
 */

import type { MissedLine } from "@/domain/return-visit";
import { getDemoSnapshot, subscribeDemoState, updateKnownLines } from "@/lib/demo-store";
import { recordLineAnswers } from "@/lib/line-history";

const EMPTY: MissedLine[] = [];

export function getKnownLines() {
  if (typeof window === "undefined") return EMPTY;
  return getDemoSnapshot().knownLines ?? EMPTY;
}

export function getServerKnownLines() {
  return EMPTY;
}

export function subscribeKnownLines(onChange: () => void) {
  return subscribeDemoState(onChange);
}

/** Right answers: each line once, at its newest time. A right answer on a later day than the last one adds to the
 * line's streak (it moves one Leitner box right); a second right answer the same day does not. */
export function addKnownLines(lines: MissedLine[]) {
  if (!lines.length) return;
  const quotes = new Set(lines.map((line) => line.quote));
  recordLineAnswers([...quotes], true, lines[0].at);
  updateKnownLines((current) => {
    const before = new Map(current.map((line) => [line.quote, line]));
    const next = lines.map((line) => ({ ...line, streak: nextStreak(before.get(line.quote), line.at) }));
    return [...current.filter((line) => !quotes.has(line.quote)), ...next];
  });
}

export function nextStreak(previous: MissedLine | undefined, at: string) {
  if (!previous) return 1;
  const streak = previous.streak ?? 1;
  return previous.at.slice(0, 10) === at.slice(0, 10) ? streak : streak + 1;
}

/** Misses: a line you could not recall today is not one you can recall. */
export function forgetKnownLines(quotes: string[]) {
  if (!quotes.length) return;
  const gone = new Set(quotes);
  updateKnownLines((current) => current.filter((line) => !gone.has(line.quote)));
}

/** How many lines of these topics you can recall right now. */
export function knownCount(lines: MissedLine[], conceptIds: Set<string>) {
  return new Set(lines.filter((line) => conceptIds.has(line.conceptId)).map((line) => line.quote)).size;
}
