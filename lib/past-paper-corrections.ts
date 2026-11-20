import type { PastPaperQuestionMap } from "@/domain/past-paper";

export type PastPaperMatchCorrection = {
  question: string;
  conceptId: string;
};

const KEY_PREFIX = "kelus:past-paper-corrections:";

function questionKey(question: string) {
  return question.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function sameCorrection(left: PastPaperMatchCorrection, right: PastPaperMatchCorrection) {
  return left.conceptId === right.conceptId && left.question === right.question;
}

/** A student correction is local course evidence: do not keep showing a link they explicitly rejected. */
export function withoutRejectedPastPaperMatches(questionMaps: PastPaperQuestionMap[], corrections: PastPaperMatchCorrection[]) {
  return questionMaps.map((question) => ({
    ...question,
    matches: question.matches.filter((match) => !corrections.some((correction) => sameCorrection(correction, { question: questionKey(question.text), conceptId: match.conceptId }))),
  }));
}

export function rejectPastPaperMatch(corrections: PastPaperMatchCorrection[], question: string, conceptId: string) {
  const next = { question: questionKey(question), conceptId };
  return corrections.some((correction) => sameCorrection(correction, next)) ? corrections : [...corrections, next];
}

export function restorePastPaperMatch(corrections: PastPaperMatchCorrection[], question: string, conceptId: string) {
  const target = { question: questionKey(question), conceptId };
  return corrections.filter((correction) => !sameCorrection(correction, target));
}

export function readPastPaperCorrections(courseId: string) {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(`${KEY_PREFIX}${courseId}`) ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is PastPaperMatchCorrection => Boolean(item) && typeof item === "object" && typeof (item as PastPaperMatchCorrection).question === "string" && typeof (item as PastPaperMatchCorrection).conceptId === "string")
      : [];
  } catch {
    return [];
  }
}

export function savePastPaperCorrections(courseId: string, corrections: PastPaperMatchCorrection[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${KEY_PREFIX}${courseId}`, JSON.stringify(corrections));
  } catch {
    // Storage can be unavailable in private browsing. The visible correction still applies for this visit.
  }
}
