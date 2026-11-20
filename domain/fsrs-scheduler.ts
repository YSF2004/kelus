import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from "ts-fsrs";
import type { LearningEvent, RetrievalOutcome } from "./types";

/**
 * The review clock is intentionally rebuilt from immutable learning events.
 * That keeps it local, inspectable, and resilient if the scheduling library
 * changes later: no opaque memory state is ever the only record of progress.
 */
const scheduler = fsrs(generatorParameters({
  enable_fuzz: false,
  request_retention: 0.9,
  maximum_interval: 3650,
}));

export type MemorySchedule = {
  dueAt: string;
  retrievability: number;
  stabilityDays: number;
  difficulty: number;
};

function isReviewEvent(event: LearningEvent) {
  return (event.kind === "seed_rating" || event.kind === "self_rating" || event.kind === "retrieval") && event.outcome !== null;
}

/** A revealed answer is useful learning, but it is not independent recall. */
function ratingFor(event: LearningEvent): Grade {
  if (event.assistance === "answer_revealed") return Rating.Again;
  if (event.assistance === "hint") return Rating.Hard;
  const rating: Record<RetrievalOutcome, Grade> = {
    failure: Rating.Again,
    partial: Rating.Hard,
    success: Rating.Good,
  };
  return rating[event.outcome as RetrievalOutcome];
}

/**
 * Replays only the student's recorded evidence. No answer text or note content
 * leaves the device; the library receives dates and outcome grades alone.
 */
export function scheduleFromEvidence(events: LearningEvent[], nowIso: string): MemorySchedule | null {
  const history = events
    .filter(isReviewEvent)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt) || left.id.localeCompare(right.id));
  if (!history.length) return null;

  let card: Card | null = null;
  for (const event of history) {
    const reviewedAt = new Date(event.createdAt);
    if (!Number.isFinite(reviewedAt.getTime())) continue;
    const currentCard: Card = card ?? createEmptyCard(reviewedAt);
    card = scheduler.next(currentCard, reviewedAt, ratingFor(event)).card;
  }
  const finalCard = card;
  if (!finalCard) return null;

  const now = new Date(nowIso);
  const retrievability = Number.isFinite(now.getTime())
    ? scheduler.get_retrievability(finalCard, now, false)
    : scheduler.get_retrievability(finalCard, new Date(), false);
  return {
    dueAt: finalCard.due.toISOString(),
    retrievability: Math.min(1, Math.max(0, retrievability)),
    stabilityDays: finalCard.stability,
    difficulty: finalCard.difficulty,
  };
}
