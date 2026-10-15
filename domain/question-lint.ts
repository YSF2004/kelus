import type { PracticeItem } from "./types";

/**
 * Automatic checks for the mistakes a student notices first. They run in tests and in the review script, and the
 * generator uses them to drop a question rather than ship it. A question with a defect is worse than no question.
 */
export type Defect =
  | "article-leak"
  | "split-token"
  | "double-blank"
  | "ungrammatical-flip"
  | "answer-in-prompt"
  | "too-long"
  | "weak-options"
  | "trivial-gap"
  | "gap-in-question"
  | "orphan-pronoun"
  | "fragment-option";

const GAP = /_____/g;

const PRONOUN_START = /^(?:it|this|that|these|those|they|he|she)\b/i;

/**
 * A line a student can read on its own, out of its page: a real sentence of five words or more, not a heading cut off
 * at a colon or "…", not a question from the slide, not "It …" with nothing to point at, and not a chain of symbols
 * ("I- > Br- > Cl-") or a list marker left at the end ("… acidic) b.").
 */
export function standsAlone(line: string) {
  const text = line.trim().replace(/^[“"‘'(]+/, "");
  const words = text.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  if (words.length < 5) return false;
  if (/(?::|…|\.\.\.|,)["”]?$/.test(text) || /\?["”)]?$/.test(text)) return false;
  if (PRONOUN_START.test(text)) return false;
  if (/\s[a-z]\.$/.test(text) || (text.match(/\s[<>=]\s?/g) ?? []).length >= 2) return false;
  // A line with no lowercase word of four letters is a label row ("Strong acid Weak acid", "B.A., University of …").
  const lower = words.filter((word) => /^\p{Ll}{4,}$/u.test(word)).length;
  return lower >= 2;
}

/** The statement shown to the learner, without the "Fill the gap…" wrapper. */
function shown(item: PracticeItem) {
  return item.prompt.replace(/^[^“]*“/, "").replace(/”[^”]*$/, "");
}

export function lintQuestion(item: PracticeItem): Defect[] {
  const defects: Defect[] = [];
  const text = shown(item);

  if (item.kind === "cloze") {
    const blanks = text.match(GAP)?.length ?? 0;
    // "An _____ in demand": the article gives the answer's first sound away.
    if (/\b[Aa]n _____/.test(text)) defects.push("article-leak");
    // "_____,000", "non-_____", "O(_____)" fragments, "3_____": a blank that cuts a word or number in half.
    if (/[\w]-_____|_____-[\w]|_____[,.]\d|\d_____|\d,_____/.test(text)) defects.push("split-token");
    // Two blanks for one answer ("Doubling the _____ … because the _____ is squared") ask the same thing twice.
    if (blanks > 1) defects.push("double-blank");
    // A gap whose sentence is almost nothing but the gap.
    if (text.replace(GAP, "").split(/\s+/).filter(Boolean).length < 6) defects.push("trivial-gap");
    // "What was new about _____'s theory?" quotes a question from the slide, not a fact from the notes.
    if (/\?\s*$/.test(text)) defects.push("gap-in-question");
    // "It measures the willingness of _____ to sell": out of its page, "it" could be supply or demand.
    if (PRONOUN_START.test(text.trim())) defects.push("orphan-pronoun");
    if (item.modelAnswer && new RegExp(`(?<![\\w])${item.modelAnswer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w])`, "i").test(text.replace(GAP, ""))) defects.push("answer-in-prompt");
  }

  if (item.variant === "truefalse" || item.variant === "pair" || item.variant === "direction") {
    // Flips that read badly give the false version away: "an passive", "made him Last Consul", "Last compare".
    const candidates = [text, ...(item.choices ?? [])];
    const SOUNDS_VOWEL = /\ban? (?:hour|honest|honou?r|heir)\b/i;
    const SOUNDS_CONSONANT = /\ba (?:one|once|use|used|user|unit|union|unique|university|useful|usual|european)\b/i;
    for (const candidate of candidates) {
      const badA = /\ba [aeiou]\w*/i.test(candidate) && !SOUNDS_CONSONANT.test(candidate);
      const badAn = /\ban [^aeiou\s]\w*/i.test(candidate) && !SOUNDS_VOWEL.test(candidate);
      const oddCase = /(?:^|[.!?] )(?:Last|Early|Late) \w/.test(candidate) || /\b(?:Last|Early|Late) [A-Z]/.test(candidate);
      if (badA || badAn || oddCase) defects.push("ungrammatical-flip");
    }
  }

  if (item.kind === "choice" && item.choices) {
    const lengths = item.choices.map((choice) => choice.length);
    const distinct = new Set(item.choices.map((choice) => choice.toLocaleLowerCase())).size === item.choices.length;
    // Options of wildly different length let the longest one win without reading.
    if (!distinct || (item.choices.length > 2 && Math.max(...lengths) > 3.2 * Math.max(8, Math.min(...lengths)) && item.variant !== "truefalse")) defects.push("weak-options");
  }

  // "Which of these is from your notes": every option is a line to judge, so each must read as one on its own.
  if (item.kind === "choice" && item.choices && /^Which of these (?:is from|does NOT match) your notes/.test(item.prompt) && !item.choices.every(standsAlone)) defects.push("fragment-option");
  if (item.prompt.length > 330) defects.push("too-long");
  return [...new Set(defects)];
}
