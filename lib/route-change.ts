import type { LearningReasonCode } from "@/domain/types";

/** The planner's own reason codes, said as the end of a sentence about one topic. */
const WHY: Record<LearningReasonCode, string> = {
  PREREQUISITE_GAP: "your answer showed a gap in something it builds on",
  LOW_MASTERY: "its answers so far are the weakest",
  RETENTION_FADING: "it is starting to fade",
  REVIEW_DUE: "it is due for review",
  EXAM_APPROACHING: "your exam is close",
  HIGH_EXAM_VALUE: "it carries the most weight for the exam",
  HIGH_EXPECTED_GAIN: "it now gains you the most",
  LOW_CONFIDENCE_ESTIMATE: "Kelus has the least evidence on it",
};

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;

export type RouteChange = { before: string[]; after: string[]; moved: string; from: number; to: number; text: string };

/**
 * What an answer did to the rest of the session, from the plan before it and the plan after it: the order of the
 * topics still to come, the one that moved up, and why, in the planner's own reasons. Null when the order did not
 * change, so nothing is animated that did not happen.
 */
export function routeChange(input: { before: string[]; after: string[]; names: Map<string, string>; reasons: Map<string, LearningReasonCode[]> }): RouteChange | null {
  const before = input.before.filter((id) => input.after.includes(id));
  const after = input.after.filter((id) => before.includes(id));
  if (before.length < 2 || before.join("|") === after.join("|")) return null;
  const movedId = after.find((id) => after.indexOf(id) < before.indexOf(id));
  if (!movedId) return null;
  const from = before.indexOf(movedId) + 1;
  const to = after.indexOf(movedId) + 1;
  const name = input.names.get(movedId) ?? "A topic";
  const why = (input.reasons.get(movedId) ?? []).map((code) => WHY[code]).find(Boolean);
  const text = `${name} moved from ${ordinal(from)} to ${ordinal(to)}${why ? ` because ${why}` : " after your answer"}.`;
  return { before: before.map((id) => input.names.get(id) ?? id), after: after.map((id) => input.names.get(id) ?? id), moved: name, from, to, text };
}
