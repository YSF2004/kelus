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
};

const GROUP_OF = new Map<string, string>();
for (const group of GROUPS) for (const word of group) if (!GROUP_OF.has(family(word))) GROUP_OF.set(family(word), group[0]);

/** The idea group a word belongs to, if any: "rises" → "increase". */
export function groupOf(word: string) {
  const root = family(word);
  return GROUP_OF.get(root) ?? GROUP_OF.get(word.toLocaleLowerCase()) ?? null;
}

/** Joins two-word phrases a student writes ("takes in", "goes up") into single tokens the groups know. */
function joinPhrases(text: string) {
  return text.toLocaleLowerCase().replace(/\b(go|goes|went|take|takes|took|give|gives|gave|speed|speeds|slow|slows|break|breaks|broke|lead|leads|result|results|out)\s+(up|down|in|off|to|of)\b/gu, "$1-$2");
}

export type SaidWords = { roots: string[]; groups: Map<string, string> };

/** What the student said, ready to compare: word roots, and which idea group each word stood for (with the word). */
export function readAnswer(answer: string): SaidWords {
  const words = joinPhrases(answer).split(/[^\p{L}\p{N}-]+/u).filter((word) => word.length >= 3);
  const groups = new Map<string, string>();
  for (const word of words) {
    const group = groupOf(word);
    if (group && !groups.has(group)) groups.set(group, word);
  }
  return { roots: words.filter((word) => word.length >= 4).map(family), groups };
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
