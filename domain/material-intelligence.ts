import type {
  Concept,
  ExtractedMaterialLine,
  ExtractedMaterialPage,
  LearningActivity,
  Prompt,
  ProposedConcept,
  SubjectDomain,
} from "./types";

const ADMINISTRATIVE = /\b(?:answer key|assessment|assignment|attendance|calendar|contact|course syllabus|email|exercise(?:s)?|grading|homework|instructor|office hours|policy|practice questions?|problem set|quiz|reading list|schedule|solution(?:s)?|syllabus|textbook)\b/i;
const HEADING_PREFIX = /^(?:week|module|topic|chapter|unit|lecture|section)\s*\d*[.:\-–—]?\s*/i;
const NUMBER_PREFIX = /^\s*(?:\d+(?:\.\d+)*|[ivx]+)[.)\-:]\s*/i;
const TERMINAL_PUNCTUATION = /[.!?;]$/;

const SUBJECT_SIGNALS: Array<{ domain: SubjectDomain; pattern: RegExp }> = [
  { domain: "mathematics", pattern: /\b(?:theorem|proof|function|derivative|integral|matrix|equation|probability|geometry|algebra|calculus)\b/i },
  { domain: "computer_science", pattern: /\b(?:algorithm|array|hash|graph|software|program|code|database|computer|recursion|complexity|data structure)\b/i },
  { domain: "biology", pattern: /\b(?:cell|gene|protein|enzyme|organism|membrane|respiration|photosynthesis|anatomy|physiology|dna|atp)\b/i },
  { domain: "law", pattern: /\b(?:court|doctrine|statute|liability|contract|tort|precedent|plaintiff|defendant|jurisdiction|enforceable)\b/i },
  { domain: "history", pattern: /\b(?:century|war|revolution|empire|industrial|movement|migration|historical|colonial|workers|urban)\b/i },
];

type CandidateLine = ExtractedMaterialLine & { blankBefore: boolean };

function cleanCandidate(value: string) {
  return value
    .replace(NUMBER_PREFIX, "")
    .replace(HEADING_PREFIX, "")
    .replace(/\s+/g, " ")
    .replace(/^[\s:;,.\-–—]+|[\s:;,.\-–—]+$/g, "")
    .trim();
}

function wordsIn(value: string) {
  return value.split(/\s+/).filter(Boolean);
}

