"use client";

import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { recallMap } from "@/domain/recall-map";
import type { Concept, LearningActivity } from "@/domain/types";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import { toneAt } from "@/lib/topic-tone";
import styles from "./RecallMap.module.css";

const STATE_LABEL = { recalled: "answered correctly", back: "coming back first", new: "not asked yet" } as const;

/**
 * Answer evidence, counted rather than estimated: every line Kelus can ask you, one mark each, topic by topic in the
 * order of your notes. Green has a correct answer, marigold comes back first, pale has not been asked yet.
 * Hovering a mark shows its line.
 */
export function RecallMap({ concepts, activities, nowIso }: { concepts: Concept[]; activities: LearningActivity[]; nowIso: string }) {
  const reduce = useReducedMotion() === true;
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const map = recallMap({ concepts, activities, known, missed, nowIso });
  if (!map.total) return null;
  const share = Math.round((map.recalled / map.total) * 100);
  let order = 0;

  return (
    <section className={styles.map} aria-labelledby="recall-map-title">
      <p className={styles.kicker} id="recall-map-title">Lines answered correctly</p>
      <p className={styles.figure}>
        <b>{map.recalled}</b>
        <span>of {map.total} lines in your notes{map.recalled ? ` · ${share}%` : ""}</span>
      </p>
      <p className={styles.sub}>
        {map.recalled === 0
          ? "None yet. Each fills in as you answer it."
          : [map.thisWeek ? `${map.thisWeek} answered correctly this week` : null, map.back ? `${map.back} ${map.back === 1 ? "comes" : "come"} back first in your next warm-up` : null].filter(Boolean).join(" · ") || "A miss turns a line back; a right answer brings it home."}
      </p>

      <ol className={styles.topics} aria-label="Lines by topic, in the order of your notes">
        {map.topics.map((topic, at) => (
          <li key={topic.id} className={styles.topic} data-tone={toneAt(concepts.findIndex((concept) => concept.id === topic.id) >= 0 ? concepts.findIndex((concept) => concept.id === topic.id) : at)} aria-label={`${topic.name}: ${topic.recalled} of ${topic.lines.length} lines answered correctly`}>
            <span className={styles.name}>{topic.name}</span>
            <span className={styles.count} aria-hidden="true">{topic.recalled}/{topic.lines.length}</span>
            <span className={styles.dots} aria-hidden="true">
              {topic.lines.map((line) => {
                const at = order++;
                return (
                  <motion.i
                    key={line.quote}
                    className={styles.dot}
                    data-state={line.state}
                    title={`${line.quote} (${STATE_LABEL[line.state]})`}
                    initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.4, delay: reduce ? 0 : Math.min(0.5, at * 0.012) }}
                  />
                );
              })}
            </span>
          </li>
        ))}
      </ol>

      <p className={styles.legend} aria-hidden="true">
        <span><i className={styles.dot} data-state="recalled" /> Answered correctly</span>
        <span><i className={styles.dot} data-state="back" /> Comes back first</span>
        <span><i className={styles.dot} data-state="new" /> Not asked yet</span>
      </p>
    </section>
  );
}
