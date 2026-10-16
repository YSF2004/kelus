import { buildPractice, splitSentences } from "./content-engine";
import { isDrillable } from "./practice-check";
import type { LearningActivity, PracticeItem, RetrievalOutcome } from "./types";

export type SelfGrade = "nailed" | "partly" | "missed";

export type QuickRun = {
  checks: PracticeItem[];
  explainPrompt: string;
  explainAnswer: string;
  explainQuote: string;
  /** The page's sentences, so a wrong answer can be shown where it really belongs. */
  sentences: string[];
  /** A line from the page that no check and no explanation used: something new to end on. */
  extraFact?: string;
  topic: string;
};

const norm = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const overlaps = (a: string, b: string) => { const x = norm(a); const y = norm(b); return Boolean(x && y) && (x.includes(y) || y.includes(x)); };
const hasWord = (text: string, word: string) => new RegExp(`(?:^| )${norm(word)}(?: |$)`).test(norm(text));

/** The words around a gap: "In a _____ solution" twice is the same question twice, whatever the answer. */
function gapFrame(item: PracticeItem) {
  if (item.kind !== "cloze") return null;
  const [before = "", after = ""] = item.prompt.split("_____");
  return `${norm(before).split(" ").slice(-2).join(" ")}|${norm(after).split(" ")[0] ?? ""}`;
}

/**
 * Two checks clash when they test the same fact, use the same gap frame, or when the earlier one's feedback
 * (which shows its quote) would give away the later one's answer.
 */
function clashes(earlier: PracticeItem, later: PracticeItem) {
  if (overlaps(earlier.sourceQuote, later.sourceQuote)) return true;
  const frame = gapFrame(later);
  if (frame && frame === gapFrame(earlier)) return true;
  if (later.kind === "cloze" && hasWord(earlier.sourceQuote, later.modelAnswer)) return true;
  if (earlier.kind === "cloze" && hasWord(later.prompt, earlier.modelAnswer)) return true;
  return false;
}

const MAX_CHECKS = 3;

function pickChecks(all: PracticeItem[], round: number, strict = true) {
  const turn = all.length ? (round * MAX_CHECKS) % all.length : 0;
  const pool = [...all.slice(turn), ...all.slice(0, turn)];
  const style = (item: PracticeItem) => item.variant ?? item.kind;
  // A question that asks "why" or "which" beats a fill-in gap, so one understanding item leads when the page has one.
  // Then one of each style before a second of any, and never two checks on the same fact.
  const lead = pool.find((item) => item.level === "understand");
  const ordered = [...(lead ? [lead] : []), ...pool.filter((item) => item !== lead)];
  const checks: PracticeItem[] = [];
  for (const varied of [true, false]) {
    for (const item of ordered) {
      if (checks.length >= MAX_CHECKS || checks.includes(item)) continue;
      if (varied && checks.some((chosen) => style(chosen) === style(item))) continue;
      if (strict && checks.some((chosen) => clashes(chosen, item))) continue;
      // Even on a thin page, three checks on one sentence is a quiz on a line, not a topic: two angles at most.
      if (!strict && checks.filter((chosen) => overlaps(chosen.sourceQuote, item.sourceQuote)).length >= 2) continue;
      // One fill-the-gap per run while other kinds of question are still available: a run should make you think,
      // not just recall a word.
      if (strict && item.kind === "cloze" && checks.some((chosen) => chosen.kind === "cloze") && ordered.some((other) => other.kind !== "cloze" && !checks.includes(other) && !checks.some((chosen) => clashes(chosen, other)))) continue;
      checks.push(item);
    }
  }
  return checks;
}

/**
 * A short run for one topic: up to three instant checks, then one explanation in the learner's own words.
 * Everything comes from the topic's page, and each check tests a different fact from the one the explanation asks for.
 * A page too thin for a fair instant check still gets an own-words explanation. Do not turn a sentence
 * just read into an immediate fill-in-the-gap or invent a multiple-choice answer from unrelated notes.
 * Null is reserved for a page with nothing to explain at all.
 */
