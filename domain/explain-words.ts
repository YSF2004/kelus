/**
 * Word matching for a student's own explanation, without AI: word families ("movement" and "moves"), a short list of
 * everyday words that mean the same in revision answers ("rises" and "increases"), and their opposites ("loses" where
 * the page says "gains"). Every group is written out by hand, so nothing is inferred from arbitrary prose.
 */

const SUFFIXES = ["izations", "isations", "ization", "isation", "ational", "fulness", "iveness", "ations", "ation", "ments", "ment", "nesses", "ness", "ities", "ity", "ically", "ical", "ally", "ings", "ing", "ies", "ied", "ers", "er", "ed", "es", "ly", "s"];

/** The shared root of a word family: "movement", "moves" and "moving" all give "mov…". */
export function family(word: string) {
  let base = word.toLocaleLowerCase().replace(/[^\p{L}\p{N}-]+/gu, "");
  for (const suffix of SUFFIXES) {
    // "moving" and "making" keep their e: "mov" + e, "mak" + e.
    if ((suffix === "ing" || suffix === "ed") && base.length - suffix.length === 3 && base.endsWith(suffix)) {
      base = `${base.slice(0, -suffix.length)}e`;
      break;
    }
    if (base.length - suffix.length >= 4 && base.endsWith(suffix)) {
      base = suffix === "ies" || suffix === "ied" ? `${base.slice(0, -suffix.length)}y` : base.slice(0, -suffix.length);
      // "stopped", "stopping": the doubled consonant belongs to the ending, so the root is "stop" (never "pass" → "pas").
      if ((suffix === "ed" || suffix === "ing" || suffix === "er" || suffix === "ers") && /([b-df-hj-np-rtv-z])\1$/.test(base) && !/(?:ss|ll|ff|zz)$/.test(base)) base = base.slice(0, -1);
      break;
    }
  }
  // A trailing silent e is not part of the root: "move" and "mov(ing)", "dilute" and "dilut(ion)".
  return base.length > 4 && base.endsWith("e") ? base.slice(0, -1) : base;
}

/** Two roots are one word when one is the other, or they share a long start: "concentrat(ed)" and "concentrat(ion)". */
export function sameFamily(a: string, b: string) {
  if (a === b) return true;
  let shared = 0;
  while (shared < a.length && shared < b.length && a[shared] === b[shared]) shared += 1;
  return shared >= 5 && shared >= Math.min(a.length, b.length) * 0.8;
}

/** Groups of words a student may use for the same idea. The first word names the group. */
const GROUPS: string[][] = [
  ["increase", "rise", "grow", "raise", "higher", "greater", "boost", "go-up", "goes-up", "went-up"],
  ["decrease", "reduce", "fall", "drop", "decline", "lower", "shrink", "go-down", "goes-down", "went-down"],
  ["gain", "absorb", "take-in", "takes-in", "took-in", "enter", "intake", "uptake"],
  ["lose", "loss", "release", "leave", "give-off", "gives-off", "gave-off", "remove", "lost"],
  ["fast", "faster", "quick", "quicker", "rapid", "speed-up", "speeds-up", "accelerate"],
  ["slow", "slower", "slow-down", "slows-down", "delay"],
  ["cause", "lead-to", "leads-to", "result-in", "results-in", "produce", "trigger", "create"],
  ["large", "big", "huge"],
  ["small", "little", "tiny"],
  ["inside", "internal"],
  ["outside", "out-of", "external"],
  ["same", "equal", "identical", "constant"],
  ["different", "unequal", "vary"],
  ["positive", "direct"],
  ["negative", "inverse"],
  ["allow", "enable", "permit"],
  ["prevent", "stop", "block", "inhibit"],
  ["start", "begin", "initiate"],
  ["end", "finish"],
  ["need", "require", "depend"],
  ["break-down", "breaks-down", "broke-down", "denature", "destroy"],
  // Plain words for terms students meet in their notes: the term or its everyday meaning is the same idea.
  ["hydrophobic", "water-fearing", "water-repelling", "water-hating", "repel-water", "repels-water"],
  ["hydrophilic", "water-loving", "water-attracting", "attract-water", "attracts-water"],
  ["nonpolar", "non-polar", "uncharged"],
  ["core", "centre", "center", "middle", "interior"],
  ["pass", "cross", "go-through", "goes-through", "get-through", "gets-through", "let-through", "lets-through", "pass-through"],
  ["keep-out", "keeps-out", "kept-out", "stopped"],
  ["distinct", "separate"],
  ["root", "solution"],
  ["shift", "move", "travel", "fly", "flies-off", "head"],
  ["repeat", "again", "redo"],
  ["influence", "affect", "steer", "shape"],
  ["recipient", "receive", "receiver"],
  ["product"],
  ["reactant"],
  ["left"],
  ["right"],
];

