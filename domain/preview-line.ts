import { splitSentences } from "./content-engine";

// Small words a real sentence carries and a run of labels does not ("route departure time flight operation").
const FUNCTION_WORDS = new Set(("the a an is are was were be been being of to in on at by for with from as and or but " +
  "that which who this these those it its their they there because so than then when if can will may must should " +
  "has have had does do not no into over under between through le la les un une des est sont de du et en pour par " +
  "qui que dans avec sur").split(" "));

/** How much a line reads as a sentence: enough words, and a share of the small words that join them. */
function sentenceScore(line: string) {
  const words = line.toLocaleLowerCase().match(/[\p{L}’']+/gu) ?? [];
  if (words.length < 6 || words.length > 45) return 0;
  const joined = words.filter((word) => FUNCTION_WORDS.has(word)).length / words.length;
  return joined >= 0.14 ? joined : 0;
}

/**
 * The line a topic is introduced by when the student checks what was found: the first one in its section that
 * reads as a sentence, so a list of labels or a table row never stands for the topic. Falls back to the section's
 * opening when none does. Always the notes' own words, shortened only at a word.
 */
export function previewLine(excerpt: string, max = 150) {
  // A short heading line with no stop ("Définition") would otherwise run into the sentence under it.
  const body = excerpt.replace(/^[^\n.!?]{1,40}\n(?=\S)/, (head) => (head.trim().split(/\s+/).length <= 5 ? "" : head));
  const sentence = splitSentences(body).find((line) => sentenceScore(line) > 0);
  const text = (sentence ?? excerpt).replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20)).replace(/[,;:\s]+$/, "")}…`;
}
