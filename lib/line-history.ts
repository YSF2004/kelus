/**
 * Every answer a line has had, newest last: right or missed, and when. The learner state keeps only where a line
 * stands now (its last recall and its run of right answers); this keeps the way it got there, so a line's sheet on
 * Progress can show it. It stays on this device, in this browser, and is capped so it never grows without end.
 */

export type LineAnswer = { quote: string; at: string; right: boolean };

const KEY = "kelus-line-history-v1";
const EVENT = "kelus-line-history";
const PER_LINE = 12;
const TOTAL = 800;
const EMPTY: LineAnswer[] = [];
let cache: { raw: string | null; value: LineAnswer[] } = { raw: null, value: EMPTY };

export function getLineHistory(): LineAnswer[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cache.raw) return cache.value;
    const parsed = raw ? JSON.parse(raw) : [];
    const value = Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry.quote === "string" && typeof entry.at === "string" && typeof entry.right === "boolean") : EMPTY;
    cache = { raw, value };
    return value;
  } catch {
    return EMPTY;
  }
}

export const getServerLineHistory = () => EMPTY;

export function subscribeLineHistory(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

/** Adds one answer for each line; a line keeps its newest answers only, and the whole list its newest overall. */
export function recordLineAnswers(quotes: string[], right: boolean, at: string) {
  if (typeof window === "undefined" || !quotes.length) return;
  const next = [...getLineHistory(), ...quotes.map((quote) => ({ quote, at, right }))];
  const counts = new Map<string, number>();
  const kept: LineAnswer[] = [];
  for (let index = next.length - 1; index >= 0 && kept.length < TOTAL; index -= 1) {
    const seen = counts.get(next[index].quote) ?? 0;
    if (seen >= PER_LINE) continue;
    counts.set(next[index].quote, seen + 1);
    kept.push(next[index]);
  }
  try { window.localStorage.setItem(KEY, JSON.stringify(kept.reverse())); } catch { /* Without storage the sheet shows the line's current state only. */ }
  window.dispatchEvent(new Event(EVENT));
}
