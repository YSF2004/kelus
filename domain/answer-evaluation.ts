import type { LearningActivity, RetrievalOutcome } from "./types";
import { family, judgeWord, pageGroups, readAnswer } from "./explain-words";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "in", "into", "is", "it", "its", "of", "on", "or", "that", "the", "their", "then", "this", "to", "was", "which", "while", "with",
]);

const CANONICAL_TERMS: Record<string, string> = {
  activates: "cause", activated: "cause", activation: "cause", causes: "cause", caused: "cause", creates: "cause", triggers: "cause",
  consequence: "result", effect: "result", outcome: "result", produces: "result", resulting: "result",
  decreases: "reduce", decreased: "reduce", lowers: "reduce", reduced: "reduce",
  grows: "increase", increased: "increase", raises: "increase", rises: "increase",
  required: "condition", requirement: "condition", prerequisite: "condition",
  demonstrates: "show", indicates: "show", proves: "show", reveals: "show",
  occurs: "happen", happens: "happen",
  liable: "liability", responsible: "liability",
  computation: "calculate", computes: "calculate", calculated: "calculate",
  // Small, explicit paraphrase groups. They do not infer meaning from arbitrary prose.
  expensive: "cost", expense: "cost", costs: "cost",
  investing: "invest", investment: "invest", investments: "invest",
  restrains: "reduce", restrained: "reduce", fall: "reduce", falls: "reduce", ease: "reduce", eases: "reduce",
  higher: "increase",
};

function stem(token: string) {
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 5 && token.endsWith("ed")) return token.slice(0, -2);
  if (token.length > 5 && token.endsWith("es")) return token.slice(0, -2);
  if (token.length > 4 && token.endsWith("s")) return token.slice(0, -1);
  return token;
}

function normalizeToken(token: string) {
  return CANONICAL_TERMS[token] ?? CANONICAL_TERMS[stem(token)] ?? stem(token);
}

function evidenceTokens(value: string) {
  return [...new Set(value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token)).map(normalizeToken))];
}

function matchedTerms(answer: string, terms: string[]) {
  const actual = new Set(evidenceTokens(answer));
  return [...new Set(terms.map(normalizeToken))].filter((term) => actual.has(term));
}

function coverage(answer: string, expected: string) {
  const expectedTokens = evidenceTokens(expected);
  if (!expectedTokens.length) return 0;
  const actual = new Set(evidenceTokens(answer));
  return expectedTokens.filter((token) => actual.has(token)).length / expectedTokens.length;
}

