import { create, insertMultiple, search } from "@orama/orama";
import type { Concept, ExtractedMaterialPage, LearningActivity, LearningSourceReference } from "@/domain/types";

export type CourseSearchResult = {
  conceptId: string;
  conceptName: string;
  answer: string;
  source: LearningSourceReference | null;
  quote: string;
};
type RankedCourseSearchResult = CourseSearchResult & { score: number };
export type CourseSearchDocument = { materialId: string; label: string; locatorLabel: "Page" | "Section"; pages: ExtractedMaterialPage[] };

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
      return score ? { conceptId: concept.id, conceptName: concept.name, answer, source, quote: answer, score } : null;
    })
    .filter((result): result is RankedCourseSearchResult => result !== null)
    .sort((left, right) => right.score - left.score || left.conceptName.localeCompare(right.conceptName))
    .slice(0, 3)
    .map(({ score: _score, ...result }) => result);
}

function sentences(text: string) {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 28);
}

type IndexedPassage = {
  id: string;
  materialId: string;
  label: string;
  locator: string;
  quote: string;
};

/**
 * Searches only locally extracted course passages. Orama ranks the original wording
 * and tolerates small spelling mistakes; it never creates or sends an answer.
 */
export async function searchCoursePagesIndexed(query: string, documents: CourseSearchDocument[]): Promise<CourseSearchResult[]> {
  if (!words(query).length) return [];

  const passages: IndexedPassage[] = documents.flatMap((document) => document.pages.flatMap((page) => {
    const locator = `${document.locatorLabel} ${page.pageNumber}`;
    return sentences(page.text).map((quote, index) => ({
      id: `${document.materialId}-${page.pageNumber}-${index}`,
      materialId: document.materialId,
      label: document.label,
      locator,
      quote,
    }));
  }));

  if (!passages.length) return [];

  const index = create({
    schema: {
      id: "string",
      materialId: "string",
      label: "string",
      locator: "string",
      quote: "string",
    },
  });
  await insertMultiple(index, passages);
  const result = await search(index, {
    term: query.trim(),
    properties: ["quote", "label"],
    tolerance: 1,
    limit: 8,
  });
  const openedPages = new Set<string>();

  return result.hits.flatMap(({ document }) => {
    const pageKey = `${document.materialId}-${document.locator}`;
    if (openedPages.has(pageKey)) return [];
    openedPages.add(pageKey);
    return [{
      conceptId: `source-${document.id}`,
      conceptName: document.label,
      answer: document.quote,
      quote: document.quote,
      source: { materialId: document.materialId, label: document.label, locator: document.locator },
    }];
  }).slice(0, 3);
}

/** Searches the pages themselves after import. It returns a verbatim passage, never a generated summary. */
export function searchCoursePages(query: string, documents: CourseSearchDocument[]): CourseSearchResult[] {
  const queryWords = words(query);
  if (!queryWords.length) return [];
  const matches: Array<CourseSearchResult & { score: number }> = [];
  for (const document of documents) {
    for (const page of document.pages) {
      const best = sentences(page.text).map((sentence) => ({ sentence, score: queryWords.reduce((total, word) => total + (sentence.toLocaleLowerCase().includes(word) ? 1 : 0), 0) })).sort((left, right) => right.score - left.score)[0];
      if (!best?.score) continue;
      const locator = `${document.locatorLabel} ${page.pageNumber}`;
      matches.push({ conceptId: `source-${document.materialId}-${page.pageNumber}`, conceptName: document.label, answer: best.sentence, quote: best.sentence, source: { materialId: document.materialId, label: document.label, locator }, score: best.score });
    }
  }
  return matches.sort((left, right) => right.score - left.score || left.conceptName.localeCompare(right.conceptName)).slice(0, 3).map(({ score: _score, ...result }) => result);
}
