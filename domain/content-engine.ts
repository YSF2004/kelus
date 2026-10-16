import { hintInNotesLanguage, inNotesLanguage, noteLanguage } from "./note-language";
import type { PracticeItem } from "./types";
import { lintQuestion, standsAlone } from "./question-lint";
import { contrastChoices, effectQuestions, framePairs, notMatching, termFromMeaning, whyChoices } from "./question-types";

/**
 * Builds teaching facts and varied practice from a topic's own page text, with no outside knowledge.
 * Everything returned quotes the page; if the page does not support an item, the item is not made.
 */

const STOP = new Set([
  "about", "above", "after", "again", "also", "among", "because", "before", "being", "between", "both", "could", "does", "each", "from", "have", "into", "more", "most", "much", "only", "other", "over", "same", "should", "some", "such", "than", "that", "their", "them", "then", "there", "these", "they", "this", "those", "through", "under", "until", "very", "when", "where", "which", "while", "with", "within", "would", "will", "than", "unit",
  // French, so a sheet in French gets its gaps on ideas too, not on its small words.
  "avec", "dans", "pour", "sans", "sous", "entre", "vers", "chez", "plus", "moins", "très", "aussi", "comme", "après", "avant", "pendant", "quand", "alors", "donc", "mais", "elle", "elles", "leur", "leurs", "cette", "celui", "celle", "ceux", "autre", "autres", "toute", "toutes", "tous", "même", "laquelle", "lequel", "lesquels", "lesquelles", "partir", "utilisant", "étant", "était", "sont", "être", "avoir", "fait", "faire", "peut", "peuvent", "ainsi", "selon", "contre", "depuis", "lorsque", "parce", "puis", "encore", "chaque", "plusieurs", "certains", "certaines",
]);

/**
 * Words that have a clear opposite. A true/false statement is made by swapping exactly one of them in a
 * sentence from the page: the result is plausible, false, and the page itself shows the right version.
 */
const OPPOSITES: Array<[string, string]> = [
  ["increases", "decreases"], ["increase", "decrease"], ["increased", "decreased"], ["increasing", "decreasing"],
  ["rises", "falls"], ["rise", "fall"], ["rising", "falling"], ["higher", "lower"], ["highest", "lowest"],
  ["more", "less"], ["gains", "loses"], ["inside", "outside"], ["elastic", "inelastic"],
  ["hypotonic", "hypertonic"], ["faster", "slower"], ["larger", "smaller"], ["greater", "smaller"],
  ["before", "after"], ["positive", "negative"], ["absorbs", "releases"], ["expands", "contracts"],
  ["shifts left", "shifts right"], ["stronger", "weaker"], ["maximum", "minimum"], ["above", "below"],
  ["internal", "external"], ["active", "passive"],
];
const SWAP = new Map<string, string>(OPPOSITES.flatMap(([a, b]) => [[a, b], [b, a]] as Array<[string, string]>));
const NEGATION = /\b(?:not|no|never|neither|nor|without|unless|cannot|can't|isn't|aren't|doesn't|don't|n't)\b/i;

/** The sentence with one word swapped for its opposite, or null when that cannot be done safely. */
export function flipOneWord(sentence: string): string | null {
  if (NEGATION.test(sentence)) return null;
  const matches = [...sentence.matchAll(/[A-Za-z]+(?: (?:left|right))?/g)].filter((match) => SWAP.has(match[0].toLocaleLowerCase()));
  // Exactly one swappable word: with two ("from low to high") a swap could read as true.
  if (matches.length !== 1) return null;
  const [match] = matches;
  // "many less" and "net decrease"-style uses change the grammar when swapped; leave those sentences alone.
  const before = sentence.slice(0, match.index).trim().split(/\s+/).pop()?.toLocaleLowerCase() ?? "";
  if (/^(?:more|less)$/i.test(match[0]) && /^(?:many|much|few|fewer)$/.test(before)) return null;
  const swapped = SWAP.get(match[0].toLocaleLowerCase())!;
  const word = /^[A-Z]/.test(match[0]) ? swapped[0].toLocaleUpperCase() + swapped.slice(1) : swapped;
  return sentence.slice(0, match.index) + word + sentence.slice((match.index ?? 0) + match[0].length);
}

const CONNECTOR = /\b(because|therefore|so that|which means|this means|leads to|results in|causes|as a result)\b/i;
const CONDITIONAL = /^(when|if|whenever|as|once|unless)\b/i;
const EXAMPLE = /\b(for example|for instance|such as|e\.g\.)\b/i;