/** Opposite groups, by their first word. A student using the opposite has not said the page's idea. */
const OPPOSITE: Record<string, string> = {
  increase: "decrease", decrease: "increase",
  gain: "lose", lose: "gain",
  fast: "slow", slow: "fast",
  large: "small", small: "large",
  inside: "outside", outside: "inside",
  same: "different", different: "same",
  positive: "negative", negative: "positive",
  allow: "prevent", prevent: "allow",
  start: "end", end: "start",
  product: "reactant", reactant: "product",
  left: "right", right: "left",
};

/** Numbers said in words or figures: "two" and "2" are one number, and "no" roots is zero of them. */
const NUMBER: Record<string, number> = { zero: 0, no: 0, none: 0, one: 1, single: 1, two: 2, both: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
export function numberOf(word: string) {
  const lower = word.toLocaleLowerCase();
  if (/^\d+$/.test(lower)) return Number(lower);
  return lower in NUMBER ? NUMBER[lower] : null;
}

const GROUP_OF = new Map<string, string>();
for (const group of GROUPS) for (const word of group) if (!GROUP_OF.has(family(word))) GROUP_OF.set(family(word), group[0]);

/** The idea group a word belongs to, if any: "rises" → "increase". */
export function groupOf(word: string) {
  const root = family(word);
  return GROUP_OF.get(root) ?? GROUP_OF.get(word.toLocaleLowerCase()) ?? null;
}

/** Joins two-word phrases a student writes ("takes in", "goes up") into single tokens the groups know. */
function joinPhrases(text: string) {
  return text.toLocaleLowerCase()
    .replace(/\bwater[\s-]+(fearing|repelling|hating|loving|attracting)\b/gu, "water-$1")
    .replace(/\b(repel|repels|attract|attracts)\s+water\b/gu, "$1-water")
    .replace(/\b(go|goes|went|get|gets|got|let|lets|pass|take|takes|took|give|gives|gave|speed|speeds|slow|slows|break|breaks|broke|lead|leads|result|results|out|keep|keeps|kept|fly|flies)\s+(up|down|in|off|to|of|through|out)\b/gu, "$1-$2");
}

export type SaidWords = { roots: string[]; groups: Map<string, string>; numbers: Map<number, string> };

/** What the student said, ready to compare: word roots, and which idea group each word stood for (with the word). */
export function readAnswer(answer: string): SaidWords {
  const words = joinPhrases(answer).split(/[^\p{L}\p{N}-]+/u).filter((word) => word.length >= 3);
  const groups = new Map<string, string>();
  for (const word of words) {
    const group = groupOf(word);
    if (group && !groups.has(group)) groups.set(group, word);
  }
  const numbers = new Map<number, string>();
  for (const word of joinPhrases(answer).split(/[^\p{L}\p{N}-]+/u)) {
    const value = numberOf(word);
    if (value !== null && !numbers.has(value)) numbers.set(value, word);
  }
  return { roots: words.filter((word) => word.length >= 4).map(family), groups, numbers };
}

/** The idea groups a page sentence itself uses. */
export function pageGroups(reference: string) {
  return new Set(readAnswer(reference).groups.keys());
}

export type WordVerdict = { hit: boolean; flip?: string };

/**
 * Whether one key word of the page was said: in its own family, or as a word of the same idea group.
 * When only the opposite group was used, `flip` holds the student's word so the screen can name it.
 */
export function judgeWord(pageWord: string, said: SaidWords, pageGroups: Set<string> = new Set()): WordVerdict {
  // A number is right only as the same number: "2" for "two" is said, "no" or "one" where the page says two is not.
  const value = numberOf(pageWord);
  if (value !== null) {
    if (said.numbers.has(value)) return { hit: true };
    const other = [...said.numbers.entries()].find(([number]) => number !== value);
    return other ? { hit: false, flip: other[1] } : { hit: false };
  }
  const root = family(pageWord);
  if (said.roots.some((token) => sameFamily(token, root))) return { hit: true };
  const group = groupOf(pageWord);
  if (!group) return { hit: false };
  if (said.groups.has(group)) return { hit: true };
  const opposite = OPPOSITE[group];
  // A page that says both ("gains water … loses water") cannot be contradicted by one of them.
  if (opposite && pageGroups.has(opposite)) return { hit: false };
  const flip = opposite ? said.groups.get(opposite) : undefined;
  return flip ? { hit: false, flip: flip.replace(/-/g, " ") } : { hit: false };
}