export function buildQuickRun(input: { activity: LearningActivity; name: string; siblingNames: string[]; round?: number; readFirst?: boolean }): QuickRun | null {
  const { activity, name, siblingNames } = input;
  const round = Math.max(0, Math.floor(input.round ?? 0));
  const own = activity.practice?.length
    ? activity.practice
    : buildPractice({
        conceptId: activity.conceptId,
        name,
        excerpt: [activity.learn.explanation, ...activity.learn.keyPoints].join("\n"),
        locator: activity.sourceReferences[0]?.locator ?? "this page",
        siblingNames,
      });
  // One of each kind before a second of any: a run should feel varied, not repeated.
  // Each round starts further along the list, so a second session brings questions the first one did not.
  const explainAnswer = activity.retrieve.modelAnswer;
  // "Which idea does this describe?" is answered by the topic name at the top of the screen, so it is a last resort.
  // A fill-in gap on a line shown seconds ago tests recognition, not recall. Save it for a return visit.
  const anyDrillable = own.filter((item) => isDrillable(item) && (!input.readFirst || item.kind !== "cloze"));
  const drillable = anyDrillable.filter((item) => !/^Which idea\b/.test(item.prompt));
  // The explanation at the end asks for this sentence, so a check that shows it first would spoil it.
  const fresh = drillable.filter((item) => !overlaps(item.sourceQuote, explainAnswer));
  // A very short page may have nothing else to ask; then a check on the main sentence beats no quick run at all.
  const fromFresh = pickChecks(fresh, round);
  const fromAny = fromFresh.length >= 2 ? fromFresh : pickChecks(drillable, round);
  const fromAll = fromAny.length >= 2 ? fromAny : pickChecks(anyDrillable, round);
  // A one-sentence page (common in slides) can only be asked about that sentence; two angles on it still beat none.
  const checks = fromAll.length >= 2 ? fromAll : pickChecks(anyDrillable, round, false);
  const usable = checks.length >= 2 ? checks : pickChecks(anyDrillable, round, false).slice(0, 1);
  if (!explainAnswer.trim()) return null;
  const sentences = splitSentences([activity.learn.explanation, ...activity.learn.keyPoints].join("\n"));
  const used = [explainAnswer, ...usable.map((item) => item.sourceQuote)];
  const extraFact = sentences.find((sentence) => sentence.length >= 40 && !used.some((quote) => overlaps(quote, sentence)));
  return {
    checks: usable,
    explainPrompt: round % 2 === 1 ? `Close the page. What would you tell a friend about ${name}?` : activity.retrieve.prompt,
    explainAnswer,
    explainQuote: explainAnswer,
    sentences,
    extraFact,
    topic: name,
  };
}

/**
 * A wrong answer is usually a real word from the notes, just from another line. Finding that line turns "Not quite"
 * into the actual lesson: what the word does mean, next to what was asked.
 */
export function whereAnswerBelongs(item: PracticeItem, given: string, sentences: string[]) {
  const answer = norm(given);
  if (answer.length < 3 || answer === norm(item.modelAnswer)) return null;
  const single = !answer.includes(" ");
  return sentences.find((sentence) => !overlaps(sentence, item.sourceQuote) && (single ? hasWord(sentence, answer) : norm(sentence).includes(answer))) ?? null;
}

/**
 * One outcome for the topic, from what the learner showed: the quick checks they got right and the key ideas
 * from the notes their explanation used. Their own rating is a confidence, not evidence: it can lower the
 * result ("I missed it") but never raise it, so "Nailed it" on wrong checks is still another attempt.
 */
export function quickEvidence(input: { right: number; total: number; coverage?: { hits: number; keys: number } | null }) {
  const parts: Array<[number, number]> = [];
  if (input.total > 0) parts.push([input.right / input.total, 0.6]);
  if (input.coverage && input.coverage.keys >= 3) parts.push([input.coverage.hits / input.coverage.keys, 0.4]);
  if (!parts.length) return null;
  const weight = parts.reduce((sum, [, w]) => sum + w, 0);
  return parts.reduce((sum, [value, w]) => sum + value * w, 0) / weight;
}

export function quickOutcome(input: { right: number; total: number; self: SelfGrade; coverage?: { hits: number; keys: number } | null; readFirst?: boolean }): RetrievalOutcome {
  const evidence = quickEvidence(input);
  // Nothing measurable (no checks, an explanation too short to compare): a self-rating alone is never a pass.
  if (evidence === null) return input.self === "missed" ? "failure" : "partial";
  if (input.self === "missed") return evidence >= 0.67 ? "partial" : "failure";
  // Immediately after reading, even a perfect answer is early evidence, not durable recall.
  if (evidence >= 0.75) return input.readFirst ? "partial" : "success";
  if (evidence >= 0.4) return "partial";
  return "failure";
}

export function quickSummary(input: { right: number; total: number; self: SelfGrade; unsure?: number }) {
  const rating = input.self === "nailed" ? "nailed it" : input.self === "partly" ? "partly there" : "missed it";
  const unsure = input.unsure ? ` (${input.unsure} marked not sure)` : "";
  if (input.total === 0) return `No quick check was suitable for these notes. You rated your explanation: ${rating}.`;
  return `${input.right} of ${input.total} quick checks right${unsure}. You rated your explanation: ${rating}.`;
}

