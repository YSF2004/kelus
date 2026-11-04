"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { LineLifeSheet } from "@/components/LineLifeSheet";
import { leitner, type LeitnerLine } from "@/domain/leitner";
import { lineLife } from "@/domain/line-life";
import { recallSeries, type RecallPoint } from "@/domain/recall-series";
import type { Concept, LearningActivity } from "@/domain/types";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getLineHistory, getServerLineHistory, subscribeLineHistory } from "@/lib/line-history";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import styles from "./RecallMap.module.css";

const ease = [0.22, 1, 0.36, 1] as const;
const short = (quote: string) => quote.replace(/^["“]|["”]$/g, "").trim();
const dayLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/**
 * Lines you can recall, day by day: one line rising toward the dashed line of every line in the course. It draws
 * itself in once, from the first answer to today, and ends on today's number. A first day is a rise from nothing.
 */
function RecallChart({ series, total }: { series: RecallPoint[]; total: number }) {
  const reduce = useReducedMotion() === true;
  const points = series.length === 1 ? [{ day: series[0].day, recalled: 0 }, series[0]] : series;
  const width = 600;
  const height = 180;
  const pad = { top: 18, right: 14, bottom: 26, left: 14 };
  const x = (index: number) => pad.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * (width - pad.left - pad.right));
  const y = (value: number) => pad.top + (1 - value / Math.max(1, total)) * (height - pad.top - pad.bottom);
  const line = points.map((point, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(point.recalled).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = points[points.length - 1];
  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Lines you can recall, from ${dayLabel(series[0].day)} to today: now ${last.recalled} of ${total}.`}>
      <line className={styles.ceiling} x1={pad.left} x2={width - pad.right} y1={y(total)} y2={y(total)} />
      <text className={styles.axis} x={width - pad.right} y={y(total) - 6} textAnchor="end">All {total} lines</text>
      <line className={styles.base} x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
      <motion.path className={styles.area} d={area} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.5, ease }} />
      <motion.path className={styles.line} d={line} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease }} />
      <motion.circle className={styles.dot} cx={x(points.length - 1)} cy={y(last.recalled)} r={6} initial={reduce ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.25, delay: reduce ? 0 : 0.95 }} />
      <text className={styles.axis} x={pad.left} y={height - 6}>{series.length === 1 ? "Before" : dayLabel(points[0].day)}</text>
      <text className={styles.axis} x={width - pad.right} y={height - 6} textAnchor="end">Today</text>
    </svg>
  );
}

const LEGEND: Array<{ state: LeitnerLine["state"]; title: string }> = [
  { state: "missed", title: "Coming back first" },
  { state: "recalled", title: "Recalled" },
  { state: "new", title: "Not asked yet" },
];
const ORDER: Record<LeitnerLine["state"], number> = { missed: 0, recalled: 1, new: 2 };
const SHOWN = 3;

/** One topic's lines under its row, each once: what comes back first, then what you recalled, then the rest. */
function TopicLines({ lines, onOpen }: { lines: LeitnerLine[]; onOpen: (line: LeitnerLine) => void }) {
  const [all, setAll] = useState(false);
  const sorted = [...lines].sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  const shown = all ? sorted : sorted.slice(0, SHOWN);
  return (
    <>
      <ul className={styles.topicLines}>
        {shown.map((line) => (
          <li key={line.quote}>
            <button type="button" onClick={() => onOpen(line)} aria-label={`${short(line.quote)}. ${LEGEND.find((item) => item.state === line.state)?.title}. See this line's answers and when it is back`}>
              <span className={styles.key} data-state={line.state} aria-hidden="true" />
              <span className={styles.quote}>{short(line.quote)}</span>
            </button>
          </li>
        ))}
      </ul>
      {sorted.length > SHOWN && !all ? <button type="button" className={styles.more} onClick={() => setAll(true)}>Show all {sorted.length} lines</button> : null}
    </>
  );
}

/**
 * Progress, counted rather than estimated: the lines you can recall as a line over the days, then each topic as a row
 * with how much of it you can recall and its own lines under it, each line once, opening its story. With a heading, the rows
 * are that heading's list and each can carry a note (how it went, when it is back), so topics are never listed twice.
 */
export function RecallMap({ concepts, activities, nowIso, heading, noteFor, fallback = null }: { concepts: Concept[]; activities: LearningActivity[]; nowIso: string; heading?: ReactNode; noteFor?: (conceptId: string) => string | null; fallback?: ReactNode }) {
  const reduce = useReducedMotion() === true;
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const history = useSyncExternalStore(subscribeLineHistory, getLineHistory, getServerLineHistory);
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const state = leitner({ concepts, activities, known, missed, nowIso });
  if (!state.total) return fallback;
  const series = recallSeries({ history, known, lines: state.lines.map((line) => line.quote), nowIso });
  const openLine = openQuote ? state.lines.find((line) => line.quote === openQuote) : undefined;
  const life = openLine ? lineLife({ line: openLine, activity: activities.find((item) => item.conceptId === openLine.conceptId), known, history }) : null;
  const back = state.lines.filter((line) => line.state === "missed").length;

  const rows = (
    <ol className={styles.topics} aria-label="Topics, in the order of your notes">
      {concepts.map((concept, index) => {
        const lines = state.lines.filter((line) => line.conceptId === concept.id);
        if (!lines.length) return null;
        const recalled = lines.filter((line) => line.state === "recalled").length;
        const note = noteFor?.(concept.id);
        return (
          <li key={concept.id} className={styles.topic}>
            <span className={styles.name}>{concept.name}{note ? <small className={styles.note}>{note}</small> : null}</span>
            <span className={styles.count}>{recalled}/{lines.length}</span>
            <span className={styles.bar} aria-hidden="true">
              <motion.i initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: recalled / lines.length }} transition={{ duration: 0.6, delay: reduce ? 0 : 0.2 + index * 0.05, ease }} />
            </span>
            <TopicLines lines={lines} onOpen={(line) => setOpenQuote(line.quote)} />
          </li>
        );
      })}
    </ol>
  );

  // What the dots under each topic mean, said once, before the first dot.
  const legendList = (
    <p className={styles.legend} aria-hidden="true">
      {LEGEND.map(({ state: key, title }) => <span key={key}><span className={styles.key} data-state={key} />{title}</span>)}
    </p>
  );

  return (
    <section className={styles.map} aria-labelledby="recall-title">
      <header className={styles.head}>
        <h2 id="recall-title">Lines you can recall</h2>
        <p className={styles.now}><b>{state.recalled}</b> of {state.total}{back ? <span> · {back} coming back first</span> : null}</p>
      </header>
      {/* A line flat on zero is an empty chart, not progress: until a line is recalled, one sentence says what will draw it. */}
      {series.some((point) => point.recalled > 0) ? <RecallChart series={series} total={state.total} /> : <p className={styles.empty}>{series.length ? "Recall a line on its next return and your line starts rising here." : "Answer a question and your line starts here."}</p>}
      {heading ? <section className={styles.list} aria-labelledby="progress-headline">{heading}{legendList}{rows}</section> : <>{legendList}{rows}</>}
      <AnimatePresence>{life ? <LineLifeSheet key={life.quote} life={life} onClose={() => setOpenQuote(null)} /> : null}</AnimatePresence>
    </section>
  );
}
