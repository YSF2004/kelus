import { frenchRecallQuestion, inNotesLanguage, noteLanguage } from "./note-language";
import { buildPractice, teachingFacts, units } from "./content-engine";
import { standsAlone } from "./question-lint";
import type {
  Concept,
  ConceptRelationship,
  ExtractedMaterialPage,
  LearningActivity,
  Prompt,
  ProposedConcept,
} from "./types";

const ADMINISTRATIVE =
  /\b(?:attendance|calendar|contact|course syllabus|email|grading|instructor|your professor|professor is|teaching assistants?|office hours|reading list|schedule|syllabus|textbook)\b|\b(?:late|attendance|grading|course|class|academic|honou?r(?: code)?|privacy|refund|make-?up|plagiarism|submission|exam|office|lab|safety) polic(?:y|ies)\b|^assessments?$|\bassessments? (?:schedule|dates?|weights?|weighting|breakdown|criteria|overview|methods?)\b/i;
/** "BIO 101", "CS201", "Week 4", "Lecture 3", "Unit 2": a heading that names the document, not something to study. */
const COURSE_CODE = /\b[A-Z]{2,5}\s?\d{3}[A-Z]?\b|\b\d{1,2}[./]\d{2,3}(?:\/\d{2,3})?\b/;
const DOCUMENT_NUMBER = /\b(?:week|lecture|lesson|unit|module|chapter|session|seminar|tutorial|class)\s*\d+\b/i;
export function isDocumentTitle(value: string) {
  return COURSE_CODE.test(value) || DOCUMENT_NUMBER.test(value);
}

/** The document's own title, from the first lines of the first page: it names the course instead of becoming a topic. */
export function documentTitle(pages: ExtractedMaterialPage[], options: { fromLayout?: boolean } = {}) {
  // Notes already have a filename or pasted title. A "Week 3" in their properties/intro is not a course name.
  if (options.fromLayout === false) return null;
  const first = [...pages].filter((page) => page.pageNumber > 0).sort((a, b) => a.pageNumber - b.pageNumber)[0];
  const line = first?.text.split(/\n+/).slice(0, 6).map((entry) => entry.trim()).find((entry) => entry.length >= 4 && entry.length <= 90 && isDocumentTitle(entry));
  // "1.1 Lecture 1: …" carries the handout's section number in front of its own; "Lecture 1: …" says it once.
  if (line) return line.replace(/\s+/g, " ").replace(/^\d+(?:\.\d+)*\s+(?=(?:week|lecture|lesson|unit|module|chapter|session|seminar|tutorial|class)\s*\d)/i, "");
  // Only a PDF's first page is a title page; notes are sections, each opening on its own topic heading.
  return layoutTitle(first);
}

/**
 * The size of the page's running text: the size most of its letters are set in. Counting lines instead lets a
 * sparse page of headings call a heading "body", and then the title no longer looks bigger than the text.
 */
function bodyFontSize(blocks: NonNullable<ExtractedMaterialPage["blocks"]>) {
  const sorted = [...blocks].filter((block) => block.fontSize > 0).sort((a, b) => a.fontSize - b.fontSize);
  const total = sorted.reduce((sum, block) => sum + block.text.length, 0);
  let seen = 0;
  for (const block of sorted) {
    seen += block.text.length;
    if (seen >= total / 2) return block.fontSize;
  }
  return sorted.at(-1)?.fontSize ?? 12;
}

/**
 * A PDF's own title: the first line of the first page, set clearly larger than everything else on it, above at least
 * one smaller heading. "7 Cell Transport" over "7.1 Diffusion" is the chapter, not a topic in it.
 */
function layoutTitle(page: ExtractedMaterialPage | undefined) {
  const blocks = page?.blocks ?? [];
  if (blocks.length < 3) return null;
  const body = bodyFontSize(blocks);
  const [top, ...rest] = blocks;
  const text = cleanCandidate(top.text);
  if (text.length < 3 || text.length > 90 || top.fontSize < body * 1.35) return null;
  if (rest.some((block) => block.fontSize >= top.fontSize * 0.95)) return null;
  return rest.some((block) => block.fontSize >= body * 1.16) ? text : null;
}

/** Course-logistics text near a heading means the "topic" is a title page, not something to study. */
/** Licence notices, image credits and page furniture: a passage made of these teaches nothing. */
const CREDIT_LINE = /(?:creative commons|all rights reserved|terms of use|ocw\.mit\.edu|image (?:is )?(?:courtesy|in the public domain)|public domain|excluded from our|© ?\d{4}|copyright|source:|licen[cs]ed under)/i;
function creditOnly(excerpt: string) {
  const flat = excerpt.replace(/\s+/g, " ");
  if (!CREDIT_LINE.test(flat)) return false;
  // What is left once the credit sentences go: fewer than eight real words is a figure caption, not a lesson.
  const rest = flat.split(/(?<=[.!?])\s+/).filter((part) => !CREDIT_LINE.test(part)).join(" ");
  if ((rest.match(/\p{L}{3,}/gu) ?? []).length < 8) return true;
  // A reproduced chart or map: a credit, and the rest is legend values and labels, not sentences.
  const sentenceLines = excerpt.split(/\n+/).filter((line) => !CREDIT_LINE.test(line) && (line.match(/\p{L}{3,}/gu) ?? []).length >= 4);
  return sentenceLines.length < 3;
}
const ADMINISTRATIVE_EXCERPT = /\b(?:office hours?|instructor\s*:|attendance|grading\s*:)|e-?mail\s*:|\S+@\S+\.\S+|\b(?:nous soussign[ée]s?|je soussign[ée]e?|certifions|certifie que|fait pour servir et valoir|pour valoir ce que de droit)\b/i;
/** Headings that structure a document but are not something to study on their own. */
const GENERIC_HEADING =
  /^(?:examples?|summary|overview|introduction|intro|conclusions?|notes?|references?|resources?|further reading|homework|exercises?|practice|questions?|review|recap|key points|takeaways|table of contents|contents|agenda|to-?do|links?|bibliography|appendix|glossary|extra|misc(?:ellaneous)?|(?:learning )?objectives|learning outcomes|outcomes|aims|goals|key terms|objectifs|plan|sommaire|outline|class material|course material|for today(?: and next week)?|next week|this week|today|to know(?: [-–—] .*)?|announcements?|logistics|reminders?|readings?|thank you|any questions\??|r[ée]sum[ée]|conclusion|exercices?|exemples?|bibliographie|annexes?|mots[- ]cl[ée]s)$/i;
