import { buildAnswerReason } from "./answer-reason";
import { splitSentences } from "./content-engine";
import type { LeitnerLine } from "./leitner";
import { isDrillable } from "./practice-check";
import type { MissedLine } from "./return-visit";
import type { LearningActivity } from "./types";

/** Days a line waits in each box before it is asked again (domain/leitner.ts BOXES). */
const WAIT_DAYS = [1, 2, 4, 9, 30];

export type LineLife = {
  quote: string;
  topic: string;
  /** Where the line is: the file and its page or section, as the import found them. */
  source: string | null;
  /** The line after it in the notes, when there is one: what the idea leads into. */
  next: string | null;
  /** How Kelus asks this line, as the questions read: the line itself in “…”, with its gap. */
  asked: Array<{ prompt: string; answer: string }>;
  /** Why the answer holds, when the notes support a sentence that precise. */
  reason: string | null;
  /** Every answer this line has had on this device, oldest first. */
  answers: Array<{ at: string; right: boolean }>;
  box: LeitnerLine["box"];
  state: LeitnerLine["state"];
  /** When it is asked again: an ISO day, or null when it is in tomorrow's warm-up or not asked yet. */
  backOn: string | null;
};

const key = (text: string) => text.trim().replace(/^["“]|["”]$/g, "").toLocaleLowerCase();

/**
 * One line of the notes, followed all the way: where it is, how Kelus asks it, every answer it has had, the box it
 * sits in and when it is back. Built only from what is stored; nothing here is estimated or written for effect.
 */
export function lineLife(input: { line: LeitnerLine; activity: LearningActivity | undefined; known: MissedLine[]; history: Array<{ quote: string; at: string; right: boolean }> }): LineLife {
  const { line, activity } = input;
  const id = key(line.quote);
  const items = (activity?.practice ?? []).filter((item) => isDrillable(item) && key(item.sourceQuote) === id);
  const sentences = activity ? splitSentences([activity.learn.explanation, ...activity.learn.keyPoints].join("\n")) : [];
  const at = sentences.findIndex((sentence) => key(sentence) === id);
  const next = at >= 0 ? sentences[at + 1] ?? null : null;
  const grounded = items.map((item) => buildAnswerReason(item)).find((reason) => reason.grounded && reason.shape !== "gap");
  const reference = activity?.sourceReferences[0];
  const source = reference ? [reference.label, reference.locator].filter(Boolean).join(" · ") || null : null;
  const known = input.known.find((entry) => key(entry.quote) === id);
  const backOn = line.state === "recalled" && known
    ? new Date(Date.parse(known.at) + WAIT_DAYS[line.box - 1] * 86_400_000).toISOString().slice(0, 10)
    : null;
  return {
    quote: line.quote.replace(/^["“]|["”]$/g, "").trim(),
    topic: line.topic,
    source,
    next: next && key(next) !== id ? next : null,
    asked: items.slice(0, 3).map((item) => ({ prompt: item.prompt, answer: item.modelAnswer })),
    reason: grounded?.reason ?? null,
    answers: input.history.filter((entry) => key(entry.quote) === id).map(({ at: when, right }) => ({ at: when, right })),
    box: line.box,
    state: line.state,
    backOn,
  };
}
