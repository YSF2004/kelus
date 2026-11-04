"use client";

import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";
import { leitner, type LeitnerLine } from "@/domain/leitner";
import { getDemoSnapshot, subscribeDemoState } from "@/lib/demo-store";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import styles from "./TopicBoxes.module.css";

const noSnapshot = () => null;
// When a recalled line in each box is asked again (domain/leitner.ts BOXES).
const AGAIN = ["Tomorrow", "In 2 days", "In 4 days", "In 9 days", "In a month"];

/** When a line comes back, in the words a student plans with. */
function when(line: LeitnerLine) {
  if (line.state === "missed") return { key: "warmup", label: "Missed: first in your next warm-up", order: 0 };
  if (line.state === "new") return { key: "new", label: "Not asked yet", order: 9 };
  return { key: `box${line.box}`, label: AGAIN[line.box - 1], order: line.box };
}

/**
 * Where one topic's lines stand after this session, said as when each comes back: missed lines in the next warm-up,
 * recalled ones in a few days, the rest not asked yet. The end of a topic shows what the answers did, not a score.
 */
export function TopicBoxes({ conceptId, back }: { conceptId: string; /** When the topic itself is next asked ("Comes back later today"). */ back?: string }) {
  const reduce = useReducedMotion() === true;
  const snapshot = useSyncExternalStore(subscribeDemoState, getDemoSnapshot, noSnapshot);
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  if (!snapshot) return null;
  const concept = snapshot.snapshot.concepts.find((item) => item.id === conceptId);
  if (!concept) return null;
  const state = leitner({ concepts: [concept], activities: snapshot.snapshot.learningActivities, known, missed, nowIso: snapshot.nowIso });
  if (!state.total) return null;
  const groups = new Map<string, { label: string; order: number; lines: LeitnerLine[] }>();
  for (const line of state.lines) {
    const { key, label, order } = when(line);
    const group = groups.get(key) ?? { label, order, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  }
  const rows = [...groups.values()].sort((a, b) => a.order - b.order);
  return (
    <section className={styles.wrap} aria-label={`${concept.name}: when its lines come back`}>
      {/* One answer to "when": the topic's own return in the header, then where each of its lines goes. */}
      <p className={styles.head}><b>{concept.name}</b><span>{back ? back.replace(/^Comes back/i, "Back") : `When its ${state.total} ${state.total === 1 ? "line comes" : "lines come"} back`}</span></p>
      <ul className={styles.when}>
        {rows.map((row, index) => (
          <motion.li key={row.label} data-state={row.lines[0].state} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, delay: reduce ? 0 : 0.2 + index * 0.05 }}>
            <span className={styles.label}>{row.label}</span>
            <span className={styles.count}>{row.lines.length} {row.lines.length === 1 ? "line" : "lines"}</span>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}
