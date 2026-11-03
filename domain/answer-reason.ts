import type { PracticeItem } from "./types";

export type AnswerReason = {
  answer: string;
  reason: string;
  /** The attached passage can support this explanation; not a fresh provenance verification. */
  grounded: boolean;
};

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const normalize = (text: string) => text.normalize("NFKC").toLocaleLowerCase()
  .replace(/^[“"'([{]+|[”"')\]},.!?:;]+$/g, "");
const same = (a: string, b: string) => words(a).map(normalize).join(" ") === words(b).map(normalize).join(" ");
const statementIn = (prompt: string) => prompt.match(/“([^”]+)”/)?.[1] ?? prompt.match(/"([^"]+)"/)?.[1];

function changedWords(statement: string, source: string) {
  const shown = words(statement);
  const original = words(source);
  let start = 0;
  while (start < shown.length && start < original.length && normalize(shown[start]) === normalize(original[start])) start += 1;
  let endShown = shown.length;
  let endOriginal = original.length;
  while (endShown > start && endOriginal > start && normalize(shown[endShown - 1]) === normalize(original[endOriginal - 1])) {
    endShown -= 1;
    endOriginal -= 1;
  }
  // Explain small, explicit substitutions only. Do not interpret arbitrary rewrites or negation.
  if (endShown === start || endOriginal === start || endShown - start > 5 || endOriginal - start > 5) return null;
  return {
    statement: shown.slice(start, endShown).join(" ").replace(/[.!?]+$/, ""),
    source: original.slice(start, endOriginal).join(" ").replace(/[.!?]+$/, ""),
  };
}

function isOnlyQuotation(explanation: string, quote: string) {
  if (same(explanation.replace(/[“”"]/g, ""), quote)) return true;
  const stripped = explanation
    .replace(/^(?:(?:that is what )?the (?:notes|page|source) (?:says?|states?)|(?:page|section|slide)\s+\S+)\s*:\s*/i, "")
    .replace(/[“”"]/g, "");
  return same(stripped, quote);
}

/**
 * Explain the existing answer key; never grade, mutate progress, or invent subject knowledge.
 * Offline comparisons are restricted to the source-preserving templates the generator uses.
 */
export function buildAnswerReason(item: PracticeItem): AnswerReason {
  const answer = item.modelAnswer?.trim() ?? "";
  const quote = item.sourceQuote?.trim() ?? "";
  const explanation = item.explanation?.trim() ?? "";
  if (!quote) return {
    answer,
    grounded: false,
    reason: "No supporting source passage is attached to this question. The suggested answer cannot be verified from the evidence here.",
  };
  if (item.kind === "choice" && item.correctIndex !== undefined
    && item.choices?.[item.correctIndex] !== item.modelAnswer) return {
    answer,
    grounded: false,
    reason: "This question’s answer key is inconsistent. Compare the suggested answer with the source and report the question for review.",
  };
  // Keep a substantive authored explanation instead of replacing it with template wording.
  if (explanation && !isOnlyQuotation(explanation, quote)) return { answer, reason: explanation, grounded: true };
  const statement = statementIn(item.prompt);
  if (item.origin === "offline" && item.variant === "truefalse" && statement) {
    if (answer === "False") {
      const changed = changedWords(statement, quote);
      if (changed) return {
        answer,
        grounded: true,
        reason: `The statement says “${changed.statement}”, while your source says “${changed.source}”. That change is why the supported answer is “False”.`,
      };
    } else if (answer === "True" && same(statement, quote)) return {
      answer,
      grounded: true,
      reason: "The statement keeps the same wording as the cited source: no term or direction has changed. That is why the supported answer is “True”.",
    };
  }
  // A gap with words to choose from is the same question as a typed gap, so it gets the same explanation.
  if (item.origin === "offline" && (item.kind === "cloze" || (item.kind === "choice" && item.variant !== "truefalse")) && statement && answer) {
    const gaps = statement.match(/_{2,}/g);
    if (gaps?.length === 1 && same(statement.replace(/_{2,}/, () => answer), quote)) return {
      answer,
      grounded: true,
      reason: `The blank replaces “${answer}” in your source sentence. Put it back and the sentence reads as your notes do, below.`,
    };
  }
  return {
    answer,
    grounded: false,
    reason: "Your notes give this line without a reason of their own. Read it below and check the answer against it.",
  };
}
