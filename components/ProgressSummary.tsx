"use client";

import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { leitner, type LeitnerLine } from "@/domain/leitner";
import type { Concept, LearningActivity, LearningEvent } from "@/domain/types";
import { getKnownLines, getServerKnownLines, subscribeKnownLines } from "@/lib/known-lines";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import { topicLevel } from "@/lib/format";
import styles from "./ProgressSummary.module.css";

const ease = [0.22, 1, 0.36, 1] as const;
/** Lines shown per topic on the sheet; the rest are counted, so a long course stays one calm page. */
const SHOWN = 4;

type Standing = "solid" | "partly" | "work" | "new";
const STANDING: Record<Standing, string> = { solid: "Solid", partly: "Partly there", work: "Needs work", new: "Not started" };

/** A number that counts up to itself once: the result lands rather than appears. */
function CountUp({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, { duration: 0.9, ease, delay: 0.15, onUpdate: (latest) => setShown(Math.round(latest)) });
    return () => controls.stop();
  }, [value, reduce]);
  return <>{reduce ? value : shown}</>;
}

/** A pen mark in the margin, drawn as you watch: a tick, a wavy stroke, or a loop around nothing yet known. */
function MarginMark({ standing, delay, reduce }: { standing: Standing; delay: number; reduce: boolean }) {
  if (standing === "new") return null;
  const d = standing === "solid"
    ? "M4 15.5c2.2 1.6 4.1 3.6 5.6 6.2C12.9 13.4 18 7.2 25 3.5"
    : standing === "partly"
      ? "M3 13c3-3.6 5.2-3.8 7.4-.6s4.6 3.4 7.2-.2 4.8-3.5 7.4-.4"
      : "M20.5 6.2C17.6 3.1 9.8 3.6 6 8.4c-3.6 4.6-1.8 11.4 4.4 12.8 6 1.4 12.2-2.4 12.6-8.2.2-3.4-1.8-6-4.6-7.4";
  return (
    <svg className={styles.mark} data-standing={standing} viewBox="0 0 28 26" aria-hidden="true">
      <motion.path d={d} initial={reduce ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ pathLength: { duration: 0.55, delay, ease }, opacity: { duration: 0.05, delay } }} />
    </svg>
  );
}

/**
 * Progress is the student's own notes, marked the way a teacher marks a page: every line answered correctly is
 * highlighted, every missed line is underlined in red, and each topic has a pen mark in the margin for how it stands.
 * Nothing is estimated: a highlight is a line answered right on this device, a margin mark is the topic's own result.
 * Schedules and box diagrams sit behind the disclosure below.
 */
