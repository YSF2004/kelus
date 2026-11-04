import type { Concept, ConceptRelationship, LearningEvent, RetrievalOutcome, RouteAllocation } from "@/domain/types";

/** Plain-language evidence for a route choice, without claiming a predicted grade. */
export type RouteEvidence = {
  /** Retrieval events for this topic, any order. */
  events?: LearningEvent[];
  /** Topics that list this one as a prerequisite, by name. */
  dependents?: string[];
  nowIso?: string;
};

const LAST_RESULT: Record<RetrievalOutcome, string> = {
  failure: "it needed another attempt",
  partial: "it came out partly right",
  success: "you knew it",
};

/** "today", "yesterday", "3 days ago": how long since an answer, counted in calendar days. */
export function daysAgo(thenIso: string, nowIso: string) {
  const day = (iso: string) => Math.floor((Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60_000) / 86_400_000);
  const days = Math.max(0, day(nowIso) - day(thenIso));
  return days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

/**
 * The student's own evidence for a topic, in one sentence: what the last answer showed and when.
 * Returns null when there is nothing of theirs to quote.
 */
export function lastEvidenceLine(concept: Concept, evidence: RouteEvidence): string | null {
  const answers = (evidence.events ?? [])
    .filter((event) => event.conceptId === concept.id && event.kind === "retrieval" && event.outcome)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const last = answers[0];
  if (!last?.outcome || !evidence.nowIso) return null;
  const when = daysAgo(last.createdAt, evidence.nowIso);
  const head = when === "today" ? "Earlier today" : `Last time, ${when}`;
  const tail = last.outcome === "success" ? ", so this checks it stays" : "";
  // A checkpoint is named as one: "you knew it" reads oddly for a mixed review you just passed.
  if (last.promptId?.startsWith("checkpoint-")) {
    return `${head}, ${last.outcome === "success" ? "every line came back in a checkpoint" : last.outcome === "partial" ? "some lines came back in a checkpoint" : "its lines didn’t come back in a checkpoint"}${tail}.`;
  }
  const record = answers.length > 1 ? ` (${answers.filter((event) => event.outcome === "success").length} of ${answers.length} tries went well)` : "";
  return `${head}, ${LAST_RESULT[last.outcome]}${record}${tail}.`;
}

export function describeRouteChoice(allocation: RouteAllocation, concept?: Concept, options: { examDateKnown?: boolean } & RouteEvidence = {}): string[] {
  if (!concept) return ["A short mixed-recall block: a few topics at once, from memory."];

  const reasons = new Set(allocation.reasons);
  // Without a real exam date, "the exam is close" would be invented: the countdown runs from a placeholder.
  if (options.examDateKnown === false) reasons.delete("EXAM_APPROACHING");
  const lines: string[] = [];

  const own = concept.retrievalAttempts > 0 ? lastEvidenceLine(concept, options) : null;
  if (concept.retrievalAttempts === 0) {
    lines.push("Next in your notes, and new to you.");
  } else if (own) {
    lines.push(own);
  } else if (reasons.has("LOW_MASTERY")) {
    lines.push("Your last answers here were shaky.");
  } else if (reasons.has("REVIEW_DUE") || reasons.has("RETENTION_FADING")) {
    lines.push("Time to check you still remember it.");
  } else if (reasons.has("LOW_CONFIDENCE_ESTIMATE")) {
    lines.push("A few more answers will show where you stand.");
  }

  const dependents = options.dependents?.filter(Boolean) ?? [];
  if (reasons.has("PREREQUISITE_GAP") && dependents.length) {
    lines.push(dependents.length === 1 ? `${dependents[0]} builds on it.` : `${dependents[0]} and ${dependents.length - 1 === 1 ? dependents[1] : `${dependents.length - 1} more topics`} build on it.`);
  } else if (reasons.has("PREREQUISITE_GAP")) {
    lines.push("It helps with the topics that build on it.");
  } else if (reasons.has("EXAM_APPROACHING")) {
    lines.push("Your exam is close.");
  }

  return lines.length ? lines.slice(0, 2) : ["Next in your plan."];
}

/** A student-facing payoff for the next focused block, without promising grades. */
export function describeRoutePayoff(
  allocation: RouteAllocation,
  nextTopic?: string,
): string {
  const reasons = new Set(allocation.reasons);
  if (reasons.has("PREREQUISITE_GAP") && nextTopic) {
    return `A focused pass here should make ${nextTopic} easier to retrieve next.`;
  }
  if (reasons.has("REVIEW_DUE") || reasons.has("RETENTION_FADING")) {
    return "A short recall now helps keep this idea available before it fades.";
  }
  if (reasons.has("LOW_MASTERY") || reasons.has("LOW_CONFIDENCE_ESTIMATE")) {
    return "One focused pass can turn an uncertain answer into a clearer next decision.";
  }
  return "This block gives Kelus better evidence about what you can use from memory.";
}

/** Names of the topics that list `conceptId` as a prerequisite, in course order. */
export function dependentNames(conceptId: string, relationships: ConceptRelationship[], concepts: Concept[]) {
  return relationships
    .filter((link) => link.kind === "prerequisite" && link.fromId === conceptId)
    .map((link) => concepts.find((item) => item.id === link.toId)?.name)
    .filter((name): name is string => Boolean(name));
}
