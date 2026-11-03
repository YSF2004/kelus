/**
 * The language a student's notes are written in, so questions about them are asked in it too. A French revision
 * sheet gets French questions: the line is quoted as written, and the words around it match.
 *
 * Questions are built in English and translated here, at the edge, so every check that reads a question's wording
 * (the lint, the run's ordering) keeps working on one set of phrasings.
 */
export type NoteLanguage = "en" | "fr";

const FRENCH = /\b(?:le|la|les|des|est|sont|une|du|et|dans|pour|qui|que|avec|par|sur|au|aux)\b/gi;
const ENGLISH = /\b(?:the|is|are|of|and|in|to|a|an|that|which|with|by|on|for)\b/gi;

export function noteLanguage(text: string): NoteLanguage {
  const french = (text.match(FRENCH) ?? []).length + (text.match(/[éèêàçùâîôœ]/g) ?? []).length;
  const english = (text.match(ENGLISH) ?? []).length;
  return french > english ? "fr" : "en";
}

/** "Page 3" → "page 3"; "your notes" and "this page" → their French. */
function where(locator: string) {
  const trimmed = locator.trim();
  if (/^your notes$/i.test(trimmed)) return "tes notes";
  if (/^this page$/i.test(trimmed)) return "cette page";
  return trimmed.replace(/^Page\b/, "la page").replace(/^Section\b/, "la section").replace(/^Slide\b/, "la diapo");
}

/** A topic name inside a French sentence: in « », with a trailing question mark kept once. */
const named = (name: string) => `« ${name.trim().replace(/\s*\?$/, " ?")} »`;

type Rule = [RegExp, (match: RegExpMatchArray, name: string) => string];

const PROMPTS: Rule[] = [
  [/^Which idea from your notes does this describe\? (“.+”)$/s, (m) => `Quelle notion de tes notes est décrite ici ? ${m[1]}`],
  [/^Which term does this describe\? (“.+”)$/s, (m) => `Quel terme est décrit ici ? ${m[1]}`],
  [/^Which word completes this statement from your notes\? (“.+”)$/s, (m) => `Quel mot complète cette phrase de tes notes ? ${m[1]}`],
  [/^Fill the gap: (“.+”)$/s, (m) => `Complète cette phrase : ${m[1]}`],
  [/^Fill the gap from (.+?): (“.+”)$/s, (m) => `Complète cette phrase de ${where(m[1])} : ${m[2]}`],
  [/^Which of these is about .+\?$/s, (_m, name) => `Laquelle de ces phrases parle de ${named(name)} ?`],
  [/^Which of these is from your notes on .+\?$/s, (_m, name) => `Laquelle de ces phrases vient de tes notes sur ${named(name)} ?`],
  [/^Which of these does NOT match your notes on .+\?$/s, (_m, name) => `Laquelle de ces phrases ne correspond PAS à tes notes sur ${named(name)} ?`],
  [/^Which one matches: (“.+”)\?$/s, (m) => `Lequel de ces termes correspond : ${m[1]} ?`],
  [/^In your notes, what comes right after: (“.+”)\?$/s, (m) => `Dans tes notes, qu’est-ce qui vient juste après : ${m[1]} ?`],
  [/^Your notes say: (“.+”) Why does that happen\? Explain it in your own words\.$/s, (m) => `Tes notes disent : ${m[1]} Pourquoi ? Explique-le avec tes mots.`],
  [/^Why, according to your notes\? (“.+”)$/s, (m) => `Pourquoi, d’après tes notes ? ${m[1]}`],
  [/^Your notes describe two cases\. Which ending is right\? (“.+”)$/s, (m) => `Tes notes décrivent deux cas. Quelle fin est la bonne ? ${m[1]}`],
  [/^Your notes also say: (“.+”) Explain what that means, and give an example of your own\.$/s, (m) => `Tes notes disent aussi : ${m[1]} Explique ce que cela veut dire, avec un exemple à toi.`],
  [/^Close the page\. What would you tell a friend about .+\?$/s, (_m, name) => `Ferme la page. Que dirais-tu à un ami sur ${named(name)} ?`],
  [/^In your own words, what do your notes say about .+\?$/s, (_m, name) => `Avec tes mots, que disent tes notes sur ${named(name)} ?`],
  [/^What do your notes say about .+\?$/s, (_m, name) => `Que disent tes notes sur ${named(name)} ?`],
  [/^Explain .+ the way your notes do\.$/s, (_m, name) => `Explique ${named(name)} comme tes notes le font.`],
  [/^How would you explain .+ to a friend, from your notes\?$/s, (_m, name) => `Comment expliquerais-tu ${named(name)} à un ami, d’après tes notes ?`],
];

const HINTS: Rule[] = [
  [/^It is one word\. It starts with (“.+?”) and has (\d+) letters\.$/, (m) => `Un seul mot. Il commence par ${m[1]} et compte ${m[2]} lettres.`],
  [/^It is a number from the page\.$/, () => "C’est un nombre de la page."],
  [/^Think about what (.+?) is mostly about\.$/, (m) => `Pense au sujet principal de ${where(m[1])}.`],
];

function translate(rules: Rule[], text: string, name: string) {
  for (const [pattern, write] of rules) {
    const match = text.match(pattern);
    if (match) return write(match, name);
  }
  return null;
}

/** A question's wording in the notes' language. English, or a phrasing with no French yet, is returned as it is. */
export function inNotesLanguage(prompt: string, language: NoteLanguage, name: string) {
  if (language !== "fr") return prompt;
  return translate(PROMPTS, prompt, name) ?? prompt;
}

export function hintInNotesLanguage(hint: string, language: NoteLanguage) {
  if (language !== "fr") return hint;
  return translate(HINTS, hint, "") ?? hint;
}

/**
 * The explanation question for a French topic, from its main line: "La photosynthèse est …" asks
 * "Qu’est-ce que la photosynthèse, d’après tes notes ?"; a heading that is already a question is asked as it stands.
 */
export function frenchRecallQuestion(name: string, claim: string) {
  const heading = name.trim();
  if (/\?\s*$/.test(heading)) return `${heading.replace(/\s*\?\s*$/, " ?")} Que disent tes notes ?`;
  const subject = claim.trim().match(/^((?:Le|La|L’|L'|Les|Un|Une)\s?[\p{L}’'-]+(?:\s(?:de|du|des|d’|d')\s?[\p{L}’'-]+)?)\s+(est|sont)\b/u);
  if (subject) {
    const phrase = subject[1].replace(/^\p{Lu}/u, (letter) => letter.toLocaleLowerCase());
    return subject[2] === "sont" ? `Que sont ${phrase}, d’après tes notes ?` : `Qu’est-ce que ${phrase}, d’après tes notes ?`;
  }
  return `Que disent tes notes sur ${named(heading)} ?`;
}