export function ProgressSummary({ concepts, activities, events, nowIso, openTopicId }: { concepts: Concept[]; activities: LearningActivity[]; events: LearningEvent[]; nowIso: string; /** The topic of a block left open: started, though its answers count only once it is finished. */ openTopicId?: string }) {
  const reduce = useReducedMotion() === true;
  const known = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const state = leitner({ concepts, activities, known, missed, nowIso });
  const rows = concepts.map((concept) => {
    const lines = state.lines.filter((line) => line.conceptId === concept.id);
    const recalled = lines.filter((line) => line.state === "recalled").length;
    const miss = lines.filter((line) => line.state === "missed").length;
    // A line answered counts as an attempt, even in a topic left before its end: answers are saved as they are given.
    const tried = recalled + miss > 0 || concept.retrievalAttempts > 0 || events.some((event) => event.conceptId === concept.id && event.kind === "retrieval");
    const level = topicLevel(concept.mastery, tried ? Math.max(1, concept.retrievalAttempts) : 0);
    // Line by line where lines were answered on this device; otherwise (an older course, the sample's history) from
    // the topic's own result on its last answers.
    const lined = recalled + miss > 0;
    const standing: Standing = !tried ? "new" : lined ? (miss === 0 ? "solid" : recalled ? "partly" : "work") : level === "Solid" ? "solid" : level === "Partly there" ? "partly" : "work";
    // Missed lines first, then the ones known, then the rest: what a student most needs to see is on the sheet.
    const order = { missed: 0, recalled: 1, new: 2 } as const;
    const shown = [...lines].sort((a, b) => order[a.state] - order[b.state]).slice(0, SHOWN);
    return { id: concept.id, name: concept.name, lines, shown, total: lines.length, recalled, missed: miss, tried, lined, standing };
  }).filter((row) => row.total);
  const lineTotal = rows.reduce((sum, row) => sum + row.total, 0);
  const lineRecalled = rows.reduce((sum, row) => sum + row.recalled, 0);
  const lineMissed = rows.reduce((sum, row) => sum + row.missed, 0);
  const lineTried = lineRecalled + lineMissed;
  const anyLined = rows.some((row) => row.lined);
  const solid = rows.filter((row) => row.standing === "solid");
  // Each practised topic named once, by how it stands; what is not started yet is left to the sheet.
  const groups = (["solid", "partly", "work"] as const).map((key) => ({ key, list: rows.filter((row) => row.standing === key) })).filter((group) => group.list.length);
  // Line by line: what improved (lines recalled) and what needs another attempt (lines missed), with their topics.
  const inTopics = (list: typeof rows, count: (row: (typeof rows)[number]) => number) => list.filter((row) => count(row) > 0).map((row) => `${count(row)} ${count(row) === 1 ? "line" : "lines"} in ${row.name}`);
  const improvedLines = inTopics(rows, (row) => row.recalled);
  const againLines = inTopics(rows, (row) => row.missed);
  // Three named at most, so the sentence stays one glance: the sheet below has every topic.
  const names2 = (list: string[]) => list.length <= 2 ? list.join(" and ") : list.length <= 3 ? `${list.slice(0, -1).join(", ")} and ${list[2]}` : `${list.slice(0, 3).join(", ")} and ${list.length - 3} more ${list.length - 3 === 1 ? "topic" : "topics"}`;
  const names = (list: typeof rows) => list.length <= 2 ? list.map((row) => row.name).join(" and ") : `${list.slice(0, -1).map((row) => row.name).join(", ")} and ${list[list.length - 1].name}`;
  const note = (row: (typeof rows)[number]) => {
    if (!row.tried) return row.id === openTopicId ? "Started, not finished yet" : "Not practised yet";
    if (row.lined) return row.missed ? `${row.recalled} of ${row.total} right, ${row.missed} missed` : `${row.recalled} of ${row.total} right`;
    return STANDING[row.standing];
  };
  let at = 0;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h2 id="progress-standing" className={styles.big}>
          {anyLined
            ? <>You have tried <span className={styles.num}><CountUp value={lineTried} reduce={reduce} /></span> of {lineTotal} lines from your notes.</>
            : <><span className={styles.num}><CountUp value={solid.length} reduce={reduce} /></span> of {rows.length} topics solid.</>}
        </h2>
        {anyLined ? (
          <ul className={styles.tally} aria-label="Your lines so far">
            <li data-state="recalled"><b>{lineRecalled}</b> recalled</li>
            <li data-state="missed"><b>{lineMissed}</b> missed, to try again</li>
            <li data-state="new"><b>{lineTotal - lineTried}</b> not attempted yet</li>
          </ul>
        ) : null}
        <p className={styles.sub} id="progress-said">
          {anyLined
            ? <>{improvedLines.length ? <>Improved: {names2(improvedLines)}. </> : <>Nothing recalled yet. </>}{againLines.length ? <>Needs another attempt: {names2(againLines)}.</> : null}</>
            : groups.length
            ? groups.map((group) => <span key={group.key} data-standing={group.key}>{STANDING[group.key]}: {names(group.list)}. </span>)
            : <>Nothing practised yet. Answer a question and its line lights up here.</>}
        </p>
      </header>

      {/* The sheet: the notes themselves, marked. Topics in the order of the notes, each line as it was written. */}
      <article className={styles.sheet} aria-label="Your notes, marked by your answers">
        {rows.map((row, index) => {
          const markDelay = 0.25 + index * 0.08;
          return (
            <section key={row.id} className={styles.topic} data-standing={row.standing} aria-labelledby={`sheet-${row.id}`}>
              <div className={styles.margin}>
                <MarginMark standing={row.standing} delay={markDelay} reduce={reduce} />
              </div>
              <div className={styles.body}>
                <h3 id={`sheet-${row.id}`}>
                  <Link href={`/concept?id=${encodeURIComponent(row.id)}`}>{row.name}</Link>
                  <span className={styles.note}>{note(row)}</span>
                </h3>
                <p className={styles.lines}>
                  {row.shown.map((item: LeitnerLine) => {
                    const delay = Math.min(1.6, 0.35 + (at++) * 0.06);
                    return (
                      <span key={item.quote} className={styles.line} data-state={item.state}>
                        <motion.span
                          className={styles.ink}
                          initial={reduce || item.state === "new" ? false : item.state === "recalled" ? { backgroundSize: "0% 58%" } : { textDecorationColor: "rgba(0,0,0,0)" }}
                          animate={item.state === "recalled" ? { backgroundSize: "100% 58%" } : item.state === "missed" ? { textDecorationColor: "var(--k-coral)" } : undefined}
                          transition={{ duration: item.state === "recalled" ? 0.6 : 0.4, delay, ease }}
                        >
                          {item.quote}
                        </motion.span>
                        <span className="sr-only">{item.state === "recalled" ? " (answered correctly)" : item.state === "missed" ? " (missed)" : ""}</span>{" "}
                      </span>
                    );
                  })}
                  {row.total > row.shown.length ? <span className={styles.more}>{row.total - row.shown.length} more {row.total - row.shown.length === 1 ? "line" : "lines"}</span> : null}
                </p>
              </div>
            </section>
          );
        })}
      </article>

      <p className={styles.key} aria-hidden="true">
        <span><mark>highlighted</mark> answered right</span>
        <span><u>underlined</u> missed, back first next time</span>
        <span>plain, not asked yet</span>
      </p>
    </div>
  );
}
