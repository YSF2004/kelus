import type { MissedLine } from "@/domain/return-visit";

/**
 * What Study says about a topic already answered today, from the lines saved answer by answer: how many were right,
 * how many missed, and what that does to the plan. Null when nothing was answered on it today.
 */
export function attemptedToday(input: { conceptId: string; name: string; known: MissedLine[]; missed: MissedLine[]; nowIso: string; open: boolean }) {
  const today = input.nowIso.slice(0, 10);
  const mine = (line: MissedLine) => line.conceptId === input.conceptId && line.at.slice(0, 10) === today;
  const right = new Set(input.known.filter(mine).map((line) => line.quote)).size;
  const missed = new Set(input.missed.filter(mine).map((line) => line.quote)).size;
  if (!right && !missed) return null;
  const counts = [right ? `${right} ${right === 1 ? "line" : "lines"} right` : "", missed ? (right ? `${missed} missed` : `${missed} ${missed === 1 ? "line" : "lines"} missed`) : ""].filter(Boolean).join(", ");
  const started = input.open ? `You started ${input.name} today: ${counts}.` : `You answered ${input.name} today: ${counts}.`;
  if (missed) return `${started} ${missed === 1 ? "The missed line stays" : "The missed lines stay"} in Box 1 and ${missed === 1 ? "comes" : "come"} back first, so ${input.name} stays first.`;
  return `${started} ${input.open ? "Finish it to complete the topic." : ""}`.trim();
}
