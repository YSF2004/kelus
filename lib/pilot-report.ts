"use client";

import { analyticsEnabled, trackEvent } from "@/lib/analytics";
import { newMilestones, pilotMilestones, SAMPLE_COURSE_IDS } from "@/lib/pilot";
import type { Concept, LearningEvent } from "@/domain/types";

/** Reports any pilot milestone this student has newly reached. Safe to call often: each milestone is sent once. */
export function reportPilotMilestones(events: LearningEvent[], concepts: Concept[]) {
  // Without analytics nothing is sent, so nothing is marked as sent either.
  if (!analyticsEnabled()) return;
  const sample = new Set(concepts.filter((concept) => SAMPLE_COURSE_IDS.has(concept.courseId)).map((concept) => concept.id));
  const reached = pilotMilestones({ events, sampleConceptIds: sample });
  if (!reached.length) return;
  const real = events.filter((event) => event.kind === "retrieval" && !sample.has(event.conceptId)).map((event) => Date.parse(event.createdAt));
  const days = real.length ? Math.max(0, Math.round((Date.now() - Math.min(...real)) / 86_400_000)) : 0;
  for (const milestone of newMilestones(reached)) trackEvent({ name: "pilot_milestone", milestone, days_since_first: days });
}