/** A course deck can hold dozens of topics; more than this is shown as a cap, not silently dropped. */
export const MAX_PROPOSED_TOPICS = 40;
const HEADING_PREFIX = /^(?:week|module|topic|chapter|unit|lecture|section)\s*\d*[.:\-–—]?\s*/i;
const NUMBER_PREFIX = /^\s*(?:\d+(?:\.\d+)+\.?\s+|(?:\d+(?:\.\d+)*|[ivx]+)[.)\-:]\s*|\d{1,2}\s+(?=\p{Lu}))/iu;
const EXAM_SIGNAL =
  /\b(?:exam|midterm|final|tests?|tested|assessment|learning objectives?|will be asked|must know|high-?yield|core concept|key concept|important|critical|essential|fundamental)\b/i;
const DEFINITION_SIGNAL =
  /\b(?:is defined as|refers to|means that|measures|describes|occurs when|happens when|is the|are the)\b/i;
const PREREQ_SIGNAL =
  /\b(?:prerequisites?|requires?|required|depends on|dependent on|builds on|built on|based on|before studying|after mastering|extension of|application of|assumes knowledge of|you should already know)\b/i;
const RELATED_SIGNAL = /\b(?:related to|closely related|see also|compared with|in contrast to|versus|vs\.?)\b/i;

function cleanCandidate(value: string) {
  const cleaned = value
    .replace(/^\s*[•◦▪‣]\s+/, "")
    // "Definition (Elasticity of Y with respect to X)" is a definition of the thing in brackets.
    .replace(/^\s*(?:definition|déf(?:inition)?)s?\s*\((.+)\)\s*$/i, "$1")
    .replace(NUMBER_PREFIX, "")
    .replace(HEADING_PREFIX, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, "")
    .trim();
  // A run drawn twice with different spacing ("Example: N vs O vs SExample: Nvs O vs S"): keep the first copy.
  const squeezed = cleaned.replace(/\s+/g, "");
  if (squeezed.length >= 8 && squeezed.length % 2 === 0 && squeezed.slice(0, squeezed.length / 2) === squeezed.slice(squeezed.length / 2)) {
    let seen = 0;
    for (let i = 0; i < cleaned.length; i += 1) {
      if (!/\s/.test(cleaned[i])) seen += 1;
      if (seen === squeezed.length / 2) return cleaned.slice(0, i + 1).trim();
    }
  }
  const words = cleaned.split(/\s+/);
  if (words.length >= 2 && words.length % 2 === 0) {
    const midpoint = words.length / 2;
    const left = words.slice(0, midpoint).join(" ").toLocaleLowerCase();
    const right = words.slice(midpoint).join(" ").toLocaleLowerCase();
    if (left === right) return words.slice(0, midpoint).join(" ");
  }
  return cleaned;
}

/**
 * The rest of an earlier line, not a heading of its own: it opens on a joining word ("And assessing tradeoffs",
 * "To buy a certain good") or closes a bracket it never opened ("Should organ sales be legal?)").
 */
function isContinuation(value: string) {
  const text = value.trim();
  const opens = (text.match(/\(/g) ?? []).length;
  const closes = (text.match(/\)/g) ?? []).length;
  return /^(?:and|or|but|nor|to|of|for|with|as|than|that|which|so|then)\b/i.test(text) || closes > opens;
}

/** "Demand curve is downward-sloping" is a fact from the notes, not the name of a topic; "What is demand?" can be. */
function isStatement(value: string) {
  const text = value.trim();
  return !/\?$/.test(text) && !/^(?:what|why|how|when|where|who|which)\b/i.test(text) && /\S\s+(?:is|are|was|were)\s+\S/i.test(text);
}

/**
 * Lines that look like headings but are not topics: a heading cut off mid-phrase ("The Role of the"), a quote or a
 * continued slide ("“Why do we…", "(cont’d)"), an example label, a chain of symbols ("HI > HBr > HCl"), or the
 * lecturer's name on the title slide.
 */