function contradictionDetected(answer: string, expected: string) {
  // A free-floating "not" is not evidence of a reversed claim: "not immediately"
  // can be the correct explanation of a delayed effect. Only flag an explicit
  // negation of a relation the reference actually asserts.
  if (coverage(answer, expected) < 0.25) return false;
  const relation = /\b(?:do\s+not|does\s+not|did\s+not|doesn't|don't|didn't|never)\s+(lower|reduce|increase|raise|cause|require)s?\b/gi;
  for (const match of answer.matchAll(relation)) {
    const predicate = normalizeToken(match[1].toLowerCase());
    if (evidenceTokens(expected).includes(predicate)) return true;
  }
  return false;
}

export type AnswerCriterionResult = { id: string; label: string; met: boolean; evidence: string[] };
export type AssessmentMode = NonNullable<LearningActivity["assessment"]>["mode"];

export type AnswerEvaluation = {
  outcome: RetrievalOutcome;
  score: number;
  label: "Strong evidence" | "Partial evidence" | "Not enough evidence yet";
  explanation: string;
  matchedRetrieve: number;
  matchedApply: number;
  criteria: AnswerCriterionResult[];
  contradiction: boolean;
  /** What this deterministic check can establish—and the boundary it cannot cross. */
  mode: AssessmentMode;
  reviewNote: string;
};

function reviewNoteFor(mode: AssessmentMode) {
  switch (mode) {
    case "mathematics":
      return "Kelus checked the rule and conditions named in your explanation. Check a full proof or calculation against your working.";
    case "computer_science":
      return "Kelus checked the input, process, and result you described. Run or trace code separately before treating it as correct.";
    case "law":
      return "Kelus checked the rule, facts, and conclusion you named. It cannot decide a full legal analysis for you.";
    case "biology":
      return "Kelus checked the mechanism and consequence in your explanation. Revisit the diagram or process if the relationship still feels unclear.";
    case "history":
      return "Kelus checked the cause and consequence you named. Compare the source again for scope, dates, and competing explanations.";
    default:
      return "Kelus checked the source idea and the relationship you explained. Compare with the source before relying on a nuanced answer.";
  }
}

export function evaluateLearningResponse(input: {
  retrieveAnswer: string;
  applicationAnswer: string;
  retrieveModelAnswer: string;
  applicationModelAnswer: string;
  assessment?: LearningActivity["assessment"];
  /** A recall check asks only for the source idea. Reasoning and transfer belong to the application step. */
  retrievalOnly?: boolean;
}): AnswerEvaluation {
  const retrievalOnly = input.retrievalOnly === true;
  const retrieveWords = evidenceTokens(input.retrieveAnswer).length;
  const applicationWords = retrievalOnly ? retrieveWords : evidenceTokens(input.applicationAnswer).length;
  const matchedRetrieve = coverage(input.retrieveAnswer, input.retrieveModelAnswer);
  const matchedApply = retrievalOnly ? matchedRetrieve : coverage(input.applicationAnswer, input.applicationModelAnswer);
  const contradiction = contradictionDetected(input.retrieveAnswer, input.retrieveModelAnswer)
    || contradictionDetected(input.applicationAnswer, input.applicationModelAnswer);
  const rubric = (input.assessment?.criteria ?? []).filter((criterion) => !retrievalOnly || criterion.appliesTo !== "apply");
  const criteria = rubric.map((criterion) => {
    const answer = criterion.appliesTo === "retrieve" ? input.retrieveAnswer : criterion.appliesTo === "apply" ? input.applicationAnswer : `${input.retrieveAnswer} ${input.applicationAnswer}`;
    const evidence = matchedTerms(answer, criterion.terms);
    return { id: criterion.id, label: criterion.label, met: evidence.length >= criterion.minimumMatches, evidence };
  });
  const criterionRatio = criteria.length ? criteria.filter((criterion) => criterion.met).length / criteria.length : 0;
  const mode = input.assessment?.mode ?? "general";
  const reviewNote = reviewNoteFor(mode);
  const lexicalScore = retrievalOnly ? matchedRetrieve * 0.8 : matchedRetrieve * 0.55 + matchedApply * 0.25;
  const score = Number(Math.max(0, lexicalScore + criterionRatio * 0.2 - (contradiction ? 0.45 : 0)).toFixed(3));
  const sourceMet = criteria.find((criterion) => criterion.id === "source-idea")?.met ?? matchedRetrieve >= 0.34;
  const reasoningMet = retrievalOnly ? sourceMet : (criteria.find((criterion) => criterion.id === "reasoning")?.met ?? matchedApply >= 0.2);
  const missing = criteria.find((criterion) => !criterion.met);

  if (!contradiction && retrieveWords >= 5 && applicationWords >= 5 && sourceMet && reasoningMet && score >= 0.34) {
    return { outcome: "success", score, label: "Strong evidence", explanation: retrievalOnly
        ? "The answer includes the source idea. Compare it with the passage above: matching terms cannot verify every nuance."
        : "The answer includes the source idea and a reasoned application. Compare it with the passage above: matching terms cannot verify every nuance.", matchedRetrieve, matchedApply, criteria, contradiction, mode, reviewNote };
  }
  if (!contradiction && retrieveWords >= 3 && applicationWords >= 3 && (sourceMet || reasoningMet || score >= 0.16)) {
    return { outcome: "partial", score, label: "Partial evidence", explanation: missing ? `Some of the idea is here. Try again with: ${missing.label.toLocaleLowerCase()}.` : "Some of the idea is here. Compare your reasoning with the source before moving on.", matchedRetrieve, matchedApply, criteria, contradiction, mode, reviewNote };
  }
  return { outcome: "failure", score, label: "Not enough evidence yet", explanation: contradiction ? "This may reverse or negate the relationship in the source. Recheck the original passage before trying again." : missing ? `The answer does not yet show enough of the source idea. Start with: ${missing.label.toLocaleLowerCase()}.` : "The answer does not yet show enough of the source idea. Recheck the passage and try again.", matchedRetrieve, matchedApply, criteria, contradiction, mode, reviewNote };
}

export function evaluateDiagnosisResponse(input: { answer: string; modelAnswer: string; assessment?: LearningActivity["assessment"] }): AnswerEvaluation {
  return evaluateLearningResponse({ retrieveAnswer: input.answer, applicationAnswer: input.answer, retrieveModelAnswer: input.modelAnswer, applicationModelAnswer: input.modelAnswer, assessment: input.assessment, retrievalOnly: true });
}

/** At least one real-looking word: "hhhhhhh" or "asdf" key-mashing is not an attempt to explain. */
export function looksLikeWords(text: string) {
  return text.toLocaleLowerCase().split(/[^\p{L}]+/u).some((word) => word.length >= 3 && /[aeiouy]/.test(word) && !/(.)\1\1/.test(word) && !/^(?:asd|qwe|zxc|sdf|jkl)/.test(word));
}

/** Words that carry no idea on their own, on top of the stopwords: they never count as a key word to remember. */
const FILLER = new Set(["also", "because", "been", "being", "both", "each", "every", "more", "most", "only", "other", "some", "such", "than", "there", "these", "they", "those", "very", "what", "when", "where", "will", "would", "about", "after", "before", "between", "during", "over", "under", "your", "make", "makes", "made", "does", "done", "much", "many", "same", "into", "onto", "upon", "across", "through", "within", "without", "toward", "towards", "along",
  // Academic frame words: "X is the study of", "the way things are", "a kind of". They frame an idea, they are not one.
  "study", "studies", "way", "ways", "thing", "things", "kind", "kinds", "type", "types", "form", "forms", "part", "parts", "called", "known", "refers", "used", "uses", "example", "examples", "world", "should", "could", "might", "must", "process", "processes"]);

export type ExplainPart = { text: string; key: boolean; hit: boolean; /** The student's word that says the opposite of this one. */ flip?: string };
export type ExplainMatch = { parts: ExplainPart[]; keys: number; hits: number; missed: string[]; /** Opposites: what the page says, and what the student wrote instead. */ flipped: Array<{ page: string; said: string }>; suggest: "nailed" | "partly" | "missed" };

/**
 * Lines a student's own explanation up against the page sentence: which of the page's key words they used and which
 * they left out, grouped into phrases. A word counts in any form of its family ("moves" for "movement", "turgidity"
 * for "turgid"), or as an everyday word for the same idea ("rises" for "increases"). Saying the opposite ("loses"
 * where the page says "gains") is never a match, and is named. It only suggests a self-grade.
 */
// Words that give a sentence its direction: what goes in comes before them, what comes out after.
const DIRECTION = new Set(["into", "to", "becomes", "become", "produces", "produce", "forms", "form", "releases", "release", "yields", "turns"]);
const isKey = (word: string) => word.length >= 4 && !STOPWORDS.has(word) && !FILLER.has(word) && !/^\d+$/.test(word);

/** The key-word families on each side of each direction word, stopping at punctuation or another direction word. */
function sides(text: string) {
  const tokens = text.toLocaleLowerCase().split(/(\s+|[,.;:!?()])/).map((token) => token.trim()).filter(Boolean);
  const out: Array<{ before: Set<string>; after: Set<string>; word: string; beforeText: string; afterText: string }> = [];
  tokens.forEach((token, at) => {
    if (!DIRECTION.has(token)) return;
    const collect = (step: -1 | 1) => {
      const found: string[] = [];
      for (let index = at + step, seen = 0; index >= 0 && index < tokens.length && seen < 5; index += step, seen += 1) {
        const word = tokens[index].replace(/[^\p{L}\p{N}-]+/gu, "");
        if (!word || DIRECTION.has(word)) break;
        if (isKey(word)) found.push(word);
      }
      return step < 0 ? found.reverse() : found;
    };
    const before = collect(-1);
    const after = collect(1);
    out.push({ before: new Set(before.map(family)), after: new Set(after.map(family)), word: token, beforeText: before.join(" "), afterText: after.join(" ") });
  });
  return out;
}

/**
 * The page's words in the reverse direction: "chemical energy into light energy" where the notes say "light energy
 * into chemical energy". Every word matches, so only the order shows the idea is backwards.
 */
export function reversedRelations(answer: string, reference: string) {
  const reversed: Array<{ page: string; said: string }> = [];
  const said = sides(answer);
  for (const page of sides(reference)) {
    const shared = new Set([...page.before].filter((word) => page.after.has(word)));
    const from = [...page.before].filter((word) => !shared.has(word));
    const to = [...page.after].filter((word) => !shared.has(word));
    if (!from.length || !to.length) continue;
    const match = said.find((other) => other.word === page.word && from.some((word) => other.after.has(word)) && to.some((word) => other.before.has(word)));
    if (match) reversed.push({ page: `${page.beforeText} ${page.word} ${page.afterText}`, said: `${match.beforeText} ${match.word} ${match.afterText}` });
  }
  return reversed;
}

export function explainMatch(answer: string, reference: string, topic = ""): ExplainMatch {
  const said = readAnswer(answer);
  const ownGroups = pageGroups(reference);
  // The topic's own name is on the screen; leaving it out of an explanation is not a gap.
  // Except in "A vs. B": telling the two apart is the whole point, so their names are the key words.
  const named = new Set(/\s(?:vs\.?|versus)\s/i.test(topic) ? [] : topic.toLocaleLowerCase().split(/[^\p{L}\p{N}-]+/u).filter(Boolean));
  const parts: ExplainPart[] = [];
  // "(e.g. eBay auctions)" is the page's example, not the idea: leaving it out of an explanation is not a gap.
  let example = false;
  for (const piece of reference.split(/(\s+)/)) {
    if (/^\((?:e\.g|i\.e|eg|for)\b/i.test(piece)) example = true;
    const word = piece.toLocaleLowerCase().replace(/[^\p{L}\p{N}-]+/gu, "");
    const key = !example && word.length >= 4 && !STOPWORDS.has(word) && !FILLER.has(word) && !named.has(word) && !/^\d+$/.test(word);
    if (example && piece.includes(")")) example = false;
    const verdict = key ? judgeWord(word, said, ownGroups) : { hit: false };
    parts.push({ text: piece, key, hit: verdict.hit, ...(verdict.flip ? { flip: verdict.flip } : {}) });
  }
  const seen = new Set<string>();
  const unique = parts.filter((part) => part.key && !seen.has(family(part.text)) && seen.add(family(part.text)));
  const keys = unique.length;
  const hits = unique.filter((part) => part.hit).length;
  // Neighbouring missed key words read as one idea: "partially permeable membrane", not three separate words.
  const missed: string[] = [];
  let run: string[] = [];
  const flush = () => { if (run.length) missed.push(run.join(" ")); run = []; };
  for (const part of parts) {
    if (/^\s+$/.test(part.text)) continue;
    if (part.key && !part.hit && !part.flip) run.push(part.text.replace(/[^\p{L}\p{N}-]+/gu, ""));
    else flush();
  }
  flush();
  const share = keys ? hits / keys : 0;
  const flipped = [
    ...new Map(parts.filter((part) => part.flip).map((part) => [part.flip!, { page: part.text.replace(/[^\p{L}\p{N}-]+/gu, "").toLocaleLowerCase(), said: part.flip! }])).values(),
    // The right words in the wrong direction are a wrong idea too.
    ...reversedRelations(answer, reference),
  ];
  // An opposite or a reversal is a wrong idea, not a gap: it never suggests a full mark.
  // The page's idea backwards ("chemical energy into light energy") is the wrong idea, however many words match.
  const backwards = reversedRelations(answer, reference).length > 0;
  const suggest = !answer.trim() || share < 0.35 || backwards ? "missed" : share < 0.75 || flipped.length ? "partly" : "nailed";
  // "dilute solution" already says "solution": a phrase whose words were all named before is not listed again.
  const named2: string[] = [];
  for (const original of missed) {
    const phrase = original.toLocaleLowerCase();
    const said = new Set(named2.flatMap((item) => item.toLocaleLowerCase().split(" ").map(family)));
    if (phrase.split(" ").every((word) => said.has(family(word)))) continue;
    // "eBay" and "ATP" keep their own spelling; an ordinary word reads in lowercase.
    named2.push(original.split(" ").map((word) => (/\p{Lu}/u.test(word.slice(1)) ? word : word.toLocaleLowerCase())).join(" "));
  }
  return { parts, keys, hits, missed: named2, flipped, suggest };
}
