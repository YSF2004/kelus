import { maskName } from "./content-engine";
import type { Concept, LearningActivity } from "./types";

export type MatchPair = { conceptId: string; name: string; line: string };

/** Lines long enough to say something, short enough to read in a glance. */
const MIN_LINE = 30;
const MAX_LINE = 180;
export const MAX_PAIRS = 4;

/**
 * A matching round from the topics just practised: each topic beside its own defining line from the notes, with the
 * topic's name hidden in the line so the match is recall, not word-spotting. A line that names its topic anywhere but
 * as the opening subject is left out rather than given away. Fewer than three usable topics: no round.
 */
export function buildMatchRound(conceptIds: string[], concepts: Concept[], activities: LearningActivity[]): MatchPair[] {
  const pairs: MatchPair[] = [];
  for (const id of conceptIds) {
    const concept = concepts.find((item) => item.id === id);
    const activity = activities.find((item) => item.conceptId === id);
    const line = activity?.learn.explanation?.trim();
    if (!concept || !line || line.length < MIN_LINE || line.length > MAX_LINE) continue;
    const mentions = new RegExp(`(?<![\\p{L}])${concept.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`, "iu").test(line);
    const shown = mentions ? maskName(line, concept.name) : line;
    if (!shown) continue;
    // Two topics with the same line would make the round unfair.
    if (pairs.some((pair) => pair.line === shown)) continue;
    pairs.push({ conceptId: id, name: concept.name, line: shown });
    if (pairs.length >= MAX_PAIRS) break;
  }
  return pairs.length >= 3 ? pairs : [];
}

/** A stable shuffle, so the right column is never in the left column's order and is the same on a reload. */
export function matchOrder(pairs: MatchPair[], seed: string) {
  const h = (text: string) => { let x = 2166136261; for (const c of text) { x ^= c.charCodeAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };
  const order = [...pairs].sort((a, b) => h(seed + a.conceptId) - h(seed + b.conceptId));
  // Never leave every line beside its own topic.
  return order.every((pair, index) => pair.conceptId === pairs[index].conceptId) ? [...order.slice(1), order[0]] : order;
}
