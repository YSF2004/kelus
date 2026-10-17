import type { PracticeItem } from "./types";

/** Only items that can be checked instantly and fairly: pick one, or type one word. */
export function isDrillable(item: PracticeItem) {
  return item.kind === "choice" || item.kind === "cloze";
}

function clean(value: string) {
  return value.toLocaleLowerCase().replace(/[’']/g, "'").replace(/[^\p{L}\p{N}\s'-]/gu, "").replace(/\s+/g, " ").trim();
}

/** Accents off, for comparing only: "proteine" is "protéine" typed on a keyboard without them. */
const plain = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "");

function distance(a: string, b: string) {
  if (a === b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

const ARTICLE = /^(?:the|a|an|le|la|les|l'|un|une|des|du|de la|de)\s+|^l'/;

/**
 * One word's family, by its ending only: "increases", "increased", "increasing" and "increase" share "increas";
 * "membranes" and "membrane" share "membran". Prefixes are never touched, so "inelastic" never becomes "elastic".
 */
function stem(word: string) {
  return word
    .replace(/ies$/, "y")
    .replace(/(?:ing|ed|es|s)$/, "")
    .replace(/(?<=[^aeiou])e$/, "")
    // French: the -aux of "animaux", and a plural -x.
    .replace(/aux$/, "al")
    .replace(/x$/, "");
}

/** Words of a different meaning that look alike: a typo allowance must never turn one into the other. */
const LOOKALIKES: Array<[string, string]> = [
  ["hypo", "hyper"], ["inelastic", "elastic"], ["increase", "decrease"], ["higher", "lower"], ["inside", "outside"],
  ["internal", "external"], ["import", "export"], ["active", "passive"], ["anabolic", "catabolic"], ["mitosis", "meiosis"],
  ["affect", "effect"], ["exogen", "endogen"], ["absorb", "adsorb"], ["accept", "except"], ["complement", "compliment"],
  ["intra", "inter"], ["afferent", "efferent"], ["prosta", "presta"],
];
const lookalike = (a: string, b: string) => LOOKALIKES.some(([x, y]) => (a.includes(x) && !a.includes(y) && b.includes(y)) || (b.includes(x) && !b.includes(y) && a.includes(y)));

export type CheckVerdict = {
  right: boolean;
  /**
   * How a right answer differed from the notes, so the feedback can say it was accepted on purpose:
   * "spelling" (a slip or missing accents), "form" (another form of the same word), "words" (the word with its
   * neighbours from the sentence, or an article).
   */
  how?: "exact" | "spelling" | "form" | "words";
};

/**
 * Right when a fair marker would say right: the word itself, another form of it, a small slip, missing accents,
 * an article in front, or the word typed with its neighbours from the sentence ("more concentrated" for the gap in
 * "a more _____ one"). Never a different word: an opposite, a look-alike, or a real word found elsewhere in the notes.
 */
export function checkAnswer(item: PracticeItem, answer: string | number, notes = ""): CheckVerdict {
  if (item.kind === "choice") return { right: typeof answer === "number" && answer === item.correctIndex, how: "exact" };
  if (typeof answer !== "string") return { right: false };
  const expected = clean(item.modelAnswer);
  let given = clean(answer);
  if (!given || !expected) return { right: false };
  if (given === expected) return { right: true, how: "exact" };

  let how: CheckVerdict["how"];
  // Neighbours from the sentence typed along with the word: "more concentrated" in "a more _____ one".
  const [before = "", after = ""] = item.prompt.split("_____").map(clean);
  const lastBefore = before.split(" ").slice(-2);
  const firstAfter = after.split(" ").slice(0, 2);
  const parts = given.split(" ");
  if (parts.length > 1 && !expected.includes(" ")) {
    let start = 0;
    let end = parts.length;
    while (end - start > 1 && (lastBefore.includes(parts[start]) || ARTICLE.test(`${parts[start]} `))) start += 1;
    while (end - start > 1 && firstAfter.includes(parts[end - 1])) end -= 1;
    if (start > 0 || end < parts.length) { given = parts.slice(start, end).join(" "); how = "words"; }
  }
  if (!ARTICLE.test(expected)) {
    const bare = given.replace(ARTICLE, "");
    if (bare && bare !== given) { given = bare; how = "words"; }
  }
  if (given === expected) return { right: true, how };

  const a = plain(given);
  const b = plain(expected);
  if (lookalike(a, b)) return { right: false };
  if (a === b) return { right: true, how: how ?? "spelling" };
  // Numbers: "17000" is "17,000", and "40" is "40 °C".
  if (/\d/.test(b) && a.replace(/[\s,.]/g, "") === b.replace(/[\s,.]/g, "").replace(/\D+$/, "")) return { right: true, how: how ?? "form" };
  if (Math.min(a.length, b.length) >= 4 && stem(a) === stem(b)) return { right: true, how: how ?? "form" };
  // A slip, scaled to the word's length, unless what was typed is itself a different word in the notes.
  const allowed = b.length >= 10 ? 2 : b.length >= 5 ? 1 : 0;
  if (allowed && distance(a, b) <= allowed) {
    const escaped = given.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const elsewhere = new RegExp(`(?<![\\p{L}])${escaped}(?![\\p{L}])`, "iu").test(notes);
    if (!elsewhere) return { right: true, how: how ?? "spelling" };
  }
  return { right: false };
}

/** Right or not, for callers that only need the yes or no. */
export function checkPracticeAnswer(item: PracticeItem, answer: string | number, notes = ""): boolean {
  return checkAnswer(item, answer, notes).right;
}