function titleCaseRatio(value: string) {
  const words = wordsIn(value);
  const titleWords = words.filter((word) => /^[A-Z][A-Za-z/&'-]*$/.test(word)).length;
  return words.length ? titleWords / words.length : 0;
}

function looksLikeConcept(value: string, layoutSignal = false) {
  if (value.length < 3 || value.length > 72 || ADMINISTRATIVE.test(value)) return false;
  if (/https?:|@|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(value)) return false;
  if (/\b(?:due|points?|percent|room|pm|am)\b/i.test(value)) return false;
  const words = wordsIn(value);
  if (words.length > 9) return false;
  const explicit = HEADING_PREFIX.test(value) || NUMBER_PREFIX.test(value);
  const uppercase = value.length >= 4 && value === value.toLocaleUpperCase() && /[A-Z]/.test(value);
  const titleStyle = titleCaseRatio(value) >= 0.55;
  const conciseSentenceCase = layoutSignal && words.length <= 8 && !TERMINAL_PUNCTUATION.test(value);
  return explicit || uppercase || titleStyle || conciseSentenceCase;
}

function stablePart(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function inferSubjectDomain(value: string): SubjectDomain {
  return SUBJECT_SIGNALS.find((signal) => signal.pattern.test(value))?.domain ?? "general";
}

function sentences(value: string) {
  return value.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
}

function activityLanguage(domain: SubjectDomain, conceptName: string, excerpt: string) {
  const points = sentences(excerpt).slice(0, 3);
  const keyPoints = points.length >= 2 ? points : [
    `Identify the central claim about ${conceptName}.`,
    "Reconstruct the claim without looking at the source.",
  ];
  if (domain === "mathematics") return {
    title: `Understand when ${conceptName} applies.`,
    retrieve: `State ${conceptName}, including the conditions that make it valid.`,
    example: `Identify which condition would fail in a counterexample to ${conceptName}.`,
    apply: `Apply ${conceptName} to a new case and justify each condition you use.`,
    hint: "Separate the assumptions from the conclusion before calculating.",
    keyPoints,
  };
  if (domain === "computer_science") return {
    title: `Trace how ${conceptName} works.`,
    retrieve: `Explain the mechanism of ${conceptName} and the problem it solves.`,
    example: `Trace ${conceptName} on a small input from start to finish.`,
    apply: `Choose where ${conceptName} fits in a new system and explain the trade-off.`,
    hint: "Name the input, the transformation, and the resulting output.",
    keyPoints,
  };
  if (domain === "biology") return {
    title: `Follow the biological mechanism behind ${conceptName}.`,
    retrieve: `Explain the sequence or mechanism that defines ${conceptName}.`,
    example: `Connect ${conceptName} to a change in a cell, organism, or biological system.`,
    apply: `Predict what changes when one part of ${conceptName} is disrupted.`,
    hint: "Trace the process from the starting condition to the biological result.",
    keyPoints,
  };
  if (domain === "history") return {
    title: `Explain the forces shaping ${conceptName}.`,
    retrieve: `Explain the causes, development, and consequence of ${conceptName}.`,
    example: `Connect ${conceptName} to one actor, institution, or change described in the source.`,
    apply: `Use the source evidence to compare ${conceptName} with another historical situation.`,
    hint: "Build a chain from context to cause to consequence.",
    keyPoints,
  };
  if (domain === "law") return {
    title: `Build the legal test for ${conceptName}.`,
    retrieve: `State the rule and required elements of ${conceptName}.`,
    example: `Identify which fact would determine whether ${conceptName} applies.`,
    apply: `Apply ${conceptName} to a new fact pattern and reach a supported conclusion.`,
    hint: "Separate the rule, relevant facts, application, and conclusion.",
    keyPoints,
  };
  return {
    title: `Build a usable explanation of ${conceptName}.`,
    retrieve: `Explain the central claim behind ${conceptName} in your own words.`,
    example: `Connect ${conceptName} to one concrete example from the course.`,
    apply: `Use ${conceptName} to explain a new example or situation.`,
    hint: "Keep the central relationship from the source while changing the context.",
    keyPoints,
  };
}

function sourceRelationships(proposals: ProposedConcept[], courseId: string) {
  const relationships = [];
  for (const target of proposals) {
    for (const prerequisite of proposals) {
      if (target.id === prerequisite.id) continue;
      const escaped = prerequisite.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const forward = new RegExp(`(?:requires|depends on|builds on|assumes|after|following)\\s+(?:an understanding of\\s+)?${escaped}`, "i");
      const reverse = new RegExp(`${escaped}\\s+(?:is|required|must be understood)\\s+(?:before|prior to)`, "i");
      const explicit = forward.test(target.sourceExcerpt) || reverse.test(target.sourceExcerpt);
      const referenced = new RegExp(`\\b${escaped}\\b`, "i").test(target.sourceExcerpt);
      if (!explicit && !referenced) continue;
      relationships.push({
        id: `rel-${stablePart(`${prerequisite.name}:${target.name}:${target.materialId}`)}`,
        fromId: `c-source-${stablePart(`${courseId}:${prerequisite.name.toLocaleLowerCase()}`)}`,
        toId: `c-source-${stablePart(`${courseId}:${target.name.toLocaleLowerCase()}`)}`,
        kind: explicit ? "prerequisite" as const : "related" as const,
        evidence: {
          materialId: target.materialId,
          label: target.sourceLabel,
          locator: target.locator,
          excerpt: target.sourceExcerpt,
          basis: explicit ? "explicit_dependency" as const : "source_cross_reference" as const,
          confidence: explicit ? "high" as const : "medium" as const,
        },
      });
    }
  }
  return relationships;
}

function median(values: number[]) {
  const ordered = [...values].sort((a, b) => a - b);
  if (!ordered.length) return 0;
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function linesForPage(page: ExtractedMaterialPage): CandidateLine[] {
  if (page.lines?.length) {
    return page.lines.map((line) => ({ ...line, blankBefore: line.paragraphBreakBefore }));
  }
  let blankBefore = true;
  return page.text.split("\n").flatMap((raw, index) => {
    const text = raw.trim();
    if (!text) {
      blankBefore = true;
      return [];
    }
    const line: CandidateLine = {
      text,
      x: 0,
      y: -index,
      width: text.length,
      fontSize: 0,
      paragraphBreakBefore: blankBefore,
      blankBefore,
    };
    blankBefore = false;
    return [line];
  });
}

function layoutHeadingSignal(line: CandidateLine, pageMedianFont: number) {
  if (!pageMedianFont || !line.fontSize) return false;
  return line.fontSize >= pageMedianFont * 1.14 || (line.blankBefore && line.fontSize >= pageMedianFont * 1.04);
}

function headingConfidence(line: CandidateLine, pageMedianFont: number): "high" | "medium" {
  return HEADING_PREFIX.test(line.text)
    || NUMBER_PREFIX.test(line.text)
    || line.text === line.text.toLocaleUpperCase()
    || line.fontSize >= pageMedianFont * 1.2
    ? "high"
    : "medium";
}

function conceptKey(value: string) {
  return cleanCandidate(value)
    .toLocaleLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:an|a|the|introduction to|intro to)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerptFor(lines: CandidateLine[], index: number, pageMedianFont: number) {
  const paragraph: string[] = [];
  for (let cursor = index + 1; cursor < lines.length && paragraph.join(" ").length < 900; cursor += 1) {
    const line = lines[cursor];
    const layoutSignal = layoutHeadingSignal(line, pageMedianFont);
    if (looksLikeConcept(line.text, layoutSignal)) break;
    if (paragraph.length && line.blankBefore) break;
    if (line.text.length < 12 || ADMINISTRATIVE.test(line.text)) continue;
    paragraph.push(line.text);
  }
  return paragraph.join(" ").replace(/\s+/g, " ").trim().slice(0, 900);
}

export function proposeConceptsFromPages(input: {
  materialId: string;
  sourceLabel: string;
  pages: ExtractedMaterialPage[];
  limit?: number;
}): ProposedConcept[] {
  const proposals: ProposedConcept[] = [];
  const seen = new Set<string>();
  const limit = input.limit ?? 12;

  for (const page of input.pages) {
    const lines = linesForPage(page);
    const pageMedianFont = median(lines.map((line) => line.fontSize).filter((value) => value > 0));
    lines.forEach((line, index) => {
      const layoutSignal = layoutHeadingSignal(line, pageMedianFont);
      if (proposals.length >= limit || !looksLikeConcept(line.text, layoutSignal)) return;
      const name = cleanCandidate(line.text);
      const key = conceptKey(name);
      if (!key || !looksLikeConcept(name, layoutSignal) || seen.has(key)) return;
      const excerpt = excerptFor(lines, index, pageMedianFont);
      if (!excerpt) return;
      seen.add(key);
      const locator = `Page ${page.pageNumber}`;
      proposals.push({
        id: `proposal-${stablePart(`${input.materialId}:${key}`)}`,
        materialId: input.materialId,
        name,
        sourceLabel: input.sourceLabel,
        locator,
        sourceExcerpt: excerpt,
        subjectDomain: inferSubjectDomain(`${name} ${excerpt}`),
        headingConfidence: headingConfidence(line, pageMedianFont),
      });
    });
  }
  return proposals;
}

export function buildConfirmedMaterialModel(input: {
  proposals: ProposedConcept[];
  courseId: string;
  userId: string;
  nowIso: string;
}) {
  const concepts: Concept[] = input.proposals.map((proposal) => ({
    id: `c-source-${stablePart(`${input.courseId}:${proposal.name.toLocaleLowerCase()}`)}`,
    courseId: input.courseId,
    userId: input.userId,
    name: proposal.name,
    subjectDomain: proposal.subjectDomain,
    // Neutral planning defaults keep the route operational. Their provenance is
    // explicit so the interface never presents them as facts extracted from a PDF.
    examImportance: 0.5,
    examImportanceSource: "estimated",
    difficulty: 0.5,
    estimatedMinutes: 15,
    estimatedMinutesSource: "estimated",
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
  const proposalByName = new Map(input.proposals.map((proposal) => [proposal.name, proposal]));
  const prompts: Prompt[] = concepts.map((concept) => {
    const proposal = proposalByName.get(concept.name)!;
    return {
      id: `p-${concept.id}`,
      conceptId: concept.id,
      promptText: `Explain ${concept.name} in your own words using the course source.`,
      modelAnswer: proposal.sourceExcerpt,
    };
  });
  const learningActivities: LearningActivity[] = concepts.map((concept) => {
    const proposal = proposalByName.get(concept.name)!;
    const language = activityLanguage(proposal.subjectDomain, concept.name, proposal.sourceExcerpt);
    return {
      id: `activity-${concept.id}`,
      conceptId: concept.id,
      learn: {
        title: language.title,
        explanation: proposal.sourceExcerpt,
        keyPoints: language.keyPoints,
      },
      retrieve: {
        prompt: language.retrieve,
        hint: `Return to ${proposal.locator} and identify the relationship or definition attached to this topic.`,
        explanation: proposal.sourceExcerpt,
        example: language.example,
        modelAnswer: proposal.sourceExcerpt,
      },
      apply: {
        prompt: language.apply,
        hint: language.hint,
        modelAnswer: `A sound application should preserve the source's central claim: ${proposal.sourceExcerpt}`,
      },
      sourceReferences: [{ materialId: proposal.materialId, label: proposal.sourceLabel, locator: proposal.locator }],
    };
  });
  // Ordering alone is not evidence. Explicit dependency language creates a
  // prerequisite; a direct cross-reference creates a non-routing related edge.
  const relationships = sourceRelationships(input.proposals, input.courseId);
  return { concepts, prompts, learningActivities, relationships };
}