const BULLET = /^\s*(?:[•◦▪▫●○■□‣⁃*–—-]|\(?\d{1,2}[.)]|\(?[a-z][.)])\s+/;
const NUMBERED = /^\s*\(?(\d{1,2})[.)]\s+/;

/**
 * One idea per unit: a bullet, a numbered step, a "term: meaning" line, or a sentence.
 * Bullet and step markers are removed so they never leak into questions.
 */
/**
 * A scan often loses the capital at the start of a line. When the line is still a whole sentence (it ends with a
 * stop and has the small joining words a sentence has), give the capital back so it can be asked about. A heading
 * row or a fragment keeps its lowercase start, and no question quotes it.
 */
function restoreCapital(line: string) {
  if (!/^[a-z]/.test(line) || !/[.!?]["”)]?$/.test(line)) return line;
  const words = line.toLocaleLowerCase().match(/[\p{L}']+/gu) ?? [];
  const glue = words.filter((word) => GLUE.has(word)).length;
  return words.length >= 6 && glue >= 2 ? line.charAt(0).toLocaleUpperCase() + line.slice(1) : line;
}

/** Words a sentence does not end on: a line that stops on one runs on into the next. */
const RUNS_ON = /(?:,|\b(?:and|or|but|of|to|the|a|an|in|on|at|by|for|with|from|between|into|than|that|which|as|is|are|was|were|its|their|et|ou|de|des|du|la|le|les|un|une|en|dans|par|pour|sur|avec|y|el|los|las))$/i;

/**
 * Whether a line is the wrapped rest of the one before: it starts in lowercase, or the line before stops on a word a
 * sentence cannot end on ("…in Africa and" / "Asia."). Separate slide bullets stay separate. (PDF pages are already
 * rejoined by line width when they are read.)
 */
/** "e.g." and "i.e." end in a full stop but never end a sentence. */
const ABBREVIATION_END = /(?:^|[\s(])(?:e\.g|i\.e|cf|vs|Fig|fig|Eq|eq|approx|Dr|Mr|Mrs|Ms|pp?)\.$/;

function wrapsInto(previous: string, line: string) {
  if (ABBREVIATION_END.test(previous)) return true;
  // A semicolon joins two halves of one point ("…positive outcomes;" / "stop behaviors…"); a full stop ends it.
  if (/[.!?:]["”)]?$/.test(previous) || (/;$/.test(previous) && !/^\p{Ll}/u.test(line))) return false;
  if (/^\p{Ll}/u.test(line)) return true;
  return RUNS_ON.test(previous);
}

export function units(text: string) {
  const out: string[] = [];
  // A PDF wraps long lines. A line that starts in lowercase continues the one before it.
  const lines: string[] = [];
  // On a slide, a point that starts in lowercase is a sub-point of the one above ("American openness" › "young
  // universities…" › "less tradition bound…"): alone it says nothing, so it joins its parent as "Parent: a; b".
  const parents = new Set<number>();
  for (const raw of text.split(/\n+/)) {
    const line = raw.trim();
    if (!line) continue;
    const point = line.replace(BULLET, "");
    const last = lines.length - 1;
    if (last >= 0 && BULLET.test(line) && /^\p{Ll}/u.test(point) && !/[.!?]["”)]?$/.test(lines[last])) {
      lines[last] = lines[last].replace(/:\s*$/, "") + (parents.has(last) ? "; " : ": ") + point;
      parents.add(last);
      continue;
    }
    if (lines.length && !BULLET.test(line) && wrapsInto(lines[lines.length - 1], line)) lines[lines.length - 1] += ` ${line}`;
    else lines.push(restoreCapital(line));
  }
  for (const line of lines) {
    // A caption keeps its fact and loses its label: "Figure 7.1 Oxygen diffuses…" is asked as "Oxygen diffuses…".
    const cleaned = line.replace(BULLET, "").replace(/^(?:figure|fig\.?|table|diagram|image|photo)\s*\d+(?:[.:-]\d+)*[.:)]?\s+(?=\p{Lu})/iu, "").replace(/\s+/g, " ").trim();
    if (!cleaned) continue;
    const parts = cleaned.length > 60 ? splitSentences(cleaned) : [cleaned];
    for (const part of parts) if (part.length >= 15) out.push(part);
  }
  return out;
}

/** Term/meaning pairs: "Term: meaning" or "Term - meaning". The term is short; the meaning says something. */
export function termPairs(text: string) {
  const pairs: Array<{ term: string; meaning: string; line: string }> = [];
  for (const line of units(text)) {
    const match = line.match(/^(\p{Lu}[\p{L}\p{N}₀-₉ /&'’()-]{1,40}?)\s*(?::|\s[-–—]\s)\s*(.{12,})$/u);
    if (!match) continue;
    const term = match[1].trim();
    if (term.split(/\s+/).length > 5) continue;
    pairs.push({ term, meaning: match[2].trim().replace(/[.]+$/, ""), line });
  }
  return pairs;
}

/** Numbered steps in the order the page gives them. */
export function numberedSteps(rawText: string) {
  const steps: Array<{ n: number; text: string }> = [];
  for (const line of rawText.split(/\n+/)) {
    const match = line.match(NUMBERED);
    if (match) steps.push({ n: Number(match[1]), text: line.replace(NUMBERED, "").replace(/\s+/g, " ").trim() });
  }
  return steps.length >= 3 && steps.every((step, index) => step.n === steps[0].n + index) ? steps : [];
}

export function splitSentences(text: string) {
  // A line that ends a sentence ends it, even when a scan starts the next line in lowercase ("…departure.\ncrew
  // rest minimum"): only a line with no closing stop is a wrapped sentence that carries on.
  return text
    .split(/(?<!(?:^|[\s(])(?:e\.g|i\.e|cf|vs|Fig|fig|Eq|eq|approx|Dr|Mr|Mrs|Ms|pp?)\.)(?<=[.!?]["”)]?)[ \t]*\n+/)
    .flatMap((block) => block.replace(/\s+/g, " ").split(/(?<!(?:^|[\s(])(?:e\.g|i\.e|cf|vs|Fig|fig|Eq|eq|approx|Dr|Mr|Mrs|Ms|pp?)\.)(?<=[.!?])\s+(?=[A-Z“"(])/))
    .map((part) => part.trim())
    .filter((part) => part.length >= 20);
}

function hash(value: string) {
  let h = 2166136261;
  for (const ch of value) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function words(sentence: string) {
  return sentence.match(/\p{L}[\p{L}'’-]+/gu) ?? [];
}

function stripEnd(sentence: string) {
  return sentence.replace(/[.!?]+$/, "").trim();
}

/** Short facts, in the page's own words, ordered as written. The first is usually the definition. */
export function teachingFacts(name: string, excerpt: string, limit = 4) {
  const seen = new Set<string>();
  const facts: string[] = [];
  for (const sentence of units(excerpt)) {
    const key = sentence.toLocaleLowerCase();
    if (seen.has(key) || sentence.length > 240) continue;
    seen.add(key);
    facts.push(sentence);
    if (facts.length >= limit) break;
  }
  return facts.length ? facts : [excerpt.slice(0, 220)];
}

const DETERMINER = new Set(["the", "a", "an", "its", "their", "this", "that", "these", "those", "of", "in", "on", "into", "inside", "by", "from", "at", "between", "per", "each", "every", "one", "two", "three", "four", "five", "called", "known", "as"]);
// Verbs and filler that read as a blank but test nothing.
const WEAK = new Set(["includes", "include", "included", "occurs", "occur", "produces", "produce", "takes", "make", "makes", "made", "uses", "used", "causes", "contains", "contain", "involves", "involve", "requires", "require", "allows", "allow", "gives", "give", "helps", "means", "called", "known", "based", "example", "examples", "several", "various", "different", "important", "usually", "often", "typically", "generally", "process", "result", "results", "number", "type", "types", "form", "forms", "part", "parts", "kind", "way", "ways", "tends", "tend", "first", "effect", "effects", "level", "levels", "amount", "value", "values",
  // Everyday nouns that any reader could guess: a gap on them tests reading, not the course.
  "country", "countries", "action", "actions", "research", "study", "studies", "data", "people", "person", "thing", "things",
  "time", "world", "group", "groups", "idea", "ideas", "case", "cases", "area", "areas", "system", "systems", "market",
  "carry", "carries", "certain", "whole", "always", "never", "rather", "simply"]);
/** Common words that open a multi-word name ("Black Hand", "New Deal"): half a name is not a fair gap. */
const NAME_OPENERS = new Set(["black", "white", "red", "blue", "green", "new", "old", "great", "united", "first", "second", "holy", "free", "young", "grand", "high", "low", "north", "south", "east", "west"]);

/**
 * The word or number that is the point of the sentence: a figure, an acronym, a named term, or a noun after
 * "the/of/in". Verbs and filler ("includes", "studying") are never blanked, and a sentence with nothing worth
 * testing makes no gap at all.
 */
function pickGapWord(sentence: string, name: string, page: string, relaxed = false) {
  const nameParts = new Set(words(name).map((w) => w.toLocaleLowerCase()));
  const counts = new Map<string, number>();
  for (const w of words(page)) counts.set(w.toLocaleLowerCase(), (counts.get(w.toLocaleLowerCase()) ?? 0) + 1);
  // A comma inside a number ("17,000") belongs to it; one after it ("than 1, demand") does not.
  const tokens = [...sentence.matchAll(/\d+(?:,\d{3})*(?:\.\d+)?|\p{L}[\p{L}\p{N}'’-]*/gu)];
  let best: { word: string; score: number } | null = null;
  tokens.forEach((match, index) => {
    const word = match[0];
    const lower = word.toLocaleLowerCase();
    const previous = tokens[index - 1]?.[0].toLocaleLowerCase() ?? "";
    const after = sentence.slice((match.index ?? 0) + word.length, (match.index ?? 0) + word.length + 6);
    const before = sentence.slice(Math.max(0, (match.index ?? 0) - 5), match.index ?? 0);
    const isNumber = /^\d/.test(word);
    const isAcronym = /^[A-Z][A-Z0-9]{1,}$/.test(word);
    const next = tokens[index + 1]?.[0] ?? "";
    const nextLower = next.toLocaleLowerCase();
    const before2 = tokens[index - 2]?.[0].toLocaleLowerCase() ?? "";
    if (nameParts.has(lower) || STOP.has(lower) || WEAK.has(lower)) return;
    // Inside a bracketed example ("(e.g. eBay auctions)") the word is the page's instance, not its idea.
    const opened = sentence.slice(0, match.index ?? 0);
    if (opened.lastIndexOf("(") > opened.lastIndexOf(")") && /\((?:e\.g|i\.e|eg|for example|such as|like)\b/i.test(opened.slice(opened.lastIndexOf("(")))) return;
    // A figure, table or slide number is a label, not a fact ("Figure _____ Oxygen diffuses…").
    if (isNumber && /^(?:figure|fig|table|slide|page|chapter|section|lecture|week|unit|part|step|equation|eq)$/.test(previous)) return;
    // Half of a name: "the _____ Hand group", or the second author in "Card and _____".
    if (/^[A-Z][a-z]/.test(word) && /^[A-Z][a-z]/.test(next) && NAME_OPENERS.has(lower)) return;
    if (/^[A-Z][a-z]/.test(word) && (previous === "and" || previous === "&") && /^[A-Z]/.test(tokens[index - 2]?.[0] ?? "")) return;
    // Inside a fixed phrase ("in terms of", "in order to", "as well as") the word carries no idea.
    if (/^(?:terms|order|addition|spite|case|view|respect|regard|well|least|most|fact|front|charge|favour|favor)$/.test(lower) && /^(?:in|as|at|of)$/.test(previous)) return;
    // A verb with its particle ("carry out", "set up") cannot be blanked as one word.
    if (/^(?:out|up|off|over|away|back)$/.test(nextLower) && !DETERMINER.has(previous)) return;
    // A word that appears twice in the sentence would need two blanks, and one inside a hyphenated compound
    // ("competitive" in "non-competitive") cannot be blanked cleanly. Pick a different word instead.
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if ((sentence.match(new RegExp(`(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`, "giu")) ?? []).length !== 1) return;
    if (new RegExp(`[\\p{L}\\p{N}_]-${escaped}(?![\\p{L}\\p{N}_])|(?<![\\p{L}\\p{N}_])${escaped}-[\\p{L}\\p{N}_]`, "iu").test(sentence)) return;
    // The comma in "17,000" is part of the number, so the gap is the whole figure.
    if (isNumber && (/^\s*(?:to|-|–|or)\s*\d/.test(after) || /\d\s*(?:to|-|–|or)\s*$/.test(before))) return;
    if (!isNumber && !isAcronym && word.length < (relaxed ? 6 : 5)) return;
    let score = 0;
    if (isNumber) score += 5;
    if (isAcronym) score += 4;
    if (index > 0 && /^[A-Z][a-z]/.test(word)) score += 3;
    if (DETERMINER.has(previous)) score += 3;
    if (/(?:ing|ed)$/.test(lower) && !DETERMINER.has(previous)) score -= 4;
    // A participle describing the next noun ("the swelling vacuole", "two armed camps"): the noun is the idea.
    if (/(?:ing|ed)$/.test(lower) && /^[a-z]{3,}$/.test(next) && !STOP.has(nextLower) && !GLUE_WORDS.has(nextLower)) score -= 5;
    // A size or limit word in front of its noun ("the small intestine", "minimum wage") is half of a compound term.
    if (/^(?:small|large|big|minimum|maximum|high|low|short|long|main|total|net|full|open|major|minor|upper|lower|outer|inner)$/.test(lower) && /^[a-z]{3,}$/.test(next) && !GLUE_WORDS.has(nextLower)) score -= 5;
    // The verb of a relative clause ("processes that _____ behavior") is grammar, not content.
    if (/^(?:that|which|who|whom)$/.test(previous)) score -= 3;
    // An example after "such as" / "e.g." is trivia: the page's point is the rule, not the instance.
    if (previous === "as" && before2 === "such" || /^(?:e\.g|eg|like|including)$/.test(previous)) score -= 4;
    // One item of a list ("the lungs and villi", "Africa and Asia") is arbitrary to recall on its own.
    if (/^(?:and|or)$/.test(nextLower) && !isNumber) score -= 2;
    if ((counts.get(lower) ?? 1) === 1) score += 1;
    if (word.length >= 8) score += 1;
    if (index === 0) score -= 2;
    if (score >= (relaxed ? 1 : 3) && (!best || score > best.score)) best = { word, score };
  });
  return best ? (best as { word: string }).word : null;
}

const GLUE_WORDS = new Set(["and", "or", "but", "is", "are", "was", "were", "be", "to", "of", "in", "on", "at", "by", "for", "with", "from", "as", "than", "that", "which"]);
const GLUE = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from", "and", "or", "but", "is", "are", "was", "were", "be", "been", "has", "have", "had", "it", "its", "this", "that", "these", "those", "as", "into", "not", "no", "can", "will", "when", "which", "who", "than", "so", "if", "their", "they", "each", "does", "do", "because", "while", "where", "how", "may", "must", "should", "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou", "mais", "est", "sont", "était", "être", "par", "pour", "dans", "sur", "avec", "sans", "qui", "que", "dont", "en", "au", "aux", "se", "ne", "pas"]);

/**
 * A line a student can fill in: it starts like a sentence and reads like one, with the small words that join a
 * sentence together. Headings and lists run together by a scan ("route time fight operation flight monitoring and
 * crew future fights") start mid-thought and have almost none, so no gap is made from them.
 */
export function readsAsSentence(sentence: string) {
  const text = sentence.trim().replace(/^[“"‘'(]+/, "");
  if (!/^[\p{Lu}\d]/u.test(text)) return false;
  const all = text.match(/[\p{L}']+/gu) ?? [];
  // Headings run together: most words after the first are capitalised ("Route Planning Flight Monitoring …").
  const rest = all.slice(1).filter((word) => word.length > 3);
  if (rest.length >= 4 && rest.filter((word) => /^\p{Lu}/u.test(word)).length / rest.length >= 0.5) return false;
  // A longer line with not one joining word is a list, not a sentence.
  return all.length <= 10 || all.some((word) => GLUE.has(word.toLocaleLowerCase()));
}

/**
 * Hides the topic name so the question does not give itself away. Only when the topic is the subject at the
 * start of the sentence and appears nowhere else: replacing it inside a longer phrase ("Price elasticity of
 * demand" for the topic "Elasticity") would break the sentence, so no question is made instead.
 */
function maskName(sentence: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lead = new RegExp(`^(?:the\\s+)?${escaped}(?![\\p{L}])`, "iu");
  if (!lead.test(sentence)) return null;
  const rest = sentence.replace(lead, "");
  if (new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "iu").test(rest)) return null;
  // A plural subject ("Market structures differ...") reads "These ideas", not "This idea differ".
  const plural = /^\s*(?:are|were|have|do|differ|vary|include|share|use|take|make|need|require|form|become|depend|determine)\b/i.test(rest);
  return `${plural ? "These ideas" : "This idea"}${rest}`;
}

export function buildPractice(input: {
  conceptId: string;
  name: string;
  excerpt: string;
  locator: string;
  siblingNames: string[];
  /** Sentences from the course's other topics: wrong options that are real, plausible and clearly off-topic. */
  siblingFacts?: string[];
}): PracticeItem[] {
  const { conceptId, name, excerpt, locator } = input;
  // Every question quotes a line from the notes, so each line must read as a sentence: never a heading row or a
  // fragment a scan cut loose ("crew rest minimum 10 hours duty time max"). Fall back to all lines only if none do.
  const allLines = units(excerpt);
  const readable = allLines.filter(readsAsSentence);
  const sentences = readable.length ? readable : allLines;
  const items: PracticeItem[] = [];
  const language = noteLanguage(excerpt);
  // A question with a visible defect is worse than none: the lint decides, not the generator's optimism.
  const add = (item: Omit<PracticeItem, "id" | "origin">) => {
    const candidate: PracticeItem = { level: "recall", ...item, id: `practice-${conceptId}-${items.length + 1}`, origin: "offline" };
    if (lintQuestion(candidate).length) return;
    // Checked in English, asked in the notes' own language.
    items.push(language === "en" ? candidate : { ...candidate, prompt: inNotesLanguage(candidate.prompt, language, name), hint: hintInNotesLanguage(candidate.hint, language) });
  };
  const definition = sentences.find((s) => s.toLocaleLowerCase().includes(name.toLocaleLowerCase())) ?? sentences[0];

  // 1. Identify the idea from its description, among the course's other topics.
  const others = [...new Set(input.siblingNames.filter((other) => other.toLocaleLowerCase() !== name.toLocaleLowerCase()))];
  const maskedDefinition = definition ? maskName(definition, name) : null;
  let usedDefinitionForIdea = false;
  if (definition && maskedDefinition && others.length >= 2) {
    usedDefinitionForIdea = true;
    const distractors = others.sort((a, b) => hash(`${conceptId}${a}`) - hash(`${conceptId}${b}`)).slice(0, 3);
    const choices = [name, ...distractors].sort((a, b) => hash(`${conceptId}x${a}`) - hash(`${conceptId}x${b}`));
    add({
      kind: "choice",
      prompt: `Which idea from your notes does this describe? “${stripEnd(maskedDefinition)}.”`,
      modelAnswer: name,
      hint: `Think about what ${locator} is mostly about.`,
      explanation: `${locator} says: “${definition}”`,
      sourceQuote: definition,
      choices,
      correctIndex: choices.indexOf(name),
    });
  }

  // 2. Why: a sentence that gives its own reason.
  const reasoned = sentences.find((s) => CONNECTOR.test(s) && s.length <= 240);
  if (reasoned) {
    const match = reasoned.match(CONNECTOR)!;
    const before = stripEnd(reasoned.slice(0, match.index)).replace(/[,;]\s*$/, "");
    if (before.length >= 18) {
      add({
        kind: "why",
        prompt: `Your notes say: “${before}.” Why does that happen? Explain it in your own words.`,
        modelAnswer: reasoned,
        hint: `Look for the word “${match[1].toLocaleLowerCase()}” on ${locator}.`,
        explanation: `The page connects the two: “${reasoned}”`,
        sourceQuote: reasoned,
      });
    }
  }

  // 3. Predict from a condition the page states.
  const conditional = sentences.find((s) => CONDITIONAL.test(s) && /,/.test(s) && s.length <= 240 && s !== reasoned);
  if (conditional) {
    const comma = conditional.indexOf(",");
    const condition = conditional.slice(0, comma).replace(CONDITIONAL, "").trim();
    const consequence = conditional.slice(comma + 1).trim();
    if (condition.length >= 6 && consequence.length >= 12) {
      add({
        kind: "scenario",
        prompt: `Suppose ${condition}. What does ${locator} say follows? Explain it in your own words.`,
        modelAnswer: conditional,
        hint: `The page states what happens in this case. Start from “${condition}”.`,
        explanation: `The page says: “${conditional}”`,
        sourceQuote: conditional,
      });
    }
  }

  // 3b. Understanding you can check instantly: why, how two ideas differ, which term a definition belongs to.
  const terms = [...new Set(sentences.map((sentence) => pickGapWord(sentence, name, excerpt, true)).filter((term): term is string => Boolean(term) && !/^\d/.test(term as string)))];
  const ctx = { conceptId, name, locator, sentences, siblingNames: input.siblingNames, others, terms };
  for (const draft of [...whyChoices(ctx), ...effectQuestions(ctx, flipOneWord), ...notMatching(ctx, flipOneWord), ...contrastChoices(ctx), ...framePairs(ctx), ...termFromMeaning(ctx)]) add(draft);

  // 4. Fill the gap in a key sentence: up to four, from different sentences with different words. A looser pass runs
  // only when the strict one leaves fewer than two, so a sparse topic still gets a short run.
  const usedGaps = new Set<string>();
  const gapSentences = new Set<string>();
  let gapsMade = 0;
  for (const relaxed of [false, true]) {
  if (relaxed && gapsMade >= 2) break;
  for (const sentence of sentences.slice(0, 10)) {
    if (gapSentences.has(sentence)) continue;
    if (sentence === definition && sentences.length > 1 && usedDefinitionForIdea) continue;
    if (words(sentence).length < 7 || sentence.length > 220 || !readsAsSentence(sentence) || !standsAlone(sentence)) continue;
    const pair = termPairs(sentence)[0];
    const gapSource = pair && sentence.includes(pair.meaning) ? pair.meaning : sentence;
    const gap = pickGapWord(gapSource, pair ? `${name} ${pair.term}` : name, excerpt, relaxed);
    if (!gap || usedGaps.has(gap.toLocaleLowerCase())) continue;
    usedGaps.add(gap.toLocaleLowerCase());
    gapSentences.add(sentence);
    // Every occurrence: a figure or term that appears twice would otherwise give the answer away.
    const blank = (value: string) => value.replace(new RegExp(`(?<![\\p{L}\\p{N}_-])${gap.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_-])`, "gu"), "_____").replace(/\b([Aa])n _____/g, "$1/an _____");
    const masked = pair && sentence.includes(pair.meaning) ? sentence.replace(pair.meaning, blank(pair.meaning)) : blank(sentence);
    add({
      kind: "cloze",
      // "Section 2" means nothing in pasted notes; a PDF page number does help.
      prompt: /^Section\b/.test(locator) ? `Fill the gap: “${masked}”` : `Fill the gap from ${locator}: “${masked}”`,
      modelAnswer: gap,
      hint: /^\d/.test(gap) ? "It is a number from the page." : `It is one word. It starts with “${gap[0]}” and has ${gap.length} letters.`,
      explanation: `The page says: “${sentence}”`,
      sourceQuote: sentence,
    });
    gapsMade += 1;
    if (gapsMade >= 4) break;
  }
  }

  // 4b. Terms and their meanings on this page: name the term from its meaning, using the page's other terms as options.
  const pairs = termPairs(excerpt).filter((pair) => pair.term.toLocaleLowerCase() !== name.toLocaleLowerCase());
  if (pairs.length >= 3) {
    const start = hash(conceptId) % pairs.length;
    for (let k = 0; k < Math.min(2, pairs.length); k += 1) {
      const target = pairs[(start + k) % pairs.length];
      const choices = pairs.map((pair) => pair.term).sort((x, y) => hash(`${conceptId}t${k}${x}`) - hash(`${conceptId}t${k}${y}`)).slice(0, 4);
      if (!choices.includes(target.term)) choices[0] = target.term;
      add({
        kind: "choice",
        prompt: `Which one matches: “${target.meaning}”?`,
        modelAnswer: target.term,
        hint: `These are the terms listed on ${locator}.`,
        explanation: `${locator}: “${target.line}”`,
        sourceQuote: target.line,
        choices,
        correctIndex: choices.indexOf(target.term),
      });
    }
  }

  // 4c. Steps in order: what comes next, for two different steps.
  const steps = numberedSteps(excerpt);
  if (steps.length >= 3) {
    const start = hash(conceptId) % (steps.length - 1);
    for (let k = 0; k < Math.min(2, steps.length - 1); k += 1) {
      const at = (start + k) % (steps.length - 1);
      const here = steps[at];
      const after = steps[at + 1];
      const options = steps.filter((step) => step !== after && step !== here).map((step) => step.text);
      const choices = [after.text, ...options.sort((x, y) => hash(`${conceptId}s${k}${x}`) - hash(`${conceptId}s${k}${y}`)).slice(0, 3)]
        .sort((x, y) => hash(`${conceptId}z${k}${x}`) - hash(`${conceptId}z${k}${y}`));
      add({
        kind: "choice",
        prompt: `In your notes, what comes right after: “${here.text}”?`,
        modelAnswer: after.text,
        hint: `The steps are numbered on ${locator}.`,
        explanation: `${locator} lists step ${here.n} then step ${after.n}: “${after.text}”`,
        sourceQuote: after.text,
        choices,
        correctIndex: choices.indexOf(after.text),
      });
    }
  }

  // 4d. Which statement is from your notes on this topic: a real sentence among sentences from the course's other topics.
  // A wrong option has to be clearly about something else: one that names this topic ("…normative economics debates
  // what should be") reads as true, and one that opens on "It" or "This" means nothing out of its own page.
  const nameWords = name.toLocaleLowerCase().split(/[^\p{L}]+/u).filter((word) => word.length >= 5 && !/^(?:introduction|overview|basics|model|models)$/.test(word));
  const namesTopic = (fact: string) => nameWords.some((word) => new RegExp(`\\b${word.slice(0, Math.max(5, word.length - 2))}`, "i").test(fact));
  const foreign = (input.siblingFacts ?? []).filter((fact) => fact.length >= 25 && fact.length <= 160 && !excerpt.includes(fact) && !namesTopic(fact) && standsAlone(fact));
  // And the right one must not name the topic either: when it is the only option that says "cross-price elasticity"
  // under a question about cross-price elasticity, the question answers itself.
  const statements = sentences.filter((sentence) => sentence.length >= 25 && sentence.length <= 160 && standsAlone(sentence) && !namesTopic(sentence));
  if (foreign.length >= 3) {
    const start = hash(conceptId) % Math.max(1, statements.length);
    for (let k = 0; k < Math.min(2, statements.length); k += 1) {
      const real = statements[(start + k) % statements.length];
      const wrong = [...new Set(foreign)].sort((x, y) => hash(`${conceptId}w${k}${x}`) - hash(`${conceptId}w${k}${y}`)).slice(0, 3);
      const choices = [real, ...wrong].sort((x, y) => hash(`${conceptId}v${k}${x}`) - hash(`${conceptId}v${k}${y}`));
      add({
        kind: "choice",
        prompt: `Which of these is from your notes on ${name}?`,
        modelAnswer: real,
        hint: `Think about what ${locator} says.`,
        explanation: `${locator}: “${real}”`,
        sourceQuote: real,
        choices,
        correctIndex: choices.indexOf(real),
      });
    }
  }

  // 4e. Predict the direction: a rule from the notes with one word to choose ("increases" or "decreases", "more" or
  // "less"). Only the two words are shown, so there is no flipped sentence to read badly or to give itself away.
  const rules = sentences
    .filter((sentence) => sentence.length >= 40 && sentence.length <= 200)
    .map((sentence) => ({ sentence, flipped: flipOneWord(sentence) }))
    .filter((entry) => entry.flipped !== null)
    .sort((x, y) => hash(`${conceptId}f${x.sentence}`) - hash(`${conceptId}f${y.sentence}`))
    .slice(0, 2);
  for (const entry of rules) {
    const original = [...entry.sentence.matchAll(/[A-Za-z]+(?: (?:left|right))?/g)].find((match) => SWAP.has(match[0].toLocaleLowerCase()));
    if (!original) continue;
    const word = original[0];
    const opposite = SWAP.get(word.toLocaleLowerCase())!;
    const blanked = (entry.sentence.slice(0, original.index) + "_____" + entry.sentence.slice((original.index ?? 0) + word.length)).replace(/\b([Aa])n? _____/g, "$1/an _____");
    const options = [word.toLocaleLowerCase(), opposite].sort((x, y) => hash(`${conceptId}d${entry.sentence}${x}`) - hash(`${conceptId}d${entry.sentence}${y}`));
    const reasoning = /\b(?:when|if|because|so|than|as|while|whereas|therefore)\b/i.test(entry.sentence);
    add({
      kind: "choice",
      variant: "direction",
      level: reasoning ? "understand" : "recall",
      prompt: `Which word completes this statement from your notes? “${stripEnd(blanked)}.”`,
      modelAnswer: word.toLocaleLowerCase(),
      hint: `Think about what ${locator} says happens, and why.`,
      explanation: `${locator}: “${entry.sentence}”`,
      sourceQuote: entry.sentence,
      choices: options,
      correctIndex: options.indexOf(word.toLocaleLowerCase()),
    });
  }

  // 5. Recall the definition in the learner's own words.
  if (definition) {
    add({
      kind: "recall",
      prompt: `In your own words, what do your notes say about ${name}?`,
      modelAnswer: definition,
      hint: `Return to ${locator}. Start from what it is, then one detail.`,
      explanation: `The page says: “${definition}”`,
      sourceQuote: definition,
    });
  }
  return items;
}

/** A practice item is only kept if its quote is really on the page. */
export function quoteIsOnPage(quote: string, pageText: string) {
  const normalise = (value: string) => value.toLocaleLowerCase().replace(/[“”"'’‘]/g, "").replace(/\s+/g, " ").trim();
  const q = normalise(quote);
  return q.length >= 12 && normalise(pageText).includes(q);
}
