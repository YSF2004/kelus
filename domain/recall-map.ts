import { isDrillable } from "./practice-check";
import { buildPractice } from "./content-engine";
import type { MissedLine } from "./return-visit";
import type { Concept, LearningActivity } from "./types";

export type LineState = "recalled" | "back" | "new";
export type RecallTopic = { id: string; name: string; lines: Array<{ quote: string; state: LineState }>; recalled: number };
export type RecallMap = { topics: RecallTopic[]; total: number; recalled: number; back: number; thisWeek: number };

const key = (quote: string) => quote.trim().toLocaleLowerCase();

/** Questions written when a session opens (the built-in sample stores none), built the same way, once per activity. */
const written = new Map<string, string[]>();
function askedLines(activity: LearningActivity, concept: Concept, siblingNames: string[]) {
  if (activity.practice?.length) return activity.practice.filter(isDrillable).map((item) => item.sourceQuote);
  const excerpt = [activity.learn.explanation, ...activity.learn.keyPoints].join("\n");
  // Keyed by what the questions are made from, so a reloaded or copied state does not build them again.
  const id = `${activity.conceptId}|${concept.name}|${siblingNames.join(",")}|${excerpt}`;
  const cached = written.get(id);
  if (cached) return cached;
  const lines = buildPractice({
    conceptId: activity.conceptId,
    name: concept.name,
    excerpt,
    locator: activity.sourceReferences?.[0]?.locator ?? "this page",
    siblingNames,
  }).filter(isDrillable).map((item) => item.sourceQuote);
  if (written.size > 400) written.clear();
  written.set(id, lines);
  return lines;
}

/**
 * Every line Kelus can ask about, topic by topic in the order of the notes, and where each one stands: recalled (answered
 * right and not missed since), coming back (missed, first in the next warm-up), or not yet asked. One honest number for
 * "how ready am I": lines you can recall, out of the lines there are. Nothing is estimated.
 */
export function recallMap(input: { concepts: Concept[]; activities: LearningActivity[]; known: MissedLine[]; missed: MissedLine[]; nowIso: string }): RecallMap {
  const known = new Map(input.known.map((line) => [key(line.quote), line]));
  const missed = new Set(input.missed.map((line) => key(line.quote)));
  const weekAgo = Date.parse(input.nowIso) - 7 * 86_400_000;
  let thisWeek = 0;
  const seen = new Set<string>();
  const topics = input.concepts.map((concept) => {
    const activity = input.activities.find((item) => item.conceptId === concept.id);
    const siblings = input.concepts.filter((item) => item.courseId === concept.courseId).map((item) => item.name);
    const quotes = [
      ...(activity?.learn ? askedLines(activity, concept, siblings) : (activity?.practice ?? []).filter(isDrillable).map((item) => item.sourceQuote)),
      activity?.retrieve.modelAnswer ?? "",
    ];
    const lines: RecallTopic["lines"] = [];
    for (const quote of quotes) {
      const id = key(quote);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      const recalled = known.get(id);
      if (recalled && Date.parse(recalled.at) >= weekAgo) thisWeek += 1;
      lines.push({ quote: quote.trim(), state: recalled ? "recalled" : missed.has(id) ? "back" : "new" });
    }
    // Known lines from this topic that its current questions no longer quote still count: they were recalled.
    for (const line of input.known) {
      const id = key(line.quote);
      if (line.conceptId !== concept.id || seen.has(id)) continue;
      seen.add(id);
      if (Date.parse(line.at) >= weekAgo) thisWeek += 1;
      lines.push({ quote: line.quote.trim(), state: "recalled" });
    }
    // And missed lines it no longer quotes (an own-words answer is compared with whole sentences): still to come back.
    for (const line of input.missed) {
      const id = key(line.quote);
      if (line.conceptId !== concept.id || seen.has(id)) continue;
      seen.add(id);
      lines.push({ quote: line.quote.trim(), state: "back" });
    }
    return { id: concept.id, name: concept.name, lines, recalled: lines.filter((line) => line.state === "recalled").length };
  }).filter((topic) => topic.lines.length);
  const all = topics.flatMap((topic) => topic.lines);
  return {
    topics,
    total: all.length,
    recalled: all.filter((line) => line.state === "recalled").length,
    back: all.filter((line) => line.state === "back").length,
    thisWeek,
  };
}
