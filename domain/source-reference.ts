import type { LearningActivity, LearningSourceReference } from "./types";

export type EvidenceSourceResolution =
  | { kind: "source"; reference: LearningSourceReference; basis: "question" | "only-source" }
  | { kind: "ambiguous"; reference: null; options: LearningSourceReference[] }
  | { kind: "missing"; reference: null; options: [] };

/** Never infer a question's source from the first file in a course. */
export function resolveEvidenceSource(
  questionSource: LearningSourceReference | null | undefined,
  courseSources: LearningSourceReference[],
): EvidenceSourceResolution {
  if (questionSource) return { kind: "source", reference: questionSource, basis: "question" };
  if (courseSources.length === 1) return { kind: "source", reference: courseSources[0], basis: "only-source" };
  if (courseSources.length > 1) return { kind: "ambiguous", reference: null, options: courseSources };
  return { kind: "missing", reference: null, options: [] };
}

/** The source behind the main retrieval answer, or null when older data is ambiguous. */
export function primaryActivitySourceReference(
  activity: Pick<LearningActivity, "retrieve" | "sourceReferences"> | null | undefined,
) {
  if (!activity) return null;
  return resolveEvidenceSource(activity.retrieve?.sourceReference, activity.sourceReferences).reference;
}
