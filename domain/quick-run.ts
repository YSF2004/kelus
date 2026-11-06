import { buildPractice, splitSentences } from "./content-engine";
import { isDrillable } from "./practice-check";
import { VERBS } from "./question-types";
import { inNotesLanguage, noteLanguage } from "./note-language";
import { primaryActivitySourceReference } from "./source-reference";
import type { LearningActivity, PracticeItem, RetrievalOutcome } from "./types";

export type SelfGrade = "nailed" | "partly" | "missed";

export type QuickRun = {
  checks: PracticeItem[];
  explainPrompt: string;
  explainAnswer: string;
  explainQuote: string;
  explainSourceReference?: LearningActivity["retrieve"]["sourceReference"];
  /** The page's sentences, so a wrong answer can be shown where it really belongs. */
  sentences: string[];
  /** A line from the page that no check and no explanation used: something new to end on. */
  extraFact?: string;
  topic: string;
};

const norm = (text: string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const overlaps = (a: string, b: string) => { const x = norm(a); const y = norm(b); return Boolean(x && y) && (x.includes(y) || y.includes(x)); };
const hasWord = (text: string, word: string) => new RegExp(`(?:^| )${norm(word)}(?: |$)`).test(norm(text));

/** "Which idea does this describe?": its answer is the topic's name, so the screen must not show that name while it is asked. */
export function asksForTheTopic(item: PracticeItem) {
  return /^(?:Which idea|Quelle notion)\b/.test(item.prompt);
}

/**
 * Questions that ask which topic a line belongs to: "Which idea does this describe?" and "Which of these is about
 * Photosynthesis?". They are answered by matching words to the topic's name, often from a line read seconds before,
 * so they test sorting, not recall of the content. They are never quick checks.
 */
export function sortsByTopic(item: PracticeItem) {
  return asksForTheTopic(item) || /^(?:Which of these is about|Laquelle de ces phrases parle de)\b/.test(item.prompt);
}

/** A question as the student reads it: two checks with the same words are the same question asked twice. */
const wording = (item: PracticeItem) => item.prompt.replace(/\s+/g, " ").trim().toLocaleLowerCase();

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
        locator: primaryActivitySourceReference(activity)?.locator ?? "this page",
        siblingNames,
      });
  // One of each kind before a second of any: a run should feel varied, not repeated.
  // Each round starts further along the list, so a second session brings questions the first one did not.
  const explainAnswer = activity.retrieve.modelAnswer;
  // "Which idea does this describe?" is answered by the topic name at the top of the screen, so it is a last resort.
  // A fill-in gap on a line shown seconds ago tests recognition, not recall. Save it for a return visit.
  // Which topic a line belongs to is sorting, not recall: those questions are left out, and a page with nothing else
  // to check goes straight from reading to the question in your own words.
  // Finishing the line the explanation asks for shows its whole answer: that one is never a check in the same run.
  const anyDrillable = own.filter((item) => isDrillable(item) && !sortsByTopic(item) && (!input.readFirst || item.kind !== "cloze") && !(item.variant === "complete" && overlaps(item.sourceQuote, activity.retrieve.modelAnswer)));
  const drillable = anyDrillable;
  // The explanation at the end asks for this sentence, so a check that shows it first would spoil it.
  const fresh = drillable.filter((item) => !overlaps(item.sourceQuote, explainAnswer));
  // A very short page may have nothing else to ask; then a check on the main sentence beats no quick run at all.
  const fromFresh = pickChecks(fresh, round);
  const fromAny = fromFresh.length >= 2 ? fromFresh : pickChecks(drillable, round);
  const fromAll = fromAny.length >= 2 ? fromAny : pickChecks(anyDrillable, round);
  // A one-sentence page (common in slides) can only be asked about that sentence; two angles on it still beat none.
  const checks = fromAll.length >= 2 ? fromAll : pickChecks(anyDrillable, round, false);
  const picked = checks.length >= 2 ? checks : pickChecks(anyDrillable, round, false).slice(0, 1);
  // Notes written as plain sentences give only fill-in gaps, and a gap is held back on a first visit, which left such a
  // topic with no quick check at all. There, a gap becomes a word to choose: the right word and three others from the
  // same notes, never one already in the line. Recognition, not recall, but the line is still the student's own.
  const firstVisit = input.readFirst && picked.length < 2 ? wordChoices(own.filter((item) => isDrillable(item) && item.kind === "cloze"), activity, explainAnswer, picked) : [];
  // A topic met for the first time opens on its quickest check to read, so the first answer is an early win; a
  // "which does NOT match" (four whole sentences to compare) never opens a topic when anything else can.
  // The same question once: identical wording twice in a topic reads as a repeat, whatever the options.
  const chosen = [...picked, ...firstVisit].filter((item, index, all) => all.findIndex((other) => wording(other) === wording(item)) === index).slice(0, MAX_CHECKS);
  const usable = spreadStyles(input.readFirst ? [...chosen].sort((a, b) => readingLoad(a) - readingLoad(b)) : chosen);
  if (!explainAnswer.trim()) return null;
  const sentences = splitSentences([activity.learn.explanation, ...activity.learn.keyPoints].join("\n"));
  const used = [explainAnswer, ...usable.map((item) => item.sourceQuote)];
  const extraFact = sentences.find((sentence) => sentence.length >= 40 && !used.some((quote) => overlaps(quote, sentence)));
  return {
    checks: usable,
    explainPrompt: round % 2 === 1 ? inNotesLanguage(`Close the page. What would you tell a friend about ${name}?`, noteLanguage(sentences.join(" ")), name) : activity.retrieve.prompt,
    explainAnswer,
    explainQuote: explainAnswer,
    explainSourceReference: activity.retrieve.sourceReference,
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
  // A picked sentence is already a whole line of the notes: pointing at "where it belongs" would only repeat it.
  if (answer.split(" ").length > 6) return null;
  const single = !answer.includes(" ");
  return sentences.find((sentence) => !overlaps(sentence, item.sourceQuote) && (single ? hasWord(sentence, answer) : norm(sentence).includes(answer))) ?? null;
}

