"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useLearner } from "@/components/LearnerProvider";
import { returnVisit } from "@/domain/return-visit";
import type { Concept, LearningEvent } from "@/domain/types";
import { getMissedLines, getServerMissedLines, keepMissedLinesFor, subscribeMissedLines } from "@/lib/missed-lines";

/** A later visit: how long you were away, what you practised last, and the lines you missed then. */
export function useReturnVisit(events: LearningEvent[], concepts: Concept[]) {
  const { state } = useLearner();
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const names = useMemo(() => new Map(concepts.map((concept) => [concept.id, concept.name])), [concepts]);
  // Lines of topics that were removed, or of another course, should never come back.
  useEffect(() => { keepMissedLinesFor(new Set(names.keys())); }, [names]);
  return { visit: returnVisit({ events, names, missed, nowMs: Date.parse(state.nowIso) }), nowIso: state.nowIso, missed };
}
