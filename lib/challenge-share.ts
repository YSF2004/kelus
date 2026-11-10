import type { LearningActivity } from "@/domain/types";

export const CHALLENGE_BUCKET = "kelus-course-materials";
export const CHALLENGE_TTL_SECONDS = 7 * 24 * 60 * 60;
export const MAX_CHALLENGE_CARDS = 12;

export type ChallengeCard = {
  question: string;
  answer: string;
  explanation?: string;
};

export type ChallengeSnapshot = {
  version: 1;
  cards: ChallengeCard[];
};

/** Build a compact copy of the actual retrieve/apply prompts; source files, quotes, and learner answers stay out. */
export function cardsForSession(activities: LearningActivity[], conceptIds: string[]): ChallengeCard[] {
  const byConcept = new Map(activities.map((activity) => [activity.conceptId, activity]));
  const seen = new Set<string>();
  const cards: ChallengeCard[] = [];

  for (const conceptId of new Set(conceptIds)) {
    const activity = byConcept.get(conceptId);
    if (!activity) continue;
    for (const phase of [activity.retrieve, activity.apply]) {
      const question = phase.prompt.trim();
      const answer = phase.modelAnswer.trim();
      const key = `${question.toLocaleLowerCase()}|${answer.toLocaleLowerCase()}`;
      if (!question || !answer || question.length > 4000 || answer.length > 4000 || seen.has(key)) continue;
      seen.add(key);
      const explanation = "explanation" in phase && typeof phase.explanation === "string" ? phase.explanation.trim() : "";
      cards.push({
        question,
        answer,
        ...(explanation && explanation.length <= 4000 ? { explanation } : {}),
      });
      if (cards.length >= MAX_CHALLENGE_CARDS) return cards;
    }
  }

  return cards;
}

/** Strictly whitelist the public payload. Reject malformed or oversized data instead of partially trusting it. */
export function parseChallengeSnapshot(value: unknown): ChallengeSnapshot | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Array.isArray(record.cards) || record.cards.length < 1 || record.cards.length > MAX_CHALLENGE_CARDS) return null;

  const cards: ChallengeCard[] = [];
  for (const candidate of record.cards) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
    const card = candidate as Record<string, unknown>;
    if (typeof card.question !== "string" || typeof card.answer !== "string") return null;
    const question = card.question.trim();
    const answer = card.answer.trim();
    const explanation = typeof card.explanation === "string" ? card.explanation.trim() : "";
    if (!question || !answer || question.length > 4000 || answer.length > 4000 || explanation.length > 4000) return null;
    cards.push({ question, answer, ...(explanation ? { explanation } : {}) });
  }

  return { version: 1, cards };
}

/** The signed storage URL lives in the fragment, which browsers do not send to Kelus's server or referrer. */
export function trustedChallengeSource(hash: string, supabaseUrl: string | undefined): string | null {
  if (!supabaseUrl) return null;
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("source");
  if (!raw) return null;
  try {
    const base = new URL(supabaseUrl);
    const source = new URL(raw, base);
    if (source.origin !== base.origin || source.protocol !== base.protocol) return null;
    if (!source.pathname.startsWith(`/storage/v1/object/sign/${CHALLENGE_BUCKET}/`)) return null;
    if (!source.searchParams.get("token")) return null;
    return source.toString();
  } catch {
    return null;
  }
}
