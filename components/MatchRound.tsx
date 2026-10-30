"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { matchOrder, type MatchPair } from "@/domain/match-round";
import { trackEvent } from "@/lib/analytics";
import styles from "./MatchRound.module.css";

/**
 * A quick round after a block: tap a topic, then the line from the notes it belongs to. A right match settles in
 * green; a wrong one shakes once and lets go. It is practice only: nothing here changes a topic's result or plan.
 */
export function MatchRound({ pairs, seed }: { pairs: MatchPair[]; seed: string }) {
  const reduce = useReducedMotion() === true;
  const lines = useMemo(() => matchOrder(pairs, seed), [pairs, seed]);
  const [picked, setPicked] = useState<string | null>(null);
  const [matched, setMatched] = useState<string[]>([]);
  const [miss, setMiss] = useState<string | null>(null);
  const [misses, setMisses] = useState(0);
  const done = matched.length === pairs.length;

  function tryLine(conceptId: string) {
    if (!picked || matched.includes(conceptId)) return;
    if (picked === conceptId) {
      const next = [...matched, conceptId];
      setMatched(next);
      setPicked(null);
      if (next.length === pairs.length) trackEvent({ name: "match_round_done", pairs: pairs.length, misses });
    } else {
      setMisses((n) => n + 1);
      setMiss(conceptId);
      window.setTimeout(() => setMiss(null), 420);
    }
  }

  return (
    <section className={styles.round} aria-labelledby="match-title">
      <header className={styles.head}>
        <h2 id="match-title">Quick match</h2>
        <p>{done ? (misses ? `All ${pairs.length} matched, ${misses} ${misses === 1 ? "slip" : "slips"} on the way.` : `All ${pairs.length} matched, first time.`) : "Tap a topic, then the line from your notes it belongs to."}</p>
      </header>
      <div className={styles.board}>
        <ul className={styles.names} aria-label="Topics">
          {pairs.map(({ conceptId, name }) => {
            const isDone = matched.includes(conceptId);
            return (
              <li key={conceptId}>
                <button
                  type="button"
                  className={styles.name}
                  data-state={isDone ? "done" : picked === conceptId ? "picked" : undefined}
                  aria-pressed={picked === conceptId}
                  disabled={isDone}
                  onClick={() => setPicked(picked === conceptId ? null : conceptId)}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className={styles.lines} aria-label="Lines from your notes">
          {lines.map(({ conceptId, line }) => {
            const isDone = matched.includes(conceptId);
            return (
              <li key={conceptId}>
                <motion.button
                  type="button"
                  className={styles.line}
                  data-state={isDone ? "done" : miss === conceptId ? "miss" : undefined}
                  // Not disabled: a disabled button greys out, and a line should always read clearly. Taps without a
                  // topic picked, or on a matched line, simply do nothing.
                  aria-disabled={isDone || !picked}
                  onClick={() => tryLine(conceptId)}
                  animate={reduce || miss !== conceptId ? { x: 0 } : { x: [0, -6, 6, -3, 3, 0] }}
                  transition={{ duration: 0.36, ease: "easeOut" }}
                >
                  {isDone ? <b>{pairs.find((pair) => pair.conceptId === conceptId)?.name}</b> : null}
                  <span>{line}</span>
                </motion.button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
