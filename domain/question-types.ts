import type { PracticeItem } from "./types";

/**
 * Questions that ask for understanding, not just a word: why something happens, what a rule predicts, how two
 * ideas differ, which term a definition belongs to. Each is checkable instantly, built only from the page, and
 * every wrong option is something the page (or its course) really says, so a student has to think to rule it out.
 */

type Draft = Omit<PracticeItem, "id" | "origin">;
type Ctx = { conceptId: string; name: string; locator: string; sentences: string[]; siblingNames: string[]; others: string[]; /** Key words from this page: wrong options that belong to the same topic. */ terms: string[]; /** Lines from the course's other topics: real statements, true of something else. */ foreign?: string[] };

function h(value: string) {
  let out = 2166136261;
  for (const ch of value) { out ^= ch.charCodeAt(0); out = Math.imul(out, 16777619); }
  return out >>> 0;
}
const shuffle = <T,>(items: T[], seed: string, text: (item: T) => string = String as unknown as (item: T) => string) => [...items].sort((a, b) => h(`${seed}${text(a)}`) - h(`${seed}${text(b)}`));
const strip = (sentence: string) => sentence.replace(/[.!?]+["”]?$/, "").trim();
const cap = (text: string) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const PRONOUN_START = /^(?:it|they|this|these|that|those|he|she|its|their|there)\b/i;

export const VERBS = "is|are|was|were|has|have|had|binds|bind|moves|move|uses|use|produces|produce|requires|require|gains|gain|loses|lose|dissociates|dissociate|causes|cause|increases|increase|decreases|decrease|shifts|shift|reduces|reduce|raises|raise|lowers|lower|takes|take|runs|run|works|work|stores|store|needs|need|means|mean|occurs|occur|describes|describe|ignores|ignore|allows|allow|provides|provide|splits|split|speeds|speed|measures|measure|states|state|resolves|resolve|gives|give|ends|end|forms|form|slopes|slope|lasts|last|finds|find|stays|stay|acts|act|points|point|exerts|exert|equals|equal|depends|depend|keeps|keep|stops|stop|sets|set|stand|stands|remain|remains|become|becomes|travels|travel|absorbs|absorb|releases|release|converts|convert|carries|carry|controls|control|regulates|regulate|protects|protect|contains|contain|includes|include|consists|consist|helps|help|leads|lead|breaks|break|joins|join|attaches|attach|enters|enter|leaves|leave|creates|create|destroys|destroy|waits|wait|drops|drop|grows|grow|falls|fall|rises|rise|blamed|declared|wanted|competed|built|showed|mobilised|mobilized|entered|invaded|signed|joined|promised|launched|killed|began|started|led|won|lost|became|caused|supported|formed|ruled|fought|attacked|believed|threatened|feared|made|gave|took|used|produced|moved|released|absorbed|increased|decreased|reduced|raised|created|destroyed|introduced|ended|divided|united";

/** "A competitive inhibitor binds the active site" → { subject: "a competitive inhibitor", predicate: "binds the active site" }. */
export function subjectPredicate(clause: string): { subject: string; predicate: string } | null {
  const text = strip(clause).replace(/^(?:however|therefore|thus|also|in addition),?\s+/i, "");
  const match = text.match(new RegExp(`^((?:an?|the|each|every)\\s+)?((?:[A-Za-z][A-Za-z'’-]*\\s+){0,4}?[A-Za-z][A-Za-z'’-]*?)\\s+((?:${VERBS})\\b.*)$`, "i"));
  if (!match) return null;
  const subject = `${match[1] ?? ""}${match[2]}`.trim();
  const predicate = match[3].trim();
  if (words(subject) > 5 || words(predicate) < 2 || PRONOUN_START.test(subject)) return null;
  return { subject, predicate };
}

/** "X … because Y": the effect and the reason, when the effect stands on its own. */
function becauseParts(sentence: string) {
  const match = sentence.match(/^(.{18,}?),?\s+because\s+(?!of\b)(.{12,})$/i);
  if (!match) return null;
  const effect = strip(match[1]).replace(/[,;]\s*$/, "");
  const reason = strip(match[2]);
  if (PRONOUN_START.test(effect) || words(reason) < 3 || words(reason) > 22 || words(effect) < 4) return null;
  return { effect, reason };
}

const similarLength = (target: string, candidate: string) => candidate.length >= target.length * 0.5 && candidate.length <= target.length * 1.8;

/** Why: pick the reason the notes give. Wrong options are other reasons the same notes give for other things. */
export function whyChoices(ctx: Ctx): Draft[] {
  const parts = ctx.sentences.map((sentence) => ({ sentence, parts: becauseParts(sentence) })).filter((entry) => entry.parts !== null) as Array<{ sentence: string; parts: { effect: string; reason: string } }>;
  const out: Draft[] = [];
  for (const entry of parts.slice(0, 3)) {
    const wrong = parts.filter((other) => other.sentence !== entry.sentence && similarLength(entry.parts.reason, other.parts.reason) && other.parts.reason.toLocaleLowerCase() !== entry.parts.reason.toLocaleLowerCase()).map((other) => other.parts.reason);
    // Reasons the notes give elsewhere in the course: each explains something real, only one explains this.
    if (wrong.length < 3) {
      const elsewhere = (ctx.foreign ?? []).map(becauseParts).filter((other): other is { effect: string; reason: string } => other !== null && similarLength(entry.parts.reason, other.reason) && other.reason.toLocaleLowerCase() !== entry.parts.reason.toLocaleLowerCase()).map((other) => other.reason);
      wrong.push(...shuffle([...new Set(elsewhere)], `${ctx.conceptId}f${entry.sentence}`).slice(0, 3 - wrong.length));
    }
    // With fewer than two other reasons, other true statements from the same page work as wrong options:
    // they are real, on-topic, and only one of them explains this effect.
    if (wrong.length < 2) {
      const statements = ctx.sentences
        .filter((other) => other !== entry.sentence && !PRONOUN_START.test(other) && !/\bbecause\b/i.test(other) && similarLength(entry.parts.reason, strip(other)) && !other.toLocaleLowerCase().includes(entry.parts.effect.toLocaleLowerCase().slice(0, 24)))
        .map(strip);
      wrong.push(...shuffle(statements, `${ctx.conceptId}s${entry.sentence}`).slice(0, 3 - wrong.length));
    }
    // A short topic: true statements from the course's other topics, which explain nothing here.
    if (wrong.length < 2) {
      const elsewhere = (ctx.foreign ?? []).filter((other) => !PRONOUN_START.test(other) && !/\bbecause\b/i.test(other) && strip(other).length >= entry.parts.reason.length * 0.5 && strip(other).length <= entry.parts.reason.length * 2.4).map(strip);
      wrong.push(...shuffle(elsewhere, `${ctx.conceptId}e${entry.sentence}`).slice(0, 3 - wrong.length));
    }
    if (wrong.length < 2) continue;
    const reasons = [entry.parts.reason, ...shuffle(wrong, `${ctx.conceptId}${entry.sentence}`).slice(0, 3)];
    const choices = shuffle(reasons, `${ctx.conceptId}y${entry.sentence}`).map(cap);
    out.push({
      kind: "choice",
      variant: "why",
      level: "understand",
      prompt: `Why, according to your notes? “${cap(entry.parts.effect)}.”`,
      modelAnswer: cap(entry.parts.reason),
      hint: `Look for the word “because” on ${ctx.locator}.`,
      explanation: `${ctx.locator}: “${entry.sentence}”`,
      sourceQuote: entry.sentence,
      choices,
      correctIndex: choices.indexOf(cap(entry.parts.reason)),
    });
  }
  return out;
}

/** The verb's form, so every ending agrees with the subject and with each other: "uses", "use" or "blamed". */
const verbForm = (predicate: string) => {
  const verb = predicate.split(/\s+/)[0].toLocaleLowerCase();
  if (/^(?:was|were|had|did|made|built|began|led|won|lost|became|fought|gave|took|shot|held|kept|left|brought|thought|sought|grew|drew|rose|fell)$/.test(verb) || /ed$/.test(verb)) return "past";
  if (/^(?:is|has|does)$/.test(verb) || /[^s]s$/.test(verb)) return "one";
  return "many";
};
/** A subject that names a thing: not a condition ("If PED"), a time ("Before 1914") or a clause cut off ("A good that"). */
const wholeSubject = (subject: string) => !/^(?:if|when|whenever|as|once|unless|although|though|because|before|after|while|in|on|at|during|since|until|for|by|with|without)\b/i.test(subject) && !/\b(?:that|which|who|whose|where|and|or|of)$/i.test(subject);
const contentWords = (text: string) => new Set(text.toLocaleLowerCase().match(/\p{L}{4,}/gu) ?? []);

/**
 * Finish the line: the subject from the notes, and what it does, among what other things in the same course do.
 * "Aerobic respiration …" → "uses oxygen and produces carbon dioxide and water" against "are used, and oxygen is
 * released as a by-product" (photosynthesis): the mix-ups a student really makes between topics. Wrong options come
 * only from other topics, so none of them is also true of this subject's own topic; each agrees with the subject in
 * number, so grammar never gives the answer away.
 */
export function predicateChoices(ctx: Ctx): Draft[] {
  const elsewhere = (ctx.foreign ?? [])
    .map((sentence) => subjectPredicate(sentence))
    .filter((sp): sp is { subject: string; predicate: string } => sp !== null && wholeSubject(sp.subject) && words(sp.predicate) >= 3 && !PRONOUN_START.test(sp.predicate));
  const out: Draft[] = [];
  // The topic's own definition is what the explanation asks for, so the other lines come first.
  const namesTopic = (sentence: string) => sentence.toLocaleLowerCase().startsWith(ctx.name.toLocaleLowerCase());
  for (const sentence of [...ctx.sentences.filter((s) => !namesTopic(s)), ...ctx.sentences.filter(namesTopic)]) {
    const sp = subjectPredicate(sentence);
    if (!sp || !wholeSubject(sp.subject) || words(sp.predicate) < 3 || words(sp.predicate) > 18 || words(sp.subject) < 1) continue;
    // "Photosynthesis is …" asked of Photosynthesis is fine; a subject that is only a frame word is not.
    if (/^(?:most|some|many|all|one|each|both)(?:\s+of)?(?:\s+the)?$/i.test(sp.subject)) continue;
    const own = contentWords(sp.predicate);
    const wrong = [...new Set(elsewhere
      .filter((other) => other.subject.toLocaleLowerCase() !== sp.subject.toLocaleLowerCase()
        && verbForm(other.predicate) === verbForm(sp.predicate)
        && similarLength(sp.predicate, other.predicate)
        // Not a near copy of the right answer: at most half its key words shared.
        && [...contentWords(other.predicate)].filter((word) => own.has(word)).length <= Math.max(1, own.size / 2))
      .map((other) => other.predicate))];
    if (wrong.length < 2) continue;
    const choices = shuffle([sp.predicate, ...shuffle(wrong, `${ctx.conceptId}p${sentence}`).slice(0, 3)], `${ctx.conceptId}q${sentence}`).map((choice) => `… ${choice}`);
    const answer = `… ${sp.predicate}`;
    out.push({
      kind: "choice",
      variant: "complete",
      level: "recall",
      prompt: `Finish the line from your notes: “${cap(sp.subject)} …”`,
      modelAnswer: answer,
      hint: `The other endings are true of other topics in this course.`,
      explanation: `${ctx.locator}: “${sentence}”`,
      sourceQuote: sentence,
      choices,
      correctIndex: choices.indexOf(answer),
    });
    if (out.length >= 3) break;
  }
  return out;
}

const CONTRAST = /^(.{20,}?)(?:,|;)\s+(?:while|whereas)\s+(.{20,})$|^unlike\s+(.{8,}?),\s+(.{20,})$/i;

/** Contrast: which of two things does this describe? Wrong options are what the other thing does, or what a different idea on the page does. */
export function contrastChoices(ctx: Ctx): Draft[] {
  const out: Draft[] = [];
  for (const sentence of ctx.sentences) {
    const match = strip(sentence).match(CONTRAST);
    if (!match || match[3]) continue;
    const left = subjectPredicate(match[1]);
    const right = subjectPredicate(match[2]);
    if (!left || !right) continue;
    if (left.subject.toLocaleLowerCase() === right.subject.toLocaleLowerCase()) continue;
    const askLeft = h(`${ctx.conceptId}${sentence}`) % 2 === 0;
    const [target, other] = askLeft ? [left, right] : [right, left];
    const strangers = ctx.sentences
      .filter((s) => s !== sentence)
      .map((s) => subjectPredicate(s))
      .filter((sp): sp is { subject: string; predicate: string } => sp !== null && similarLength(target.predicate, sp.predicate) && sp.predicate.toLocaleLowerCase() !== target.predicate.toLocaleLowerCase());
    const options = [target.predicate, other.predicate, ...shuffle(strangers, `${ctx.conceptId}z${sentence}`, (sp) => sp.predicate).slice(0, 1).map((sp) => sp.predicate)];
    if (options.length < 3) continue;
    const choices = shuffle(options, `${ctx.conceptId}c${sentence}`).map(cap);
    const subject = target.subject.replace(/^(?:a|an|the|each|every)\s+/i, "");
    out.push({
      kind: "choice",
      variant: "match",
      level: "understand",
      prompt: `According to your notes, which describes ${/^(?:a|an|the)\b/i.test(target.subject) ? target.subject.toLocaleLowerCase() : subject}?`,
      modelAnswer: cap(target.predicate),
      hint: `${ctx.locator} compares two things in one sentence.`,
      explanation: `${ctx.locator}: “${sentence}”`,
      sourceQuote: sentence,
      choices,
      correctIndex: choices.indexOf(cap(target.predicate)),
    });
    if (out.length >= 2) break;
  }
  return out;
}

/** Which term does this definition belong to? "X is Y" statements; other terms on the page or in the course are the options. */
export function termFromMeaning(ctx: Ctx): Draft[] {
  const defs: Array<{ term: string; meaning: string; sentence: string }> = [];
  for (const sentence of ctx.sentences) {
    const match = strip(sentence).match(/^((?:[A-Z][A-Za-z'’-]*)(?:\s+[A-Za-z'’-]+){0,3}?)\s+(?:is|are|means|refers to)\s+((?:an?|the|something|when|any|one)\s.{20,})$/);
    if (!match) continue;
    const term = match[1].trim();
    if (term.toLocaleLowerCase() === ctx.name.toLocaleLowerCase() || PRONOUN_START.test(term) || words(term) > 4) continue;
    // "The core of microeconomics is the study of …" points at a part of something, it is not a term to name.
    if (/^the\s+\w+\s+(?:of|behind|in)\b/i.test(term)) continue;
    // "Factorial is a classic example: …" describes an example, not what the word means.
    if (/^(?:an? )?(?:classic |common |simple |typical )?example\b|:/.test(match[2])) continue;
    defs.push({ term, meaning: match[2].trim(), sentence });
  }
  const out: Draft[] = [];
  for (const def of defs.slice(0, 2)) {
    // Distractors must come from this topic's own page. Other topics are not plausible terms for this definition.
    const single = words(def.term) === 1;
    const onPage = [...defs.filter((d) => d !== def).map((d) => d.term), ...ctx.terms.map((t) => (single ? cap(t) : t))];
    const inMeaning = (t: string) => def.meaning.toLocaleLowerCase().includes(t.toLocaleLowerCase());
    // A wrong option is another term: not a piece of the right one ("analysis" for "Positive analysis") and not a
    // whole statement ("Supply curve is upward-sloping").
    const piece = (t: string) => new RegExp(`(?:^|\\s)${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(def.term) || new RegExp(`(?:^|\\s)${def.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|$)`, "i").test(t);
    const eligible = (t: string) => t.toLocaleLowerCase() !== def.term.toLocaleLowerCase() && !inMeaning(t) && !piece(t) && !/\s(?:is|are|was|were)\s/i.test(t) && Math.abs(words(t) - words(def.term)) <= 1;
    const pool = [...new Set(onPage)].filter(eligible);
    const wrong = shuffle(pool, `${ctx.conceptId}${def.term}`).slice(0, 3);
    if (wrong.length < 2) continue;
    const choices = shuffle([def.term, ...wrong], `${ctx.conceptId}m${def.term}`);
    out.push({
      kind: "choice",
      variant: "match",
      level: "recall",
      prompt: `Which term does this describe? “${cap(def.meaning)}.”`,
      modelAnswer: def.term,
      hint: `The term is defined on ${ctx.locator}.`,
      explanation: `${ctx.locator}: “${def.sentence}”`,
      sourceQuote: def.sentence,
      choices,
      correctIndex: choices.indexOf(def.term),
    });
  }
  return out;
}

/**
 * Two sentences built the same way that differ in one key word ("In a hypotonic solution …" / "In a hypertonic
 * solution …") are the classic mix-up. One question asks which ending belongs to which case, with the other case's
 * ending as the wrong option, so a student has to tell the two apart instead of filling the same gap twice.
 */
export function framePairs(ctx: Ctx): Draft[] {
  const out: Draft[] = [];
  const tokens = ctx.sentences.map((sentence) => strip(sentence).split(/\s+/));
  // The ending is what the case leads to; a trailing "because …" reason is a separate question.
  const ending = (rest: string[]) => rest.join(" ").replace(/,?\s+(?:because|since|so that|as a result)\b.*$/i, "").trim();
  for (let i = 0; i < tokens.length; i += 1) {
    for (let j = i + 1; j < tokens.length; j += 1) {
      const [a, b] = [tokens[i], tokens[j]];
      let p = 0;
      while (p < a.length && p < b.length && a[p].toLocaleLowerCase() === b[p].toLocaleLowerCase()) p += 1;
      if (p < 2 || p > 6 || p >= a.length - 3 || p >= b.length - 3) continue;
      const [one, two] = [a[p], b[p]];
      if (one.length < 4 || two.length < 4 || !/^[A-Za-z-]+$/.test(one + two)) continue;
      // Words shared right after the key word ("solution") stay in the prompt.
      let s = p + 1;
      while (s < a.length && s < b.length && a[s].toLocaleLowerCase() === b[s].toLocaleLowerCase() && s - p <= 2) s += 1;
      const endA = ending(a.slice(s));
      const endB = ending(b.slice(s));
      if (words(endA) < 3 || words(endB) < 3 || words(endA) > 14 || words(endB) > 14 || endA.toLocaleLowerCase() === endB.toLocaleLowerCase()) continue;
      const askB = h(`${ctx.conceptId}${ctx.sentences[i]}`) % 2 === 0;
      const [target, wrong, sentence, other] = askB ? [endB, endA, ctx.sentences[j], ctx.sentences[i]] : [endA, endB, ctx.sentences[i], ctx.sentences[j]];
      const stem = (askB ? b : a).slice(0, s).join(" ");
      const choices = shuffle([cap(target), cap(wrong)], `${ctx.conceptId}p${sentence}`);
      out.push({
        kind: "choice",
        variant: "pair",
        level: "understand",
        prompt: `Your notes describe two cases. Which ending is right? “${stem} …”`,
        modelAnswer: cap(target),
        hint: `${ctx.locator} compares “${one}” and “${two}”.`,
        explanation: `${ctx.locator}: “${sentence}” and “${other}”`,
        sourceQuote: sentence,
        choices,
        correctIndex: choices.indexOf(cap(target)),
      });
      if (out.length >= 2) return out;
    }
  }
  return out;
}

const CONDITION = /^(when|if|whenever|once)\s+(.{8,}?),\s+(.{12,})$/i;
const sameish = (a: string, b: string) => a.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() === b.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * "What happens when …?" from the page's own if/when sentences. The right answer is what the notes say follows; the
 * wrong ones are what follows in the page's other cases, or the same outcome reversed, so each is a real mix-up.
 */
export function effectQuestions(ctx: Ctx, flip: (sentence: string) => string | null): Draft[] {
  const cases = ctx.sentences
    .map((sentence) => ({ sentence, match: strip(sentence).match(CONDITION) }))
    .filter((entry): entry is { sentence: string; match: RegExpMatchArray } => Boolean(entry.match) && !PRONOUN_START.test(entry.match![3]));
  const out: Draft[] = [];
  for (const { sentence, match } of cases) {
    const [, word, condition, outcome] = match;
    if (words(outcome) > 18 || words(condition) > 14) continue;
    const wrong = [
      ...cases.filter((other) => other.sentence !== sentence).map((other) => other.match[3]),
      ...ctx.sentences.filter((other) => other !== sentence).map((other) => subjectPredicate(other)).filter((sp): sp is { subject: string; predicate: string } => sp !== null).map((sp) => `${sp.subject} ${sp.predicate}`),
    ]
      // A wrong option must be an outcome, not another case ("When demand is elastic, …") or a definition of this one.
      .filter((text) => words(text) <= 18 && !sameish(text, outcome) && !CONDITION.test(strip(text)) && !/\bwhen\b|\bif\b/i.test(text));
    const reversed = flip(outcome);
    const pool = [...new Set([...(reversed ? [reversed] : []), ...shuffle(wrong, `${ctx.conceptId}e${sentence}`)])].filter((text) => !sameish(text, outcome)).slice(0, 3);
    if (pool.length < 2) continue;
    const answer = cap(outcome);
    const choices = shuffle([answer, ...pool.map(cap)], `${ctx.conceptId}eo${sentence}`);
    out.push({
      kind: "choice",
      variant: "predict",
      level: "understand",
      prompt: `According to your notes, what happens ${word.toLocaleLowerCase()} ${condition}?`,
      modelAnswer: answer,
      hint: `${ctx.locator} says what follows ${word.toLocaleLowerCase()} ${condition}.`,
      explanation: `${ctx.locator}: “${sentence}”`,
      sourceQuote: sentence,
      choices,
      correctIndex: choices.indexOf(answer),
    });
    if (out.length >= 3) break;
  }
  return out;
}

/** Only direction words are turned around here, so the changed line is clearly false and still reads as English. */
const SAFE_FLIPS = new Set(["increase", "increases", "decrease", "decreases", "increased", "decreased", "raises", "raise", "lowers", "lower", "higher", "more", "less", "above", "below", "gains", "loses", "gain", "lose", "elastic", "inelastic", "rises", "falls", "rise", "fall", "up", "down", "left", "right", "positive", "negative", "faster", "slower", "larger", "smaller", "greater"]);
function safeFlip(original: string, changed: string) {
  const a = original.split(/\s+/);
  const b = changed.split(/\s+/);
  if (a.length !== b.length) return false;
  const at = a.findIndex((word, index) => word !== b[index]);
  if (at < 0) return false;
  const was = a[at].toLocaleLowerCase().replace(/[^a-z]/g, "");
  const now = b[at].toLocaleLowerCase().replace(/[^a-z]/g, "");
  if (!SAFE_FLIPS.has(was) || !SAFE_FLIPS.has(now)) return false;
  // "a elastic" / "an inelastic" read wrong: keep the article right or skip the line.
  const before = (a[at - 1] ?? "").toLocaleLowerCase();
  if ((before === "a" && /^[aeiou]/.test(now)) || (before === "an" && !/^[aeiou]/.test(now))) return false;
  return true;
}

/**
 * "Which of these does NOT match your notes?": three lines exactly as written, and one with its key word turned
 * around (increases → decreases). Finding the odd one out means knowing what the notes really say.
 */
/**
 * True or false: one line from the notes, shown either as it is or with one word turned around (the same safe flips
 * "does NOT match" uses), so the answer is never "always true". Quick to answer, and the flip tests the direction of
 * an idea, not just its words.
 */
export function trueOrFalse(ctx: Ctx, flip: (sentence: string) => string | null): Draft[] {
  const usable = ctx.sentences.filter((sentence) => sentence.length >= 40 && sentence.length <= 170 && !PRONOUN_START.test(sentence));
  for (const sentence of shuffle(usable, `${ctx.conceptId}tf`)) {
    const changed = flip(sentence);
    if (!changed || !safeFlip(sentence, changed)) continue;
    // Which way it is shown comes from the line itself, so it is stable across visits but not always the same.
    const showTrue = shuffle([true, false], `${ctx.conceptId}tf${sentence}`)[0];
    const shown = showTrue ? sentence : changed;
    const choices = ["True", "False"];
    return [{
      kind: "choice",
      variant: "truefalse",
      level: "understand",
      prompt: `True or false, from your notes: “${shown}”`,
      modelAnswer: showTrue ? "True" : "False",
      hint: "Read it slowly: one word can turn the idea around.",
      explanation: showTrue ? `That is what the notes say: “${sentence}”` : `The notes say: “${sentence}”`,
      sourceQuote: sentence,
      choices,
      correctIndex: showTrue ? 0 : 1,
    }];
  }
  return [];
}

export function notMatching(ctx: Ctx, flip: (sentence: string) => string | null): Draft[] {
  const usable = ctx.sentences.filter((sentence) => sentence.length <= 170 && !PRONOUN_START.test(sentence));
  for (const sentence of shuffle(usable, `${ctx.conceptId}n`)) {
    const changed = flip(sentence);
    if (!changed || !safeFlip(sentence, changed)) continue;
    const truths = shuffle(usable.filter((other) => other !== sentence), `${ctx.conceptId}nt${sentence}`).slice(0, 3);
    if (truths.length < 3) continue;
    const choices = shuffle([changed, ...truths], `${ctx.conceptId}no${sentence}`);
    return [{
      kind: "choice",
      variant: "notone",
      level: "understand",
      prompt: `Which of these does NOT match your notes on ${ctx.name}?`,
      modelAnswer: changed,
      hint: "Three are exactly what the notes say. One has a word turned around.",
      explanation: `The notes say: “${sentence}”`,
      sourceQuote: sentence,
      choices,
      correctIndex: choices.indexOf(changed),
    }];
  }
  return [];
}
