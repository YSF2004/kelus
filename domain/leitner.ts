import { recallMap } from "./recall-map";
import type { MissedLine } from "./return-visit";
import type { Concept, LearningActivity } from "./types";

/**
 * The Leitner box: every line Kelus can ask from your notes sits in one of five boxes. New and missed lines are in
 * Box 1, asked every day; each correct recall on a new day moves a line one box right, to longer and longer gaps;
 * a miss sends it back to Box 1. Nothing is estimated: a line's box is its run of right answers.
 */
export const BOXES = [
  { box: 1, every: "Every day" },
  { box: 2, every: "Every 2 days" },
  { box: 3, every: "Every 4 days" },
  { box: 4, every: "Every 9 days" },
  { box: 5, every: "Monthly" },
] as const;

export type LeitnerLine = {
  quote: string;
  conceptId: string;
  topic: string;
  box: 1 | 2 | 3 | 4 | 5;
  state: "new" | "missed" | "recalled";
  /** Recalled today: it moved one box right today, so it is shown arriving from the box before. */
  movedToday: boolean;
};
export type LeitnerState = { lines: LeitnerLine[]; byBox: LeitnerLine[][]; total: number; recalled: number; movedThisWeek: number };

const key = (quote: string) => quote.trim().toLocaleLowerCase();

export function leitner(input: { concepts: Concept[]; activities: LearningActivity[]; known: MissedLine[]; missed: MissedLine[]; nowIso: string }): LeitnerState {
  const map = recallMap(input);
  const known = new Map(input.known.map((line) => [key(line.quote), line]));
  const weekAgo = Date.parse(input.nowIso) - 7 * 86_400_000;
  const lines: LeitnerLine[] = map.topics.flatMap((topic) => topic.lines.map((line) => {
    const hit = known.get(key(line.quote));
    const box = line.state === "recalled" ? (Math.min(5, 1 + (hit?.streak ?? 1)) as LeitnerLine["box"]) : 1;
    const movedToday = line.state === "recalled" && box > 1 && Boolean(hit) && hit!.at.slice(0, 10) === input.nowIso.slice(0, 10);
    return { quote: line.quote, conceptId: topic.id, topic: topic.name, box, state: line.state === "recalled" ? "recalled" : line.state === "back" ? "missed" : "new", movedToday };
  }));
  const byBox = BOXES.map(({ box }) => lines.filter((line) => line.box === box));
  const movedThisWeek = input.known.filter((line) => Date.parse(line.at) >= weekAgo).length;
  return { lines, byBox, total: lines.length, recalled: lines.filter((line) => line.state === "recalled").length, movedThisWeek };
}
