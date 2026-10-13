import type { RetrievalOutcome } from "@/domain/types";
import type { SelfGrade } from "@/domain/quick-run";

export type QuickStats = { right: number; total: number; unsure: number; self: SelfGrade; coverage?: { hits: number; keys: number } | null };

const LINE: Record<RetrievalOutcome, string> = {
  success: "You knew it and you could say it.",
  partial: "Some of it is solid. One more look will fix the rest.",
  failure: "That is what practice is for. Now you know what to read again.",
};

/**
 * Why this verdict, in one sentence, from what was shown: the checks right and the key ideas the explanation used.
 * The self-rating is mentioned only when it lowered the result, because it never raises it.
 */
export function verdictReason(outcome: RetrievalOutcome, stats: QuickStats | null) {
  if (!stats) return LINE[outcome];
  const shown: string[] = [];
  if (stats.total > 0) shown.push(`${stats.right} of ${stats.total} check${stats.total === 1 ? "" : "s"} right`);
  if (stats.coverage && stats.coverage.keys >= 3) shown.push(`${stats.coverage.hits} of ${stats.coverage.keys} key ideas in your explanation`);
  const evidence = shown.length ? shown.join(" and ") : "not enough in your answer to measure yet";
  const lowered = stats.self === "missed" ? ", and you said you missed it" : "";
  if (outcome === "success") return `${capital(evidence)}. It comes back in a few days to keep it.`;
  if (outcome === "partial") return `${capital(evidence)}${lowered}. It comes back soon to firm up.`;
  return `${capital(evidence)}${lowered}, so it comes back tomorrow.`;
}

function capital(text: string) { return text.charAt(0).toUpperCase() + text.slice(1); }

/** Where the plan goes after a topic, naming the topic an answer pulled forward. */
export function planLine({ next, movedUp, orderChanged }: { next?: string; movedUp?: string; orderChanged: boolean }) {
  if (!next) return "That was the last topic for now.";
  if (movedUp && movedUp === next) return `Your answer moved ${next} up, so it is next.`;
  if (movedUp) return `Your answer moved ${movedUp} up in your plan. Next: ${next}.`;
  if (orderChanged) return `Your plan changed around this answer. Next: ${next}.`;
  return `Next: ${next}.`;
}
