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

const GROUPS: Array<{ state: LeitnerLine["state"]; title: string }> = [
  { state: "missed", title: "Coming back first" },
  { state: "recalled", title: "Recalled" },
  { state: "new", title: "Not asked yet" },
];
const SHOWN = 5;

/** Every line, in plain groups: what comes back first, what you recalled, what is still to come. A line opens its story. */
function LineList({ lines, onOpen }: { lines: LeitnerLine[]; onOpen: (line: LeitnerLine) => void }) {
  const [all, setAll] = useState<Record<string, boolean>>({});
  return (
    <div className={styles.lines}>
      {GROUPS.map(({ state, title }) => {
        const group = lines.filter((line) => line.state === state);
        if (!group.length) return null;
        const shown = all[state] ? group : group.slice(0, SHOWN);
        return (
          <section key={state} className={styles.group} aria-label={title}>
            <h3><span className={styles.key} data-state={state} aria-hidden="true" />{title} <small>{group.length}</small></h3>
            <ul>
              {shown.map((line) => (
                <li key={line.quote}>
                  <button type="button" onClick={() => onOpen(line)} aria-label={`${short(line.quote)}. See this line's answers and when it is back`}>
                    <span className={styles.quote}>{short(line.quote)}</span>
                    <small>{line.topic}</small>
                  </button>
                </li>
              ))}
            </ul>
            {group.length > SHOWN && !all[state] ? <button type="button" className={styles.more} onClick={() => setAll({ ...all, [state]: true })}>Show all {group.length}</button> : null}
          </section>
        );
      })}
    </div>
  );
}

/**
 * Progress, counted rather than estimated: the lines you can recall as a line over the days, each topic as a row
 * with how much of it you can recall, and every line in plain groups that open its story. With a heading, the rows
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
          </li>
        );
      })}
    </ol>
  );

  return (
    <section className={styles.map} aria-labelledby="recall-title">
      <header className={styles.head}>
        <h2 id="recall-title">Lines you can recall</h2>
        <p className={styles.now}><b>{state.recalled}</b> of {state.total}{back ? <span> · {back} coming back first</span> : null}</p>
      </header>
      {series.length ? <RecallChart series={series} total={state.total} /> : <p className={styles.empty}>Answer a question and your line starts here.</p>}
      {heading ? <section className={styles.list} aria-labelledby="progress-headline">{heading}{rows}</section> : rows}
      <LineList lines={state.lines} onOpen={(line) => setOpenQuote(line.quote)} />
      <AnimatePresence>{life ? <LineLifeSheet key={life.quote} life={life} onClose={() => setOpenQuote(null)} /> : null}</AnimatePresence>
    </section>
  );
}
