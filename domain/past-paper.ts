import type { Concept, ExtractedMaterialPage, LearningActivity, LearningSourceReference } from "./types";

export type PastPaperQuestion = {
  id: string;
  pageNumber: number;
  text: string;
};

export type PastPaperMatch = {
  conceptId: string;
  conceptName: string;
  mastery: number;
  score: number;
  sources: LearningSourceReference[];
};

export type PastPaperQuestionMap = PastPaperQuestion & {
  matches: PastPaperMatch[];
};

export type PastPaperExamBrief = {
  promptCount: number;
  linkedTopicCount: number;
  unmatchedPromptCount: number;
  /** A topic with no direct lexical/source-grounded link. It may still be examinable. */
  unlinkedTopicCount: number;
  topics: Array<{
    conceptId: string;
    conceptName: string;
    mastery: number;
    attempts: number;
    promptCount: number;
    sources: LearningSourceReference[];
  }>;
  priority: {
    conceptId: string;
    conceptName: string;
    mastery: number;
    attempts: number;
    promptCount: number;
  } | null;
};

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "between", "could", "describe", "does", "each", "explain", "following", "from", "have", "into", "make", "most", "must", "other", "should", "that", "their", "there", "these", "they", "this", "what", "when", "which", "with", "would", "your",
]);

function clean(text: string) {
  return text.replace(/\s+/g, " ").replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();
}

function tokens(text: string) {
  return [...new Set((text.toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []).filter((word) => !STOP_WORDS.has(word)))];
}

function sourceText(activity: LearningActivity | undefined) {
  if (!activity) return "";
  return [
    activity.learn.title,
    activity.learn.explanation,
    ...(activity.learn.keyPoints ?? []),
    activity.teach?.pageText?.slice(0, 8_000) ?? "",
    ...(activity.teach?.facts ?? []),
  ].join(" ").toLocaleLowerCase();
}

/**
 * Keeps only question-shaped lines. Past papers vary wildly, so this is intentionally conservative: Kelus would
 * rather leave a prompt unlinked than turn an instruction or marks table into a question.
 */
export function extractPastPaperQuestions(pages: ExtractedMaterialPage[], limit = 24): PastPaperQuestion[] {
  const found: PastPaperQuestion[] = [];
  const seen = new Set<string>();
  for (const page of pages) {
    const candidates = page.text.split(/\n{2,}|(?<=\?)\s+|(?<=\.)\s+(?=(?:Question|Q\.?|\d+[.)])\s*)/iu);
    for (const raw of candidates) {
      const text = clean(raw).replace(/^(?:(?:question|q\.?|part)\s*\d+[a-z]?|\d+[a-z]?)\s*[:.)-]?\s*/iu, "");
      const numbered = /^(?:question|q\.?|part)\s*\d+[a-z]?\b|^\d+[a-z]?[.)]\s+/iu.test(raw);
      const interrogative = /\?$/.test(text) || /^(?:explain|describe|compare|define|discuss|calculate|evaluate|identify|state|outline|why|how|what|which)\b/iu.test(text);
      if ((!numbered && !interrogative) || text.length < 18 || text.length > 520) continue;
      const key = text.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      found.push({ id: `past-${page.pageNumber}-${found.length + 1}`, pageNumber: page.pageNumber, text });
      if (found.length >= limit) return found;
    }
  }
  return found;
}

/** Maps a past-paper prompt to the student's confirmed course concepts without inventing an answer or grade. */
export function mapPastPaperQuestions(input: {
  questions: PastPaperQuestion[];
  concepts: Concept[];
  activities: LearningActivity[];
}): PastPaperQuestionMap[] {
  const activities = new Map(input.activities.map((activity) => [activity.conceptId, activity]));
  return input.questions.map((question) => {
    const terms = tokens(question.text);
    const matches = input.concepts.map((concept) => {
      const name = concept.name.toLocaleLowerCase();
      const body = sourceText(activities.get(concept.id));
      let score = 0;
      for (const term of terms) {
        if (name.includes(term)) score += 4;
        else if (body.includes(term)) score += 1;
      }
      return {
        conceptId: concept.id,
        conceptName: concept.name,
        mastery: concept.mastery,
        score,
        sources: activities.get(concept.id)?.sourceReferences ?? [],
      };
    }).filter((match) => match.score >= 2).sort((left, right) => right.score - left.score || left.mastery - right.mastery).slice(0, 2);
    return { ...question, matches };
  });
}

/**
 * Turns the conservative question map into an actionable revision brief. "Unlinked" deliberately does not mean
 * "will not be tested": the paper only gives us evidence of what it visibly asks about.
 */
export function summarizePastPaperCoverage(input: {
  questionMaps: PastPaperQuestionMap[];
  concepts: Concept[];
}): PastPaperExamBrief {
  const byId = new Map(input.concepts.map((concept) => [concept.id, concept]));
  const covered = new Map<string, { promptCount: number; sources: LearningSourceReference[] }>();
  let unmatchedPromptCount = 0;

  for (const question of input.questionMaps) {
    if (!question.matches.length) unmatchedPromptCount += 1;
    for (const match of question.matches) {
      const previous = covered.get(match.conceptId) ?? { promptCount: 0, sources: [] };
      covered.set(match.conceptId, {
        promptCount: previous.promptCount + 1,
        sources: [...previous.sources, ...match.sources].filter((source, index, all) => all.findIndex((item) => item.materialId === source.materialId && item.locator === source.locator) === index),
      });
    }
  }

  const topics = [...covered.entries()].flatMap(([conceptId, evidence]) => {
    const concept = byId.get(conceptId);
    return concept ? [{
      conceptId,
      conceptName: concept.name,
      mastery: concept.mastery,
      attempts: concept.retrievalAttempts,
      promptCount: evidence.promptCount,
      sources: evidence.sources,
    }] : [];
  }).sort((left, right) => right.promptCount - left.promptCount || left.mastery - right.mastery || left.conceptName.localeCompare(right.conceptName));

  // One honest place to start: stronger past-paper evidence first, then weaker demonstrated recall.
  const priority = [...topics].sort((left, right) => left.mastery - right.mastery || left.attempts - right.attempts || right.promptCount - left.promptCount || left.conceptName.localeCompare(right.conceptName))[0] ?? null;

  return {
    promptCount: input.questionMaps.length,
    linkedTopicCount: topics.length,
    unmatchedPromptCount,
    unlinkedTopicCount: input.concepts.filter((concept) => !covered.has(concept.id)).length,
    topics,
    priority: priority ? {
      conceptId: priority.conceptId,
      conceptName: priority.conceptName,
      mastery: priority.mastery,
      attempts: priority.attempts,
      promptCount: priority.promptCount,
    } : null,
  };
}
