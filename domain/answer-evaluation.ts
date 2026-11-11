import type { AnswerEvaluation, RetrievalOutcome } from "./types";

const STOP_WORDS = new Set([
  "about", "after", "again", "against", "also", "because", "before", "being", "between", "could", "does", "from", "have", "into", "itself", "more", "most", "other", "over", "same", "should", "such", "than", "that", "their", "there", "these", "they", "this", "through", "under", "using", "very", "what", "when", "where", "which", "while", "with", "would", "your",
]);

// Small, inspectable equivalence groups improve paraphrase tolerance without
// pretending that a deterministic rubric understands arbitrary prose.
const EQUIVALENCE_GROUPS = [
  ["cause", "causes", "caused", "create", "creates", "produce", "produces", "lead", "leads", "result", "results"],
  ["increase", "increases", "increased", "rise", "rises", "raise", "raises", "grow", "grows"],
  ["decrease", "decreases", "decreased", "fall", "falls", "reduce", "reduces", "decline", "declines"],
  ["require", "requires", "required", "need", "needs", "depend", "depends"],
  ["change", "changes", "changed", "vary", "varies", "shift", "shifts"],
  ["move", "moves", "moving", "transfer", "transfers", "transport", "transports"],
  ["store", "stores", "stored", "retain", "retains", "hold", "holds"],
  ["use", "uses", "used", "utilize", "utilizes", "employ", "employs"],
] as const;

const EQUIVALENTS = new Map<string, string>();
for (const group of EQUIVALENCE_GROUPS) {
  const canonical = group[0];
  for (const term of group) EQUIVALENTS.set(term, canonical);
}

function normalizeWord(value: string) {
  const raw = value.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
  const normalized = raw
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(?:ing|edly|edly|ed|es|s)$/i, "");
  return EQUIVALENTS.get(raw) ?? EQUIVALENTS.get(normalized) ?? normalized;
}

function terms(value: string) {
  const counts = new Map<string, number>();
  for (const raw of value.split(/\s+/)) {
    const word = normalizeWord(raw);
    if (word.length < 4 || STOP_WORDS.has(word)) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0]))
    .map(([word]) => word);
}

function singleEvaluation(response: string, expected: string) {
  const expectedTerms = terms(expected).slice(0, 10);
  const responseTerms = new Set(terms(response));
  const matchedTerms = expectedTerms.filter((term) => responseTerms.has(term));
  const missingTerms = expectedTerms.filter((term) => !responseTerms.has(term));
  const coverage = expectedTerms.length ? matchedTerms.length / expectedTerms.length : 0;
  const substance = Math.min(1, response.trim().split(/\s+/).filter(Boolean).length / 18);
  const expectedNegated = /\b(?:not|never|without|cannot|can't|doesn't|does not)\b/i.test(expected);
  const responseNegated = /\b(?:not|never|without|cannot|can't|doesn't|does not)\b/i.test(response);
  const contradiction = expectedNegated !== responseNegated && matchedTerms.length >= 2;
  const score = contradiction ? Math.min(0.18, coverage * 0.2) : coverage * 0.82 + substance * 0.18;
  return { score, matchedTerms, missingTerms, contradiction };
}

function outcomeFor(score: number, matchedCount: number): RetrievalOutcome {
  if (score >= 0.5 && matchedCount >= 3) return "success";
  if (score >= 0.24 && matchedCount >= 1) return "partial";
  return "failure";
}

export function evaluateAnswer(input: { response: string; expected: string }): AnswerEvaluation {
  const result = singleEvaluation(input.response, input.expected);
  const outcome = outcomeFor(result.score, result.matchedTerms.length);
  const explanation = outcome === "success"
    ? "Your answer contains the central source ideas and enough supporting detail."
    : outcome === "partial"
      ? "Your answer reaches part of the source idea, but important evidence is still missing."
      : result.contradiction
        ? "Your answer uses relevant source terms, but reverses or negates the source claim."
        : "Kelus could not find enough of the source-grounded idea in this answer yet.";
  return {
    outcome,
    score: Number(result.score.toFixed(3)),
    matchedTerms: result.matchedTerms.slice(0, 5),
    missingTerms: result.missingTerms.slice(0, 5),
    explanation,
    method: "source_rubric",
  };
}

export function evaluateSessionAnswers(input: {
  retrievalResponse: string;
  retrievalExpected: string;
  applicationResponse: string;
  applicationExpected: string;
}): AnswerEvaluation {
  const retrieval = singleEvaluation(input.retrievalResponse, input.retrievalExpected);
  const application = singleEvaluation(input.applicationResponse, input.applicationExpected);
  const score = retrieval.score * 0.62 + application.score * 0.38;
  const matchedTerms = [...new Set([...retrieval.matchedTerms, ...application.matchedTerms])];
  const missingTerms = [...new Set([...retrieval.missingTerms, ...application.missingTerms])];
  const outcome = outcomeFor(score, matchedTerms.length);
  return {
    outcome,
    score: Number(score.toFixed(3)),
    matchedTerms: matchedTerms.slice(0, 6),
    missingTerms: missingTerms.slice(0, 6),
    explanation: outcome === "success"
      ? "Your retrieval and application both preserve the central source ideas."
      : outcome === "partial"
        ? "Your reasoning is partly aligned with the source, but one or more central ideas are missing."
        : "The response does not yet demonstrate the source-grounded idea reliably enough to raise mastery.",
    method: "source_rubric",
  };
}
