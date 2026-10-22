"use client";

import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { BOXES, leitner } from "@/domain/leitner";
import { getDemoSnapshot, subscribeDemoState } from "@/lib/demo-store";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import styles from "./TopicBoxes.module.css";

const noSnapshot = () => null;

/**
 * Where one topic's lines stand after this session: five boxes in a row, each line a mark, recalled lines filled green
 * and missed ones outlined. The end of a topic shows what the answers did, not a score.
 */
export function TopicBoxes({ conceptId }: { conceptId: string }) {
  const reduce = useReducedMotion() === true;
  const snapshot = useSyncExternalStore(subscribeDemoState, getDemoSnapshot, noSnapshot);
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  if (!snapshot) return null;
  const concept = snapshot.snapshot.concepts.find((item) => item.id === conceptId);
  if (!concept) return null;
  const state = leitner({ concepts: [concept], activities: snapshot.snapshot.learningActivities, known, missed, nowIso: snapshot.nowIso });
  if (!state.total) return null;
  const moved = state.lines.filter((line) => line.box > 1).length;
  return (
    <section className={styles.wrap} aria-label={`${concept.name}: ${moved} of ${state.total} lines past Box 1`}>
      <p className={styles.head}><b>{concept.name}</b><span>{moved ? `${moved} of ${state.total} lines past Box 1` : `${state.total} lines in Box 1, asked again soon`}</span></p>
      <ol className={styles.row} aria-hidden="true">
        {BOXES.map(({ box, every }, index) => (
          <li key={box}>
            <small>Box {box}<em>{every}</em></small>
            <span className={styles.marks}>
              {state.byBox[index].map((line, at) => (
                <motion.i
                  key={line.quote}
                  data-state={line.state}
                  title={line.quote}
                  initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: reduce ? 0 : 0.3 + (index * 4 + at) * 0.03, ease: [0.16, 1, 0.3, 1] }}
                />
              ))}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
