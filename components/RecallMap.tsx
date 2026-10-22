"use client";

import { useSyncExternalStore } from "react";
import { recallMap } from "@/domain/recall-map";
import type { Concept, LearningActivity } from "@/domain/types";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import { toneAt } from "@/lib/topic-tone";
import styles from "./RecallMap.module.css";


/**
 * Answer evidence, counted rather than estimated: the lines Kelus can ask you that you have answered correctly, topic
 * by topic in the order of your notes, with the ones that come back first named in words.
 */
export function RecallMap({ concepts, activities, nowIso }: { concepts: Concept[]; activities: LearningActivity[]; nowIso: string }) {
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const map = recallMap({ concepts, activities, known, missed, nowIso });
  if (!map.total) return null;
  const share = Math.round((map.recalled / map.total) * 100);

  return (
    <section className={styles.map} aria-labelledby="recall-map-title">
      <p className={styles.kicker} id="recall-map-title">Lines answered correctly</p>
      <p className={styles.figure}>
        <b>{map.recalled}</b>
        <span>of {map.total} lines in your notes{map.recalled ? `, ${share}%` : ""}</span>
      </p>
      <p className={styles.sub}>
        {map.recalled === 0
          ? "None yet. The count rises with each line you answer correctly."
          : [map.thisWeek ? `${map.thisWeek} answered correctly this week` : null, map.back ? `${map.back} ${map.back === 1 ? "comes" : "come"} back first in your next warm-up` : null].filter(Boolean).join(", ") || "A miss turns a line back; a right answer brings it home."}
      </p>

      <ol className={styles.topics} aria-label="Lines by topic, in the order of your notes">
        {map.topics.map((topic, at) => (
          <li key={topic.id} className={styles.topic} data-tone={toneAt(concepts.findIndex((concept) => concept.id === topic.id) >= 0 ? concepts.findIndex((concept) => concept.id === topic.id) : at)} aria-label={`${topic.name}: ${topic.recalled} of ${topic.lines.length} lines answered correctly`}>
            <span className={styles.name}>{topic.name}</span>
            <span className={styles.count} aria-hidden="true">{topic.recalled}/{topic.lines.length}</span>
            {/* What still needs work, in words: the lines that come back first. */}
            {(() => { const back = topic.lines.filter((line) => line.state === "back").length; return <span className={styles.back} aria-hidden="true">{back ? `${back} ${back === 1 ? "comes" : "come"} back first` : ""}</span>; })()}
          </li>
        ))}
      </ol>

    </section>
  );
}
