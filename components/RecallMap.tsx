"use client";

import { useSyncExternalStore } from "react";
import { BoxStrip } from "@/components/BoxStrip";
import { LeitnerPanel } from "@/components/LeitnerPanel";
import { leitner } from "@/domain/leitner";
import type { Concept, LearningActivity } from "@/domain/types";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import styles from "./RecallMap.module.css";

/**
 * Progress, counted rather than estimated: every line of the notes in its Leitner box for the whole course, then each
 * topic as a row with its own five boxes and how many of its lines are recalled.
 */
export function RecallMap({ concepts, activities, nowIso }: { concepts: Concept[]; activities: LearningActivity[]; nowIso: string }) {
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const state = leitner({ concepts, activities, known, missed, nowIso });
  if (!state.total) return null;
  return (
    <section className={styles.map} aria-labelledby="leitner-title">
      <LeitnerPanel state={state} />
      <div className={styles.columns} aria-hidden="true"><span>Topic</span><span className={styles.boxNums}><i>1</i><i>2</i><i>3</i><i>4</i><i>5</i></span><span>Recalled</span></div>
      <ol className={styles.topics} aria-label="Lines by topic, in the order of your notes">
        {concepts.map((concept) => {
          const lines = state.lines.filter((line) => line.conceptId === concept.id);
          if (!lines.length) return null;
          const recalled = lines.filter((line) => line.state === "recalled").length;
          return (
            <li key={concept.id} className={styles.topic}>
              <span className={styles.name}>{concept.name}</span>
              <BoxStrip lines={lines} label={concept.name} />
              <span className={styles.count}>{recalled}/{lines.length}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
