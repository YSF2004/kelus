import { isDrillable } from "./practice-check";
import type { MissedLine } from "./return-visit";
import type { Concept, LearningActivity } from "./types";

export type LineState = "recalled" | "back" | "new";
export type RecallTopic = { id: string; name: string; lines: Array<{ quote: string; state: LineState }>; recalled: number };
export type RecallMap = { topics: RecallTopic[]; total: number; recalled: number; back: number; thisWeek: number };

const key = (quote: string) => quote.trim().toLocaleLowerCase();

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
    const quotes = [
      ...(activity?.practice ?? []).filter(isDrillable).map((item) => item.sourceQuote),
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