function notATopic(value: string) {
  const text = value.trim();
  return /\b(?:the|of|in|and|to|a|an|for|with|on|at|by|from|or|as)$/i.test(text)
    || /^[“"‘']/.test(text) || (/[”"]\??$/.test(text) && !/[“"]/.test(text.slice(0, -2)))
    || /\((?:cont(?:’|')?d|cont\.|continued)\)|\bcontinued$/i.test(text)
    || /^examples?\b/i.test(text)
    || (text.match(/[<>=]/g) ?? []).length >= 2
    || /^(?:dr|prof|professor|mr|mrs|ms)\.?\s+\p{Lu}/iu.test(text);
}

/** A slide's bullet point is a point inside a topic, never the topic's heading. */
const BULLETED = /^\s*[•◦▪‣]\s/;

function looksLikeConcept(value: string) {
  if (BULLETED.test(value) || isStatement(value) || notATopic(value)) return false;
  if (value.length < 3 || value.length > 72 || ADMINISTRATIVE.test(value) || GENERIC_HEADING.test(value.trim()) || isContinuation(value)) return false;
  if (/https?:|@|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(value)) return false;
  if (/\b(?:due|points?|percent|room|pm|am)\b/i.test(value)) return false;
  const words = value.split(/\s+/);
  if (words.length > 9) return false;
  const titleWords = words.filter((word) => /^\p{Lu}[\p{L}/&-]*$/u.test(word)).length;
  return HEADING_PREFIX.test(value) || NUMBER_PREFIX.test(value) || titleWords >= Math.max(1, Math.ceil(words.length * 0.55));
}

/** A name a person could revise from: it has a real word in it, not just "1" or "2.3" from a form or a numbered list. */
export function isNamedTopic(name: string) {
  return /\p{L}{3}/u.test(name);
}

/**
 * A topic called "1" tells nobody what to revise. Name it from the first real line of its own text, a few words long;
 * if the text has none, from where it sits ("Page 2").
 */
export function topicNameFrom(name: string, excerpt: string, locator: string) {
  // A scan often loses the capital: "enzyme denatures" reads as a heading once it has it back.
  if (isNamedTopic(name)) return name.charAt(0).toLocaleUpperCase() + name.slice(1);
  for (const raw of excerpt.split(/\n+|(?<=[.!?:])\s+/)) {
    const line = cleanCandidate(raw).replace(/[.!?:;,]+$/, "");
    if (!isNamedTopic(line)) continue;
    const words = line.split(/\s+/);
    const short = words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : line;
    if (short.length >= 3) return short.charAt(0).toLocaleUpperCase() + short.slice(1);
  }
  return locator;
}

function stablePart(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function excerptFor(lines: string[], index: number, fallback: string, isHeading: (line: string, at: number) => boolean = (line) => looksLikeConcept(line)) {
  const nearby: string[] = [];
  for (const [offset, raw] of lines.slice(index + 1, index + 16).entries()) {
    const line = raw.trim();
    const heading = isHeading(line, index + 1 + offset);
    if (!line) {
      if (nearby.length) break;
      continue;
    }
    // A PDF wraps a sentence across lines; a short tail like "no energy." still belongs to it. A slide's bullet point
    // ends where its line ends, punctuated or not, so the next slide's heading is never read as its tail.
    const last = nearby[nearby.length - 1] ?? "";
    const bullet = BULLETED.test(line);
    const continues = nearby.length > 0 && !bullet && ((!BULLETED.test(last) && !/[.!?:;”")]$/.test(last)) || /^[a-z(]/.test(line));
    if (heading && nearby.length && !continues) break;
    // Short points count on a slide ("Introspection", "Edward Titchener"); in prose a short line is usually a label.
    if (((bullet ? line.replace(BULLETED, "").length >= 6 : line.length > 18) && !heading) || continues) nearby.push(line);
    if (nearby.join(" ").length >= 520 && /[.!?]["”)]?$/.test(line)) break;
  }
  return wholeSentences(nearby.length ? nearby.join("\n") : fallback, 760);
}

/** Never end on half a sentence: a question built from "…is passive and needs" teaches the wrong thing. */
function wholeSentences(text: string, limit: number) {
  const clipped = text.slice(0, limit);
  if (/[.!?]["”)]?\s*$/.test(clipped)) return clipped.trim();
  const end = Math.max(...[...clipped.matchAll(/[.!?]["”)]?(?=\s)/g)].map((match) => (match.index ?? 0) + match[0].length), -1);
  return end > 40 ? clipped.slice(0, end).trim() : clipped.trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pageNumberFromLocator(locator: string) {
  const match = locator.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

function mentionCount(name: string, corpus: string) {
  return corpus.match(new RegExp(`\\b${escapeRegExp(name)}\\b`, "gi"))?.length ?? 0;
}

function sentencesFrom(excerpt: string) {
  return excerpt
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 18);
}

/** "Positive vs. normative economics": the two sides, so a question can ask for both. */
export function versusSides(name: string) {
  const match = name.match(/^(.+?)\s+(?:vs\.?|versus)\s+(.+)$/i);
  if (!match) return null;
  // "Positive vs. normative economics": the shared noun ("economics") belongs to both sides.
  const [left, right] = [match[1].trim(), match[2].trim()];
  const tail = right.split(/\s+/).slice(1).join(" ");
  return { left: !/\s/.test(left) && tail ? `${left} ${tail}` : left, right, leftKey: left.split(/\s+/)[0], rightKey: right.split(/\s+/)[0] };
}

function centralClaim(name: string, excerpt: string) {
  const sentences = units(excerpt);
  if (!sentences.length) return excerpt.slice(0, 220);
  const sides = versusSides(name);
  if (sides) {
    const opens = (key: string) => sentences.find((sentence) => new RegExp(`^(?:the\\s+)?${escapeRegExp(key)}\\b`, "i").test(sentence)) ?? sentences.find((sentence) => new RegExp(`\\b${escapeRegExp(key)}\\b`, "i").test(sentence));
    const [a, b] = [opens(sides.leftKey), opens(sides.rightKey)];
    if (a && b && a !== b) return `${a} ${b}`.slice(0, 320);
  }
  // The answer a student is compared with must read as a statement: "Strong acid Weak acid" or "Consider a market
  // with:" cannot be explained back. Lines that stand alone come first; only a page with none falls back to its lines.
  const whole = sentences.filter(standsAlone);
  const pool = whole.length ? whole : sentences;
  // "Determinants of elasticity", "Causes of …": the answer is the list, not its first item.
  if (isListTopic(name) && whole.length >= 2) return whole.slice(0, 3).join(" ").slice(0, 360);
  const named = pool.find((sentence) => sentence.toLocaleLowerCase().includes(coreName(name).toLocaleLowerCase()));
  // A definition counts only near the heading; a later "… is the market equilibrium" belongs to another idea.
  const defined = pool.slice(0, 2).find((sentence) => DEFINITION_SIGNAL.test(sentence));
  if (!whole.length && sentences.length > 1) return clipAtPoint(sentences.slice(0, 3).join("; "), 300);
  return clipAtPoint(named ?? defined ?? pool[0], 260);
}

/** A long slide point ("Parent: a; b; c; …") is cut after its last whole point, never inside a word. */
function clipAtPoint(text: string, limit: number) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit);
  const at = Math.max(cut.lastIndexOf("; "), cut.lastIndexOf(". "));
  return at > limit * 0.4 ? cut.slice(0, at + (cut[at] === "." ? 1 : 0)) : cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:]$/, "") + "…";
}

/** A topic that names a set: "Determinants of elasticity", "Causes of the war", "Limiting factors". */
export function isListTopic(name: string) {
  return /^(?:the\s+)?(?:determinants|causes|factors|types|kinds|effects|consequences|features|characteristics|properties|advantages|disadvantages|stages|steps|functions|principles|methods|sources|uses|limitations|reasons|themes)\b|\b(?:factors|causes|types|stages)$/i.test(name.trim());
}

/**
 * The topic as it reads inside a sentence: "the cell membrane", "osmosis", but "ATP" and "Bayes' theorem" as written.
 * A heading capitalises every word; a question in the middle of a sentence should not.
 */
const PLACE_WORDS = /^(?:Europe|European|America|American|Africa|African|Asia|Asian|Britain|British|English|France|French|Germany|German|China|Chinese|Japan|Japanese|India|Indian|Russia|Russian|Western|Eastern|Roman|Greek|Christian|Islamic|Jewish|Latin|Arab|Arabic|Atlantic|Pacific|Mediterranean)[,:]?$/;

/** A slide title ("Evolution of Psychology: Sigmund Freud") reads badly rewritten into a sentence; it is quoted as written. */
export function isTitleHeading(name: string) {
  return /:|\s[-–]\s|-\s/.test(name) || name.split(/\s+/).length > 4;
}

export function spokenName(name: string, claim: string) {
  if (isTitleHeading(name)) return `“${name.replace(/[?.]+$/, "")}”`;
  const leadingThe = new RegExp(`^the\\s+${escapeRegExp(name)}\\b`, "i").test(claim.trim());
  // Capitalised in the middle of a sentence in the notes themselves: a proper name, keep it.
  const properNoun = new RegExp(`[a-z,;:]\\s+${escapeRegExp(name)}\\b`).test(claim) && /^[A-Z]/.test(name);
  // Only a plain capitalised word reads in lowercase ("Cell Membrane" → "cell membrane"). "pKa", "U.S.", "HBr",
  // "acidity/Basicity" or a name with initials ("B. F. Skinner") keep their own spelling.
  // A person ("Wilhelm Wundt (1832-1920)", "… : Pavlov") or a place keeps its capitals too.
  const keep = /\b\p{Lu}\.\s|[/>]|\(\d{4}/u.test(name);
  const parts = name.split(/\s+/);
  const words = parts.map((word, index) => {
    if (!/^\p{Lu}\p{Ll}+(?:-\p{Ll}+)*[,:]?$/u.test(word)) return word;
    if (PLACE_WORDS.test(word) || (index === parts.length - 1 && /:$/.test(parts[index - 1] ?? ""))) return word;
    return word.charAt(0).toLocaleLowerCase() + word.slice(1);
  });
  const base = properNoun || keep ? name : words.join(" ");
  return leadingThe ? `the ${base}` : base;
}

/** "Introduction to Microeconomics" is a chapter title; the thing to ask about is "microeconomics". */
export function coreName(name: string) {
  const core = name.replace(/^(?:an?\s+)?(?:introduction|intro|overview|basics|fundamentals|principles)\s+(?:to|of)\s+/i, "").trim();
  return core.length >= 3 ? core : name;
}

function recallQuestion(fullName: string, claim: string, fallback: string) {
  // A heading that is already a question ("Should we impose a minimum wage?") is asked as it stands.
  if (/\?\s*$/.test(fullName)) return `${fullName.replace(/\s+\?$/, "?")} What do your notes say?`;
  if (isListTopic(fullName)) return `What are the ${spokenName(fullName, claim).replace(/^the\s+/i, "")}, according to your notes?`;
  const sides = versusSides(fullName);
  if (sides) return `How do your notes tell ${spokenName(sides.left, claim)} and ${spokenName(sides.right, claim)} apart?`;
  const core = coreName(fullName);
  const name = core !== fullName && new RegExp(`^(?:the\\s+)?${escapeRegExp(core)}\\b`, "i").test(claim.trim()) ? core : fullName;
  const verb = claim.match(new RegExp(`^(?:the\\s+)?${escapeRegExp(name)}\\s+(is|are|means|measures?|regulates?|depends on|moves?|converts?|calculates?|requires?|links?|describes?|shows?|explains?|determines?|compares?|relates?)\\b`, "i"))?.[1]?.toLocaleLowerCase();
  if (!verb) return fallback;
  const spoken = spokenName(name, claim);
  if (verb === "is" || verb === "are") return `What ${verb} ${spoken}, according to your notes?`;
  if (verb === "means") return `What does ${spoken} mean, according to your notes?`;
  const singular = /(?:s|es)$/.test(verb) && verb !== "is";
  const auxiliary = singular ? "does" : "do";
  const base = singular ? verb.slice(0, -1) : verb;
  if (verb === "depends on") return `What does ${spoken} depend on, according to your notes?`;
  return `What ${auxiliary} ${spoken} ${base}, according to your notes?`;
}

type SubjectMode = "biology" | "computer_science" | "history" | "law" | "mathematics" | "general";

function subjectModeFor(name: string, excerpt: string): SubjectMode {
  const evidence = `${name} ${excerpt}`;
  if (/\b(?:cell|cellular|dna|gene|protein|enzyme|organism|membrane|metabolism|metabolic|photosynthesis|respiration|evolution|homeostasis)\b/i.test(evidence)) return "biology";
  if (/\b(?:algebra|calculate|calculus|derivative|equation|geometry|integral|limit|matrix|polynomial|probability|proof|theorem|vector)\b/i.test(evidence)) return "mathematics";
  if (/\b(?:algorithm|array|binary|compiler|complexity|data structure|database|memory|network|program|recursion|runtime|software)\b/i.test(evidence)) return "computer_science";
  if (/\b(?:century|colonial|empire|historical|revolution|treaty|war|dynasty|industrialization|migration)\b/i.test(evidence)) return "history";
  if (/\b(?:case law|claimant|contract|court|defendant|doctrine|liability|precedent|statute|tort|jurisdiction)\b/i.test(evidence)) return "law";
  return "general";
}

function activityLanguage(mode: SubjectMode, name: string, claim: string) {
  name = coreName(name);
  const spoken = spokenName(name, claim);
  // "How does “The Evolution of Psychology: Beginnings” work?" fits no title; a quoted title gets the plain question.
  switch (spoken.startsWith("“") ? "general" : mode) {
    case "biology":
      return {
        learnTitle: `Trace the mechanism behind ${name}.`,
        retrievePrompt: `How does ${spoken} work, according to your notes?`,
        applyPrompt: `Suppose one required part of ${name} is reduced or blocked. Predict the consequence and trace the mechanism.`,
        applyHint: "Name the changed component, then trace its effect through the system.",
        applyAnswer: `A sound answer identifies the changed component and uses this source-backed mechanism to predict the result: ${claim}`,
      };
    case "computer_science":
      return {
        learnTitle: `Trace how ${name} behaves.`,
        retrievePrompt: `How does ${spoken} work, step by step?`,
        applyPrompt: `Suppose the input grows or one required condition fails. Trace how ${name} behaves and name the resulting state or output.`,
        applyHint: "State the input, follow the process in order, and name the resulting state or output.",
        applyAnswer: `A sound trace follows the source-backed process step by step and reaches a consistent output: ${claim}`,
      };
    case "history":
      return {
        learnTitle: `Explain the forces shaping ${name}.`,
        retrievePrompt: `What do your notes say caused ${spoken}, or what it led to?`,
        applyPrompt: `Suppose the source's main causal condition were weaker. Explain how that could alter the historical outcome.`,
        applyHint: "Name the changed condition, connect it to the source's cause, then explain the likely consequence.",
        applyAnswer: `A sound answer preserves the source's causal relationship while changing the historical condition: ${claim}`,
      };
    case "law":
      return {
        learnTitle: `Make the rule in ${name} usable.`,
        retrievePrompt: `What is the rule for ${spoken}, according to your notes?`,
        applyPrompt: `Suppose one required element of the rule for ${name} is missing. Apply the rule and give a qualified conclusion.`,
        applyHint: "State the rule, connect each relevant fact to it, then give a qualified conclusion.",
        applyAnswer: `A sound application states the source-backed rule, tests the relevant facts, and reaches a supported conclusion: ${claim}`,
      };
    case "mathematics":
      return {
        learnTitle: `Reconstruct the method behind ${name}.`,
        retrievePrompt: `What is the rule or method for ${spoken}?`,
        applyPrompt: `Suppose one condition of the rule or method for ${name} is not satisfied. Show what can still be concluded and why.`,
        applyHint: "Name the rule first, substitute or transform carefully, and check the result against the conditions.",
        applyAnswer: `A sound solution names the source-backed method, applies it step by step, and checks its conditions: ${claim}`,
      };
    default:
      return {
        learnTitle: `Make ${name} usable from the source.`,
        retrievePrompt: `What do your notes say about ${spoken}?`,
        applyPrompt: `Apply the source's claim about ${name} to a new example that is not copied from the page.`,
        applyHint: "Keep the same underlying relationship. Change only the situation.",
        applyAnswer: `A strong answer reuses this source-backed claim in a new context: ${claim}`,
      };
  }
}

/** Only pose a counterfactual when the page names a condition we can actually change. */
function sourceBackedApplication(name: string, claim: string, locator: string) {
  const dependency = claim.match(new RegExp(`^${escapeRegExp(name)}\\s+(?:depends on|requires)\\s+(.+?)(?:\\s+and\\s+|[.;]|$)`, "i"));
  const condition = dependency?.[1]?.trim();
  if (condition && condition.length <= 90) {
    return {
      prompt: `Your notes say ${name} depends on ${condition}. If ${condition} were missing, which conclusion from the notes could you no longer assume? Explain what ${locator} supports and what remains uncertain.`,
      hint: `Start with the stated dependency: ${name} depends on ${condition}. Do not invent an exact outcome the source does not give.`,
      modelAnswer: `The source states: ${claim} Without ${condition}, that stated relationship cannot simply be assumed. The source alone does not establish the exact new outcome.`,
    };
  }
  return null;
}

const RUBRIC_STOPWORDS = new Set(["answer", "application", "claim", "course", "idea", "identifies", "new", "result", "sound", "source", "source-backed", "uses"]);

function rubricTerms(value: string) {
  return [...new Set(value.toLocaleLowerCase().replace(/[^\p{L}\p{N}-]+/gu, " ").split(/\s+/)
    .filter((word) => word.length > 3 && !RUBRIC_STOPWORDS.has(word)))].slice(0, 10);
}

function assessmentFor(mode: SubjectMode, name: string, claim: string): NonNullable<LearningActivity["assessment"]> {
  const sourceTerms = rubricTerms(`${name} ${claim}`);
  const modeCriterion = {
    biology: { label: "Traces a mechanism and consequence", terms: ["because", "causes", "leads", "therefore", "result"] },
    computer_science: { label: "Traces input, process, and output", terms: ["input", "step", "process", "output", "result"] },
    history: { label: "Connects cause to historical consequence", terms: ["because", "caused", "led", "therefore", "consequence"] },
    law: { label: "Applies the rule to facts and reaches a conclusion", terms: ["rule", "fact", "element", "because", "conclusion"] },
    mathematics: { label: "Uses the rule and checks its conditions", terms: ["condition", "therefore", "because", "step", "result"] },
    general: { label: "Explains the relationship, not only the label", terms: ["because", "means", "leads", "therefore", "example"] },
  }[mode];
  return {
    mode,
    criteria: [
      { id: "source-idea", label: "Uses the central source idea", terms: sourceTerms, minimumMatches: Math.min(3, Math.max(1, Math.ceil(sourceTerms.length * 0.3))), appliesTo: "both" },
      { id: "reasoning", ...modeCriterion, minimumMatches: 1, appliesTo: "apply" },
      { id: "transfer", label: "Transfers the idea beyond memorized wording", terms: ["if", "when", "because", "therefore", "would", "could"], minimumMatches: 1, appliesTo: "apply" },
    ],
  };
}

function headingStrengthFor(name: string) {
  let strength = 0.35;
  if (NUMBER_PREFIX.test(name) || /^\d+/.test(name)) strength += 0.25;
  if (HEADING_PREFIX.test(name)) strength += 0.25;
  if (name === name.toUpperCase() && name.length > 4) strength += 0.1;
  return clamp(strength, 0, 1);
}

function scoreExamImportance(input: {
  name: string;
  excerpt: string;
  locator: string;
  corpus: string;
  index: number;
  total: number;
}) {
  let score = 0.52;
  score += clamp((mentionCount(input.name, input.corpus) - 1) * 0.035, 0, 0.14);
  score += headingStrengthFor(input.name) * 0.08;
  if (EXAM_SIGNAL.test(input.excerpt) || EXAM_SIGNAL.test(input.name)) score += 0.12;
  if (DEFINITION_SIGNAL.test(input.excerpt)) score += 0.05;
  if (pageNumberFromLocator(input.locator) <= 2) score += 0.04;
  score += clamp(((input.total - input.index) / Math.max(input.total, 1)) * 0.04, 0, 0.04);
  return clamp(Number(score.toFixed(3)), 0.35, 0.95);
}

function scoreDifficulty(excerpt: string) {
  let score = 0.45;
  if (excerpt.length > 180) score += 0.08;
  if (/\b(?:however|whereas|trade-?off|equilibrium|derivative|integral|theorem|proof|paradox)\b/i.test(excerpt)) {
    score += 0.12;
  }
  if (/\d/.test(excerpt)) score += 0.05;
  return clamp(Number(score.toFixed(3)), 0.3, 0.8);
}

/** The "Use" step in French: its own translation when there is one, else a plain French version of the same ask. */
function frenchApply(prompt: string, name: string, claim: string) {
  const translated = inNotesLanguage(prompt, "fr", name);
  return translated !== prompt ? translated : `Applique ce que disent tes notes sur « ${name} » à un exemple nouveau, qui ne vient pas de la page : “${claim}”`;
}

function buildActivity(concept: Concept, proposal: ProposedConcept, siblingNames: string[] = [], siblingFacts: string[] = []): LearningActivity {
  const claim = centralClaim(concept.name, proposal.sourceExcerpt);
  const practice = buildPractice({ conceptId: concept.id, name: concept.name, excerpt: proposal.sourceExcerpt, locator: proposal.locator, siblingNames, siblingFacts });
  // The "Use" step asks something the page actually supports: a stated condition or reason, in the learner's words.
  const facts = teachingFacts(concept.name, proposal.sourceExcerpt);
  const furtherFact = facts.find((fact) => fact !== claim && fact.length >= 30);
  const applyItem = practice.find((item) => item.kind === "scenario") ?? practice.find((item) => item.kind === "why")
    ?? (furtherFact
      ? {
          prompt: `Your notes also say: “${furtherFact}” Explain what that means, and give an example of your own.`,
          hint: `Reread ${proposal.locator}. Put the sentence in simpler words, then make up a case where it applies.`,
          modelAnswer: furtherFact,
        }
      : undefined);
  const language = activityLanguage(subjectModeFor(concept.name, proposal.sourceExcerpt), concept.name, claim);
  const application = sourceBackedApplication(concept.name, claim, proposal.locator);
  // Notes in French are asked about in French: the explanation and the "Use" step too, not only the checks.
  const french = noteLanguage(proposal.sourceExcerpt) === "fr";
  const applyPrompt = applyItem?.prompt ?? application?.prompt ?? `${language.applyPrompt} Use ${proposal.locator}: “${claim}” Do not claim a specific outcome the page does not establish.`;
  return {
    id: `activity-${concept.id}`,
    conceptId: concept.id,
    learn: {
      title: concept.name,
      explanation: claim,
      keyPoints: teachingFacts(concept.name, proposal.sourceExcerpt).slice(1, 4),
    },
    teach: { facts: teachingFacts(concept.name, proposal.sourceExcerpt), pageText: proposal.sourceExcerpt },
    practice,
    retrieve: {
      prompt: french ? frenchRecallQuestion(concept.name, claim) : recallQuestion(concept.name, claim, language.retrievePrompt),
      hint: `Return to ${proposal.locator}. Start from the relationship or definition, not a list of facts.`,
      explanation: claim,
      example: `Restate the source claim about ${concept.name} in one sentence, then add one detail from ${proposal.locator}.`,
      modelAnswer: claim,
    },
    apply: {
      prompt: french ? frenchApply(applyPrompt, concept.name, claim) : applyPrompt,
      hint: applyItem?.hint ?? application?.hint ?? language.applyHint,
      modelAnswer: applyItem?.modelAnswer ?? application?.modelAnswer ?? language.applyAnswer,
    },
    assessment: assessmentFor(subjectModeFor(concept.name, proposal.sourceExcerpt), concept.name, claim),
    sourceReferences: [{ materialId: proposal.materialId, label: proposal.sourceLabel, locator: proposal.locator }],
  };
}

function inferRelationships(concepts: Concept[], corpus: string): ConceptRelationship[] {
  const relationships: ConceptRelationship[] = [];
  const seen = new Set<string>();

  for (const left of concepts) {
    for (const right of concepts) {
      if (left.id === right.id) continue;
      const leftPattern = escapeRegExp(left.name);
      const rightPattern = escapeRegExp(right.name);

      // "Elasticity builds on Supply and Demand" => Supply and Demand → Elasticity
      const dependsOn = new RegExp(
        `\\b${leftPattern}\\b[\\s\\S]{0,40}\\b(?:requires|required|depends on|dependent on|builds on|built on|based on|assumes knowledge of)\\b[\\s\\S]{0,40}\\b${rightPattern}\\b`,
        "i",
      );
      // "Supply and Demand is a prerequisite for Elasticity"
      const precedes = new RegExp(
        `\\b${leftPattern}\\b[\\s\\S]{0,40}\\b(?:prerequisite for|before studying|before learning)\\b[\\s\\S]{0,40}\\b${rightPattern}\\b`,
        "i",
      );
      // Both names must be the related pair — not "related to Something Else".
      const related = new RegExp(
        `\\b${leftPattern}\\b[\\s\\S]{0,40}\\b(?:related to|closely related|see also|compared with|in contrast to|versus|vs\\.?)\\b[\\s\\S]{0,40}\\b${rightPattern}\\b`,
        "i",
      );

      let kind: ConceptRelationship["kind"] | null = null;
      let fromId = left.id;
      let toId = right.id;

      if (dependsOn.test(corpus)) {
        kind = "prerequisite";
        fromId = right.id;
        toId = left.id;
      } else if (precedes.test(corpus)) {
        kind = "prerequisite";
        fromId = left.id;
        toId = right.id;
      } else if (related.test(corpus)) {
        kind = "related";
      }
      if (!kind) continue;

      const key = `${kind}:${fromId}:${toId}`;
      const reverse = `${kind}:${toId}:${fromId}`;
      if (seen.has(key) || (kind === "related" && seen.has(reverse))) continue;
      if (kind === "prerequisite" && seen.has(`prerequisite:${toId}:${fromId}`)) continue;
      seen.add(key);
      relationships.push({ id: `rel-${stablePart(key)}`, fromId, toId, kind });
    }
  }

  return relationships.slice(0, 12);
}

function looksLikeConceptRelaxed(value: string) {
  if (isStatement(value) || notATopic(value)) return false;
  if (value.length < 3 || value.length > 80 || ADMINISTRATIVE.test(value) || GENERIC_HEADING.test(value.trim()) || isContinuation(value)) return false;
  if (/https?:|@|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(value)) return false;
  if (/\b(?:due|points?|percent|room)\b/i.test(value)) return false;
  const words = value.split(/\s+/);
  if (words.length > 12) return false;
  const titleWords = words.filter((word) => /^[A-Z][A-Za-z/&-]*$/.test(word)).length;
  return (
    HEADING_PREFIX.test(value) ||
    NUMBER_PREFIX.test(value) ||
    titleWords >= Math.max(1, Math.ceil(words.length * 0.35)) ||
    words.length <= 4
  );
}

function splitSparseLines(text: string) {
  return text
    .split(/\n+|•|;|—|–|\u2022/g)
    .flatMap((chunk) => chunk.split(/(?<=[.!?])\s+(?=[A-Z])/))
    .map((line) => line.trim())
    .filter(Boolean);
}

export function proposeConceptsFromPages(input: {
  materialId: string;
  sourceLabel: string;
  pages: ExtractedMaterialPage[];
  limit?: number;
  mode?: "strict" | "relaxed";
  /** Notes are divided into sections, not pages. */
  locatorLabel?: "Page" | "Section";
}): ProposedConcept[] {
  const proposals: ProposedConcept[] = [];
  const seen = new Set<string>();
  const limit = input.limit ?? MAX_PROPOSED_TOPICS;
  const matcher = input.mode === "relaxed" ? looksLikeConceptRelaxed : looksLikeConcept;
  // Only a title set apart by its size is skipped: "Week 1: Supply and Demand" is a heading with a real topic in it.
  const seenPassages = new Set<string>();
  const title = input.locatorLabel === "Section" ? null : layoutTitle([...input.pages].filter((page) => page.pageNumber > 0).sort((a, b) => a.pageNumber - b.pageNumber)[0]);
  const titleKey = title ? title.toLocaleLowerCase() : null;

  for (const page of input.pages) {
    // A PDF page knows its paragraphs and font sizes: a heading stands alone or is set larger. A wrapped body line
    // full of names ("Triple Alliance joined Germany, Austria-Hungary") is never a heading, however capitalised.
    const layout = input.mode !== "relaxed" && Boolean(page.blocks?.length);
    const lines: string[] = [];
    const standalone: boolean[] = [];
    if (input.mode === "relaxed") lines.push(...splitSparseLines(page.text));
    else for (const paragraph of page.text.split(/\n{2,}/)) {
      const inner = paragraph.split(/\n/).map((line) => line.trim()).filter(Boolean);
      for (const line of inner) { lines.push(line); standalone.push(inner.length === 1); }
    }
    const bodySizes = page.blocks?.map((block) => block.fontSize).filter((size) => size > 0).sort((a, b) => a - b) ?? [];
    const bodySize = bodySizes.length ? bodySizes[Math.floor(bodySizes.length / 2)] : 0;
    const layoutHeadings = new Set(page.blocks?.filter((block) => bodySize > 0 && block.fontSize >= bodySize * 1.16 && block.text.length <= 96).map((block) => cleanCandidate(block.text).toLocaleLowerCase()) ?? []);
    const sizeOf = new Map(page.blocks?.map((block) => [cleanCandidate(block.text).toLocaleLowerCase(), block.fontSize]) ?? []);
    const isHeading = (line: string, at: number) => {
      const key = cleanCandidate(line).toLocaleLowerCase();
      if (layoutHeadings.has(key)) return true;
      if (!layout) return matcher(line);
      // Same-size headings (bold in a Word export) still count, but only alone in their paragraph and not smaller
      // than body text: a table's header row is not a topic.
      return Boolean(standalone[at]) && matcher(line) && (sizeOf.get(key) ?? bodySize) >= bodySize * 0.98;
    };
    lines.forEach((line, index) => {
      const layoutHeading = layoutHeadings.has(cleanCandidate(line).toLocaleLowerCase());
      if (proposals.length >= limit || !isHeading(line, index)) return;
      const locator = page.pageNumber === 0 ? "Document outline" : `${input.locatorLabel ?? "Page"} ${page.pageNumber}`;
      const sourceExcerpt = excerptFor(lines, index, line, layout ? isHeading : undefined);
      const heading = cleanCandidate(line);
      const name = topicNameFrom(heading, sourceExcerpt, locator);
      const key = name.toLocaleLowerCase();
      if (key === titleKey) return;
      if ((!matcher(heading) && !layoutHeading) || seen.has(key) || ADMINISTRATIVE.test(name) || GENERIC_HEADING.test(name.trim()) || isDocumentTitle(name) || isContinuation(heading) || notATopic(heading) || isStatement(heading)) return;
      // A slide with several headings gives them all the same passage; only the first is a topic.
      const passageKey = `${page.pageNumber}:${sourceExcerpt.replace(/\s+/g, " ").trim().toLocaleLowerCase()}`;
      if (creditOnly(sourceExcerpt) || seenPassages.has(passageKey)) return;
      seenPassages.add(passageKey);
      seen.add(key);
      proposals.push({
        id: `proposal-${stablePart(`${input.materialId}:${key}`)}`,
        materialId: input.materialId,
        name,
        sourceLabel: input.sourceLabel,
        locator,
        sourceExcerpt,
      });
    });
  }
  return proposals;
}

const METADATA_STOPWORDS = new Set([
  "a", "an", "and", "the", "of", "to", "in", "on", "for", "with", "from",
  "week", "lecture", "notes", "note", "pdf", "syllabus", "chapter", "unit",
  "final", "midterm", "exam", "course", "intro", "introduction", "part",
  "section", "doc", "handout", "slides", "slide", "reading", "assignment",
]);

export function proposeConceptsFromMetadata(input: {
  materialId: string;
  sourceLabel: string;
  fileName?: string | null;
  limit?: number;
}): ProposedConcept[] {
  const limit = input.limit ?? 4;
  const raw = `${input.sourceLabel} ${input.fileName ?? ""}`
    .replace(/\.pdf$/i, " ")
    .replace(/[-_+/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!raw) return [];

  const phrases: string[] = [];
  const cleanedTitle = cleanCandidate(raw);
  if (cleanedTitle.length >= 3 && cleanedTitle.length <= 72) phrases.push(cleanedTitle);

  for (const token of raw.split(/\s+/)) {
    const word = token.replace(/[^A-Za-z&/-]/g, "");
    if (word.length < 4) continue;
    if (METADATA_STOPWORDS.has(word.toLocaleLowerCase())) continue;
    if (/^\d+$/.test(word)) continue;
    phrases.push(word[0].toUpperCase() + word.slice(1));
  }

  const proposals: ProposedConcept[] = [];
  const seen = new Set<string>();
  for (const phrase of phrases) {
    if (proposals.length >= limit) break;
    const name = cleanCandidate(phrase);
    const key = name.toLocaleLowerCase();
    if (!name || seen.has(key) || ADMINISTRATIVE.test(name)) continue;
    seen.add(key);
    proposals.push({
      id: `proposal-${stablePart(`${input.materialId}:meta:${key}`)}`,
      materialId: input.materialId,
      name,
      sourceLabel: input.sourceLabel,
      locator: "From filename",
      sourceExcerpt: `Suggested from the file title “${input.sourceLabel}”. Edit or remove anything that is not an exam concept.`,
    });
  }
  return proposals;
}

/** Small words every readable English passage uses. Scan noise ("omaliance tet Sralysing fuel co") has almost none. */
const FUNCTION_WORDS = new Set(["a", "an", "the", "of", "to", "in", "on", "at", "by", "for", "with", "from", "and", "or", "but", "is", "are", "was", "were", "be", "been", "has", "have", "had", "it", "its", "this", "that", "these", "those", "as", "into", "not", "no", "can", "will", "when", "which", "who", "than", "then", "so", "if", "their", "they", "there", "each", "all", "more", "most", "one", "two", "many", "some", "per", "between", "does", "do",
  // French and Spanish: notes in either language read as text, not noise.
  "le", "la", "les", "un", "une", "des", "du", "de", "et", "est", "sont", "en", "dans", "par", "pour", "sur", "avec", "au", "aux", "qui", "que", "ce", "cette", "se", "il", "elle", "ils", "elles", "plus", "ou", "el", "los", "las", "y", "es", "con", "por", "para", "del", "una", "lo"]);

/**
 * Readable text, not scan noise: at least one small connecting word per dozen words, and most words look like words
 * (letters with vowels, not one-letter or broken fragments). Slide bullets pass; garbled OCR does not.
 */
export function looksReadable(text: string) {
  // Single letters ("O(n)", "x") are notation, not evidence either way.
  const words = text.toLocaleLowerCase().split(/[^\p{L}'-]+/u).filter((word) => word.length > 1 || word === "a");
  if (words.length < 5) return false;
  const glue = words.filter((word) => FUNCTION_WORDS.has(word)).length;
  const wordLike = words.filter((word) => /[aeiouyàâäéèêëîïôöùûüœæáíóú]/.test(word) && !/(.)\1\1/.test(word)).length;
  return glue >= Math.max(1, Math.floor(words.length / 12)) && wordLike / words.length >= 0.8;
}

/** A filename or outline can suggest a topic, but cannot support a lesson or answer key. */
export function isSourceBackedProposal(proposal: ProposedConcept) {
  const excerpt = proposal.sourceExcerpt.trim();
  return /^(?:Page|Section) [1-9]\d*$/i.test(proposal.locator)
    && excerpt.length >= 30
    && excerpt.split(/\s+/).length >= 5
    && excerpt.toLocaleLowerCase() !== proposal.name.trim().toLocaleLowerCase()
    && !/^Suggested from the file title/i.test(excerpt)
    && !ADMINISTRATIVE_EXCERPT.test(excerpt)
    && looksReadable(excerpt);
}

export function proposalConfidence(proposal: ProposedConcept): "high" | "review" {
  return isSourceBackedProposal(proposal) ? "high" : "review";
}

export function buildConfirmedMaterialModel(input: {
  proposals: ProposedConcept[];
  courseId: string;
  userId: string;
  nowIso: string;
  pages?: ExtractedMaterialPage[];
}) {
  if (!input.proposals.length || input.proposals.some((proposal) => !isSourceBackedProposal(proposal))) {
    throw new Error("A confirmed topic needs a readable passage from a PDF page. Try a clearer source before building its lesson.");
  }
  const corpus = [
    ...(input.pages ?? []).map((page) => page.text),
    ...input.proposals.map((proposal) => `${proposal.name}\n${proposal.sourceExcerpt}`),
  ].join("\n");

  const concepts: Concept[] = input.proposals.map((proposal, index) => ({
    id: `c-source-${stablePart(`${input.courseId}:${proposal.name.toLocaleLowerCase()}`)}`,
    courseId: input.courseId,
    userId: input.userId,
    name: proposal.name,
    examImportance: scoreExamImportance({
      name: proposal.name,
      excerpt: proposal.sourceExcerpt,
      locator: proposal.locator,
      corpus,
      index,
      total: input.proposals.length,
    }),
    difficulty: scoreDifficulty(proposal.sourceExcerpt),
    estimatedMinutes: 18,
    mastery: 0,
    confidence: 0,
    predictedRetention: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    retrievalAttempts: 0,
    successfulRetrievals: 0,
    failedRetrievals: 0,
    createdAt: input.nowIso,
    updatedAt: input.nowIso,
  }));

  const uniqueScores = new Set(concepts.map((concept) => concept.examImportance.toFixed(2)));
  if (concepts.length > 1 && uniqueScores.size === 1) {
    concepts.forEach((concept, index) => {
      concept.examImportance = clamp(
        Number((concept.examImportance + (concepts.length - index - 1) * 0.02 - index * 0.01).toFixed(3)),
        0.35,
        0.95,
      );
    });
  }

  const proposalByName = new Map(input.proposals.map((proposal) => [proposal.name, proposal]));
  const prompts: Prompt[] = concepts.map((concept) => {
    const proposal = proposalByName.get(concept.name)!;
    return {
      id: `p-${concept.id}`,
      conceptId: concept.id,
      promptText: recallQuestion(concept.name, centralClaim(concept.name, proposal.sourceExcerpt), `From memory, explain the central claim about ${concept.name} from ${proposal.locator}.`),
      modelAnswer: centralClaim(concept.name, proposal.sourceExcerpt),
    };
  });
  const factsByTopic = new Map(input.proposals.map((proposal) => [proposal.name, teachingFacts(proposal.name, proposal.sourceExcerpt, 3)]));
  const factsFromOtherTopics = (topic: string) => [...factsByTopic.entries()].filter(([other]) => other !== topic).flatMap(([, facts]) => facts).slice(0, 40);
  const learningActivities: LearningActivity[] = concepts.map((concept) =>
    buildActivity(concept, proposalByName.get(concept.name)!, concepts.map((item) => item.name), factsFromOtherTopics(concept.name)),
  );
  const relationships = inferRelationships(concepts, corpus);
  return { concepts, prompts, learningActivities, relationships };
}
