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
