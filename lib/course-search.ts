import type { Concept, LearningActivity, LearningSourceReference } from "@/domain/types";

export type CourseSearchResult = {
  conceptId: string;
  conceptName: string;
  answer: string;
  source: LearningSourceReference | null;
};
type RankedCourseSearchResult = CourseSearchResult & { score: number };

const IGNORED = new Set(["a", "an", "and", "are", "at", "by", "do", "does", "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "to", "what", "when", "where", "which", "why", "with"]);

function words(value: string) {
  return [...new Set(value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 1 && !IGNORED.has(word)) ?? [])];
}

/** Finds only passages already retained from the student's confirmed course material. */
export function searchCourse(query: string, concepts: Concept[], activities: LearningActivity[]): CourseSearchResult[] {
  const queryWords = words(query);
  if (!queryWords.length) return [];
  const activityByConcept = new Map(activities.map((activity) => [activity.conceptId, activity]));

  return concepts
    .map<RankedCourseSearchResult | null>((concept) => {
      const activity = activityByConcept.get(concept.id);
      if (!activity) return null;
      const answer = activity.teach?.facts.find((fact) => fact.trim().length > 24)
        ?? activity.retrieve.modelAnswer
        ?? activity.learn.explanation;
      const source = activity.retrieve.sourceReference ?? activity.sourceReferences[0] ?? null;
      const topic = concept.name.toLocaleLowerCase();
      const evidence = [answer, activity.teach?.pageText ?? "", activity.retrieve.prompt, ...activity.learn.keyPoints].join(" ").toLocaleLowerCase();
      let score = 0;
      for (const word of queryWords) {
        if (topic.includes(word)) score += 8;
        if (evidence.includes(word)) score += 2;
      }
      return score ? { conceptId: concept.id, conceptName: concept.name, answer, source, score } : null;
    })
    .filter((result): result is RankedCourseSearchResult => result !== null)
    .sort((left, right) => right.score - left.score || left.conceptName.localeCompare(right.conceptName))
    .slice(0, 3)
    .map(({ score: _score, ...result }) => result);
}