/** How much a check asks you to read before you can answer: its words and its options' words. */
export function readingLoad(item: PracticeItem) {
  const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
  return words(item.prompt) + (item.choices ?? []).reduce((sum, choice) => sum + words(choice), 0) + (item.variant === "notone" ? 60 : 0);
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
 * Gaps turned into multiple choice, for a first visit with nothing else to ask: up to as many as bring the run to two
 * checks, each on a different line and never on the line the explanation will ask for, the options from gapChoices.
 */
/** The same kind of question twice in a row feels like a drill: keep the order, but step over a repeat when another
 * kind is left to put between them. */
function spreadStyles(items: PracticeItem[]) {
  const style = (item: PracticeItem) => item.variant ?? (item.prompt.match(/^\S+ \S+ \S+/)?.[0] ?? item.kind);
  const left = [...items];
  const out: PracticeItem[] = [];
  while (left.length) {
    const previous = out.length ? style(out[out.length - 1]) : null;
    const at = left.findIndex((item) => style(item) !== previous);
    out.push(left.splice(at >= 0 ? at : 0, 1)[0]);
  }
  return out;
}

/** The line a gap prompt quotes: "Fill the gap: “The _____ cycle …”" gives "The _____ cycle …". */
function lineOf(prompt: string) {
  const open = prompt.indexOf("“");
  const close = prompt.lastIndexOf("”");
  return open >= 0 && close > open ? prompt.slice(open + 1, close) : prompt.replace(/^[^:]*:\s*/, "");
}

function wordChoices(gaps: PracticeItem[], activity: LearningActivity, explainAnswer: string, already: PracticeItem[]) {
  const sentences = splitSentences([activity.learn.explanation, ...activity.learn.keyPoints].join("\n"));
  // Only a line that reads as a sentence: a diagram's labels run together ("Inputs to Cells air oxygen water food")
  // would make a word question out of nothing.
  const sentenceGaps = gaps.filter((item) => /[.!?]["”’)]?$/.test(item.sourceQuote.trim()) && item.sourceQuote.trim().split(/\s+/).length >= 6);
  const fresh = sentenceGaps.filter((item) => !overlaps(item.sourceQuote, explainAnswer));
  // Never the line the explanation asks for: a word chosen from it would hand over half the answer a minute later.
  const pool = fresh;
  const out: PracticeItem[] = [];
  for (const gap of pool) {
    if (already.length + out.length >= 2) break;
    if ([...already, ...out].some((other) => clashes(other, gap))) continue;
    const options = gapChoices(gap, { checks: pool, sentences, explainPrompt: "", explainAnswer, explainQuote: explainAnswer, topic: "" });
    if (options.length < 3) continue;
    out.push({ ...gap, id: `${gap.id}-word`, kind: "choice", prompt: `Which word completes this statement from your notes? “${lineOf(gap.prompt)}”`, choices: options, correctIndex: options.indexOf(gap.modelAnswer) });
  }
  return out;
}

/**
 * On a phone, a gap can be answered by tapping one of four words: the right one and three that also appear in this
 * topic's notes, of a similar length, none of them already in the sentence. Fewer than three such words: no chips.
 */
const VERB_WORDS = new Set([...VERBS.split("|"), "make", "makes", "made", "believe", "believes", "achieve", "achieves", "unite", "defend", "drag", "spread", "switch", "compete", "measure", "respond", "responds"]);
const GLUE_WORDS = new Set(["and", "or", "but", "is", "are", "was", "were", "be", "to", "of", "in", "on", "at", "by", "for", "with", "from", "as", "than", "that", "which", "the", "a", "an"]);

export function gapChoices(item: PracticeItem, run: QuickRun) {
  if (item.kind !== "cloze" || !item.modelAnswer || /\s/.test(item.modelAnswer)) return [];
  const answer = item.modelAnswer;
  const shown = norm(item.prompt);
  const isNumber = /^\d/.test(answer);
  const pool = new Set<string>();
  // Another gap's answer is a good wrong word only if it is the same kind: a year never stands in for a place.
  for (const other of run.checks) if (other !== item && other.kind === "cloze" && other.modelAnswer && !/\s/.test(other.modelAnswer) && /^\d/.test(other.modelAnswer) === isNumber) pool.add(other.modelAnswer);
  for (const sentence of run.sentences) {
    for (const word of sentence.match(/[\p{L}\d][\p{L}\d'-]*/gu) ?? []) {
      if (isNumber ? !/^\d/.test(word) : !/^\p{L}{4,}$/u.test(word)) continue;
      pool.add(word);
    }
  }
  const allTokens = run.sentences.map((sentence) => sentence.match(/[\p{L}\d][\p{L}\d'-]*/gu) ?? []);
  // A name is a word the notes capitalise in the middle of a sentence ("Britain", "Africa", "ATP"), never at its start only.
  const properNoun = (word: string) => {
    const lower = word.toLocaleLowerCase();
    let capitalMid = false;
    for (const words of allTokens) words.forEach((token, at) => {
      if (token.toLocaleLowerCase() !== lower) return;
      if (at > 0 && /^\p{Lu}/u.test(token)) capitalMid = true;
    });
    // "ATP", "DNA": an abbreviation is the name of a thing, and other things in the notes are fair options beside it.
    return capitalMid && !/^\p{Lu}{2,}$/u.test(word);
  };
  const candidates = [...pool]
    .filter((word) => norm(word) !== norm(answer) && !hasWord(shown, word) && Math.abs(word.length - answer.length) <= 4)
    .filter((word) => !/^(?:which|their|there|these|those|about|other|where|while|because|between|without|through|higher|lower|larger|smaller|greater|faster|slower|better|worse|easier|harder|easily|often|always|never|usually|also|only|very|much|many|more|most|less|least|each|every|some|such|cannot|could|would|should|might|must)$/i.test(word))
    // Grammar words are never an answer worth guessing: "Most of the that".
    .filter((word) => !/^(?:that|this|then|than|with|from|into|onto|have|been|were|they|them|what|when|another|other|such|both|either|neither|same|will|unless|until|upon|within)$/i.test(word))
    // A name keeps its capital, and a name only stands in for a name: "france" is not a word anyone would write.
    .filter((word) => properNoun(word) === properNoun(answer))
    .map((word) => (properNoun(word) || /^\p{Lu}/u.test(answer) ? word : word.toLocaleLowerCase()));
  const otherAnswers = new Set(run.checks.filter((other) => other !== item && other.kind === "cloze").map((other) => norm(other.modelAnswer)));
  const ending = answer.toLocaleLowerCase().slice(-3);
  // A wrong word should fit the sentence, or the right one gives itself away: "Demand falls as equals rises" is
  // out at a glance. Without a grammar, three signs from the notes themselves stand in for one:
  // the word's ending (price, costs, supplied), whether the notes use it as a verb (after "can", "to", "not"),
  // and whether the notes put it in the same slot, next to the word before or after the gap ("Supply rises").
  const form = (word: string) => /ing$/i.test(word) ? "ing" : /ed$/i.test(word) ? "ed" : /[^su]s$/i.test(word) ? "s" : "base";
  const tokens = run.sentences.map((sentence) => norm(sentence).split(" "));
  const verbish = new Set<string>();
  for (const words of tokens) words.forEach((word, at) => { if (at && /^(?:can|could|will|would|may|might|must|should|to|not|does|do|did)$/.test(words[at - 1])) verbish.add(word); });
  const around = norm(item.prompt.replace(/_{2,}/, " GAPMARK ")).split(" ");
  const gapAt = around.indexOf("gapmark");
  const before = gapAt > 0 ? around[gapAt - 1] : "";
  const after = gapAt >= 0 ? around[gapAt + 1] ?? "" : "";
  const fits = (word: string) => tokens.some((words) => words.some((other, at) => other === norm(word) && ((after && words[at + 1] === after) || (before && words[at - 1] === before))));
  // How the notes use a word stands in for a grammar: a word followed by "the", "its", "their" or "it" is a verb
  // ("contain the", "believe their", "achieve it"); one after "is", "was" or "became", or only ever before another
  // content word ("chemical energy"), describes something rather than naming it.
  const OBJECT = new Set(["the", "a", "an", "its", "their", "his", "her", "it", "them", "our", "these", "those", "many", "people"]);
  const COPULA = new Set(["is", "are", "was", "were", "be", "been", "became", "becomes", "become"]);
  const uses = (word: string) => {
    const target = norm(word);
    let object = 0; let described = 0; let before = 0; let seen = 0;
    for (const words of tokens) words.forEach((token, at) => {
      if (token !== target) return;
      seen += 1;
      const next = words[at + 1];
      if (next && OBJECT.has(next)) object += 1;
      if (at > 0 && COPULA.has(words[at - 1])) described += 1;
      if (next && next.length >= 4 && !GLUE_WORDS.has(next) && !OBJECT.has(next)) before += 1;
    });
    return { verb: object > 0 || verbish.has(target) || VERB_WORDS.has(target), describes: described > 0 || (seen > 0 && before === seen) };
  };
  const answerUse = uses(answer);
  const nameSlot = /^(?:a|an|the|its|their|his|her|our|this|these|those|of|in|from|by|for|with|used)$/.test(before);
  const misfit = (word: string) => {
    const use = uses(word);
    return (form(word) !== form(answer) ? 3 : 0) + (verbish.has(norm(word)) !== verbish.has(norm(answer)) ? 4 : 0) - (fits(word) ? 2 : 0)
      + (use.describes !== answerUse.describes ? 3 : 0);
  };
  // The best wrong words are the same kind of word: one that fits the slot, another answer from this topic, then a
  // word with the same ending.
  const score = (word: string) => (misfit(word) + (otherAnswers.has(norm(word)) ? 0 : 2) + (word.toLocaleLowerCase().endsWith(ending) ? 0 : 1)) * 10 + Math.abs(word.length - answer.length);
  const unique = [...new Set(candidates)]
    // A word the notes only ever write at the start of a sentence ("Europe", "Before") could be a name or not: it stays
    // only when the notes use it in the gap's own slot ("Supply rises" for "Demand falls as _____ rises").
    .filter((word) => properNoun(word) || fits(word) || allTokens.some((words) => words.some((token, at) => token.toLocaleLowerCase() === word.toLocaleLowerCase() && (at > 0 || !/^\p{Lu}/u.test(token)))))
    // A verb where the notes name a thing gives the answer away at a glance: "released as a contain".
    .filter((word) => answerUse.verb || !uses(word).verb)
    // "its joined", "a armed": a past form where the notes name a thing.
    .filter((word) => !nameSlot || form(answer) === "ed" || form(word) !== "ed")
    // An adverb ("quickly") never fills a noun's gap; "supply" and "apply" only look like one.
    .filter((word) => /ly$/i.test(answer) || !/(?<!p)ly$/i.test(word))
    .sort((a, b) => score(a) - score(b) || a.localeCompare(b));
  // Three fair options beat four with one that gives itself away: two wrong words of the right kind are enough.
  if (unique.length < 2) return [];
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
