import { habitSummary } from "@/domain/habit";
import { leitner } from "@/domain/leitner";
import type { DemoState } from "@/lib/demo-store";
import { SAMPLE_COURSE_IDS } from "@/lib/pilot";
import type { ResultStats } from "@/lib/share-result";

/** The local calendar day of an ISO time, so "today" is the student's day, not UTC's. */
const localDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA");

/**
 * Today's revision as numbers worth sending, from anywhere in the app (not only the Done screen): the lines recalled
 * and missed today, the topics practised today, the course's own count and the streak. Null when there is nothing
 * from today to share, or the course is the built-in sample: a card of zeros is not news.
 */
export function todayShareStats(state: DemoState): ResultStats | null {
  const course = state.snapshot.courses[0];
  if (!course || SAMPLE_COURSE_IDS.has(course.id)) return null;
  const today = localDay(state.nowIso);
  const concepts = state.snapshot.concepts.filter((concept) => concept.courseId === course.id);
  const ids = new Set(concepts.map((concept) => concept.id));
  const fromToday = (line: { at: string; conceptId: string }) => ids.has(line.conceptId) && localDay(line.at) === today;
  const topics = new Set(state.snapshot.events.filter((event) => event.kind === "retrieval" && ids.has(event.conceptId) && localDay(event.createdAt) === today).map((event) => event.conceptId)).size;
  const recalled = (state.knownLines ?? []).filter(fromToday).length;
  const missed = (state.missedLines ?? []).filter(fromToday).length;
  if (!topics && !recalled && !missed) return null;
  const lines = leitner({ concepts, activities: state.snapshot.learningActivities, known: state.knownLines ?? [], missed: state.missedLines ?? [], nowIso: state.nowIso });
  return {
    course: course.name !== "My course" ? course.name : null,
    recalled,
    missed,
    topics: Math.max(topics, recalled + missed ? 1 : 0),
    courseRecalled: lines.recalled,
    courseTotal: lines.total,
    streak: habitSummary({ events: state.snapshot.events, concepts, nowMs: Date.parse(state.nowIso) }).streak,
  };
}
