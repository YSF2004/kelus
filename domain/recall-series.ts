import type { MissedLine } from "./return-visit";

export type RecallPoint = { day: string; recalled: number };

const dayOf = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const key = (quote: string) => quote.trim().toLocaleLowerCase();

/**
 * Lines you could recall at the end of each day, from the first answer to today: a line counts once its latest
 * answer that day or before was right, and stops counting when it is missed. Built from every answer kept on this
 * device; where that history is missing (answers from before it was kept), the lines recalled now count from the day
 * of their last recall, so the line still ends at today's true number. Only lines of this course count.
 */
export function recallSeries(input: { history: Array<{ quote: string; at: string; right: boolean }>; known: MissedLine[]; lines: string[]; nowIso: string }): RecallPoint[] {
  const inCourse = new Set(input.lines.map(key));
  const answers = input.history.filter((entry) => inCourse.has(key(entry.quote)) && Number.isFinite(Date.parse(entry.at)));
  const known = input.known.filter((line) => inCourse.has(key(line.quote)) && Number.isFinite(Date.parse(line.at)));
  const days = [...answers.map((entry) => entry.at), ...known.map((line) => line.at)].map(dayOf);
  if (!days.length) return [];
  const today = dayOf(input.nowIso);
  const first = days.sort()[0];
  const series: RecallPoint[] = [];
  const end = new Date(`${today}T12:00:00`);
  // At most the last 120 days, so a long course still draws one readable line.
  const start = new Date(Math.max(new Date(`${first}T12:00:00`).getTime(), end.getTime() - 119 * 86_400_000));
  const remembered = new Set(answers.map((entry) => key(entry.quote)));
  for (let at = start; at <= end; at = new Date(at.getTime() + 86_400_000)) {
    const day = dayOf(at.toISOString());
    const state = new Map<string, boolean>();
    for (const entry of answers) if (dayOf(entry.at) <= day) state.set(key(entry.quote), entry.right);
    // Lines recalled before the history began: counted from their last recall.
    for (const line of known) if (!remembered.has(key(line.quote)) && dayOf(line.at) <= day) state.set(key(line.quote), true);
    series.push({ day, recalled: [...state.values()].filter(Boolean).length });
  }
  // The last point is the truth on screen elsewhere: the lines recalled now.
  if (series.length) series[series.length - 1] = { day: today, recalled: new Set(known.map((line) => key(line.quote))).size };
  return series;
}