/**
 * A new topic is read before it is asked: the lines the checks and the explanation come from, in the order the notes
 * give them, two to four of them. On a later visit nothing is read first; recall is the point then.
 */
export function readingLines(run: QuickRun) {
  const asked = [...run.checks.map((check) => check.sourceQuote), run.explainAnswer].filter(Boolean);
  const inOrder = run.sentences.filter((sentence) => asked.some((quote) => overlaps(quote, sentence)));
  const lines: string[] = [];
  for (const line of [...inOrder, ...asked, ...run.sentences]) {
    if (lines.length >= 4) break;
    if (line.length < 20 || lines.some((kept) => overlaps(kept, line))) continue;
    lines.push(line);
  }
  return lines;
}

/**
 * What to mark in a line being read: the term it defines ("Osmosis is …", "Turgid: …"), at most one per line. Never
 * the word a check is about to ask for: marking the answer seconds before the gap is an echo, not recall.
 */
export function keyWordsIn(line: string, run: QuickRun) {
  const asked = run.checks.filter((check) => check.kind === "cloze" && check.modelAnswer).map((check) => norm(check.modelAnswer));
  const term = line.match(/^(?:the\s+|an?\s+)?([\p{L}][\p{L}'’ -]{2,40}?)(?:\s+(?:is|are|means|refers to)\s|\s*:\s)/iu)?.[1]?.trim();
  if (!term || term.split(/\s+/).length > 4 || asked.some((answer) => norm(term).split(" ").includes(answer))) return [];
  return [term];
}

/**
 * On a phone, a gap can be answered by tapping one of four words: the right one and three that also appear in this
 * topic's notes, of a similar length, none of them already in the sentence. Fewer than three such words: no chips.
 */
export function gapChoices(item: PracticeItem, run: QuickRun) {
  if (item.kind !== "cloze" || !item.modelAnswer || /\s/.test(item.modelAnswer)) return [];
  const answer = item.modelAnswer;
  const shown = norm(item.prompt);
  const isNumber = /^\d/.test(answer);
  const pool = new Set<string>();
  for (const other of run.checks) if (other !== item && other.kind === "cloze" && other.modelAnswer && !/\s/.test(other.modelAnswer)) pool.add(other.modelAnswer);
  for (const sentence of run.sentences) {
    for (const word of sentence.match(/[\p{L}\d][\p{L}\d'-]*/gu) ?? []) {
      if (isNumber ? !/^\d/.test(word) : !/^\p{L}{4,}$/u.test(word)) continue;
      pool.add(word);
    }
  }
  const candidates = [...pool]
    .filter((word) => norm(word) !== norm(answer) && !hasWord(shown, word) && Math.abs(word.length - answer.length) <= 4)
    .filter((word) => !/^(?:which|their|there|these|those|about|other|where|while|because|between|without|through)$/i.test(word))
    .map((word) => (/^\p{Lu}/u.test(answer) ? word : word.toLocaleLowerCase()));
  const otherAnswers = new Set(run.checks.filter((other) => other !== item && other.kind === "cloze").map((other) => norm(other.modelAnswer)));
  const ending = answer.toLocaleLowerCase().slice(-3);
  // The best wrong words are the same kind of word: another answer from this topic, then a word with the same ending.
  const score = (word: string) => (otherAnswers.has(norm(word)) ? 0 : word.toLocaleLowerCase().endsWith(ending) ? 1 : 2) * 10 + Math.abs(word.length - answer.length);
  const unique = [...new Set(candidates)]
    .filter((word) => /ly$/i.test(answer) || !/ly$/i.test(word))
    .sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  if (unique.length < 3) return [];
  const seed = [...answer].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const options = [answer, ...unique.slice(0, 3)];
  return options.map((word, index) => ({ word, key: (index * 7 + seed) % 11 })).sort((a, b) => a.key - b.key || a.word.localeCompare(b.word)).map((entry) => entry.word);
}

/**
 * A miss teaches more with its surroundings: the line before and the line after the one asked about, as the notes
 * give them. Null when the line is not among this topic's sentences or stands alone.
 */
export function linesAround(run: QuickRun, quote: string) {
  const at = run.sentences.findIndex((sentence) => overlaps(sentence, quote));
  if (at < 0) return null;
  const before = run.sentences[at - 1] ?? null;
  const after = run.sentences[at + 1] ?? null;
  return before || after ? { before, line: run.sentences[at], after } : null;
}
