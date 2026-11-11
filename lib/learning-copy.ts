import type { Concept, ConceptRelationship, LearningReasonCode, RoutePlan } from "@/domain/types";

export const REASON_COPY: Record<LearningReasonCode, string> = {
  HIGH_EXAM_VALUE: "Very important for your exam",
  LOW_MASTERY: "Your current estimate is still developing",
  RETENTION_FADING: "Recall is fading",
  PREREQUISITE_GAP: "Unlocks connected exam topics",
  EXAM_APPROACHING: "Your exam is approaching",
  HIGH_EXPECTED_GAIN: "Strong expected return on study time",
  REVIEW_DUE: "Review is due",
  LOW_CONFIDENCE_ESTIMATE: "Kelus needs stronger evidence here",
};

export function conciseReason(reasons: LearningReasonCode[]) {
  return reasons.slice(0, 2).map((reason) => REASON_COPY[reason]).join(" · ");
}

export function explainRouteLead(route: RoutePlan, concepts: Concept[], relationships: ConceptRelationship[]) {
  const [first, second] = route.allocations.filter((allocation) => allocation.conceptId !== "mixed-retrieval");
  const lead = concepts.find((concept) => concept.id === first?.conceptId);
  const runnerUp = concepts.find((concept) => concept.id === second?.conceptId);
  if (!lead) return null;

  const evidence: string[] = [];
  if (runnerUp && lead.mastery + 0.08 <= runnerUp.mastery) {
    evidence.push(`Current demonstrated mastery is ${Math.round(lead.mastery * 100)}%, compared with ${Math.round(runnerUp.mastery * 100)}% for ${runnerUp.name}.`);
  }
  const leadDependents = relationships.filter((item) => item.kind === "prerequisite" && item.fromId === lead.id).length;
  const runnerUpDependents = runnerUp
    ? relationships.filter((item) => item.kind === "prerequisite" && item.fromId === runnerUp.id).length
    : 0;
  if (leadDependents > runnerUpDependents) {
    evidence.push(`It is a confirmed prerequisite for ${leadDependents} later concept${leadDependents === 1 ? "" : "s"}.`);
  }
  if (runnerUp && lead.predictedRetention + 0.1 <= runnerUp.predictedRetention) {
    evidence.push(`Its recall estimate is fading faster than ${runnerUp.name}.`);
  }
  if (lead.confidence < 0.45) {
    evidence.push("Evidence is still limited, so this position is provisional and will update after your answer.");
  }
  if (!evidence.length) {
    evidence.push("It has the highest current learning value after mastery, retention, prerequisites, exam timing, and time cost are combined.");
  }

  return {
    title: runnerUp ? `Why before ${runnerUp.name}?` : "Why first?",
    evidence: evidence.slice(0, 2),
  };
}
