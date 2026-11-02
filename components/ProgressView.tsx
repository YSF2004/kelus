"use client";

import { ArrowRight } from "@/components/Marks";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { progressHeadline, progressSummary, type TopicChange } from "@/domain/progress";
import type { Concept, LearningActivity, LearningEvent } from "@/domain/types";
import { RecallMap } from "@/components/RecallMap";
import { comesBackLine } from "@/lib/verdict";
import styles from "./ProgressView.module.css";

const pct = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100);

function Trend({ series, target }: { series: Array<{ label: string; readiness: number; answered: number }>; target: number | null }) {
  const width = 560;
  const height = 150;
  const pad = { left: 8, right: 8, top: 10, bottom: 22 };
  const x = (index: number) => pad.left + (index / (series.length - 1)) * (width - pad.left - pad.right);
  const y = (value: number) => pad.top + (1 - Math.max(0, Math.min(1, value))) * (height - pad.top - pad.bottom);
  const line = series.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.readiness).toFixed(1)}`).join(" ");
  const area = `${line} L${x(series.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = series[series.length - 1];
  const first = series[0];
  return (
    <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Estimated readiness over 14 days: from ${pct(first.readiness)}% to ${pct(last.readiness)}%${target === null ? "" : `, aiming for ${target}%`}.`}>
      {target === null ? null : (
        <>
          <line x1={pad.left} x2={width - pad.right} y1={y(target / 100)} y2={y(target / 100)} className={styles.target} />
          <text x={width - pad.right} y={y(target / 100) - 5} textAnchor="end" className={styles.targetLabel}>Your target {target}%</text>
        </>
      )}
      <path d={area} className={styles.area} />
      <path d={line} className={styles.line} />
      {series.map((point, index) => (point.answered > 0 ? <circle key={point.label} cx={x(index)} cy={y(point.readiness)} r={3.2} className={styles.dot} /> : null))}
      <circle cx={x(series.length - 1)} cy={y(last.readiness)} r={5} className={styles.now} />
      <text x={pad.left} y={height - 5} className={styles.axis}>{first.label}</text>
      <text x={width - pad.right} y={height - 5} textAnchor="end" className={styles.axis}>Today</text>
    </svg>
  );
}

const EARLY: Record<string, string> = { success: "Solid", partial: "Partly there", failure: "Missed" };
const LAST: Record<string, string> = { success: "Last answer: solid", partial: "Last answer: partly there", failure: "Last answer: missed" };

function Topics({ title, note, items, empty }: { title: string; note: string; items: TopicChange[]; empty: string }) {
  return (
    <section className={styles.group} aria-label={title}>
      <h3>{title}</h3>
      {note ? <p className={styles.note}>{note}</p> : null}
      {items.length ? (
        <ul>
          {items.slice(0, 6).map((topic) => (
            <li key={topic.id}>
              <strong>{topic.name}</strong>
              <span className={styles.move} aria-label={`${pct(topic.before)} percent to ${pct(topic.after)} percent`}>
                {/* A change is shown as a change; "0% → 0%" says nothing, so the last answer is named instead. */}
                {/* Percentages only once there are a few answers behind them; before that, the last answer in words. */}
                {topic.attempts === 0 ? "Not started" : topic.attempts < 3 ? `${LAST[topic.lastOutcome ?? "partial"]}, ${topic.attempts} ${topic.attempts === 1 ? "try" : "tries"}` : pct(topic.before) !== pct(topic.after) ? <>{pct(topic.before)}% <ArrowRight /> {pct(topic.after)}%</> : LAST[topic.lastOutcome ?? "partial"]}
              </span>
              {topic.attempts >= 3 ? <span className={styles.bar} aria-hidden="true"><i style={{ width: `${pct(topic.after)}%` }} /></span> : <span className={styles.bar} aria-hidden="true" style={{ visibility: "hidden" }} />}
            </li>
          ))}
        </ul>
      ) : <p className={styles.empty}>{empty}</p>}
    </section>
  );
}

/** What changed, from your own answers. Honest first: too little data says so instead of drawing a trend. */
export function ProgressView({ concepts, events, nowIso, daysToExam, targetPercent, examDatePending = false, activities = [] }: { concepts: Concept[]; events: LearningEvent[]; nowIso: string; daysToExam: number; targetPercent: number; examDatePending?: boolean; activities?: LearningActivity[] }) {
  const reduce = useReducedMotion() === true;
  const summary = progressSummary({ concepts, events, nowMs: Date.parse(nowIso), daysToExam });
  const target = Math.round(Math.max(0, Math.min(100, targetPercent)));
  const gap = target - pct(summary.readinessNow);
  // Before the first answer there is nothing to compare, so the page is one card and the list of topics to start.
  const fresh = summary.answers === 0;

  // A few answers in: no trend, no counts that need explaining. Just each topic you tried, how it went and when it is back.
  if (!fresh && !summary.enough) {
    const byId = new Map(concepts.map((concept) => [concept.id, concept]));
    const tried = new Map(summary.practised.map((topic) => [topic.id, topic]));
    // The topic rows under the boxes are the list: each says how it went and when it is back, so nothing is listed twice.
    const noteFor = (id: string) => {
      const topic = tried.get(id);
      return topic ? `${EARLY[topic.lastOutcome ?? "partial"]}, ${comesBackLine(byId.get(id)?.nextReviewAt, nowIso).replace(/^Comes back/, "back")}` : "Not started";
    };
    const headline = <h2 id="progress-headline" className={styles.earlyHeading}>{summary.practised.length} of {concepts.length} topics tried</h2>;
    const fallback = (
      <section className={styles.group} aria-labelledby="progress-headline">
        {headline}
        <ul>
          {concepts.map((concept) => (
            <li key={concept.id}>
              <strong>{concept.name}</strong>
              <span className={styles.move}>{noteFor(concept.id)}</span>
              <span className={styles.bar} aria-hidden="true" style={{ visibility: "hidden" }} />
            </li>
          ))}
        </ul>
      </section>
    );
    return (
      <div className={styles.page}>
        <RecallMap
          concepts={concepts}
          activities={activities}
          nowIso={nowIso}
          heading={headline}
          noteFor={noteFor}
          fallback={fallback}
        />
        {/* The next step, then the quiet way to read it all back: one row, the green key first. */}
        <div className={styles.actions}>
          <Link href="/today" className={`k-btn ${styles.cta}`}>Practise a topic <ArrowRight /></Link>
          <Link href="/sheet" className={styles.sheetLink}>Open your revision sheet</Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <motion.section className={styles.lead} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }} aria-labelledby="progress-headline">
        {/* Before there are enough answers there is no trend to talk about: the counts below say where you are. */}
        <h2 id="progress-headline">{fresh ? "Your progress starts with a first answer." : progressHeadline(summary)}</h2>
        {summary.enough ? <p className={styles.caveat}>Estimated from your own answers, not a prediction of your grade.</p> : null}
        {fresh ? null : summary.enough ? (
          <Trend series={summary.series} target={examDatePending ? null : target} />
        ) : (
          null
        )}
        {fresh ? null : <dl className={styles.stats}>
          <div><dt>Answers</dt><dd>{summary.answers}</dd></div>
          <div><dt>Days studied</dt><dd>{summary.daysStudied}<small> of 7</small></dd></div>
          <div><dt>Topics practised</dt><dd>{summary.topicsPractised}<small> of {concepts.length}</small></dd></div>
        </dl>}
        <div className={styles.actions}>
          <Link href="/today" className={`k-btn ${styles.cta}`}>{fresh ? "Practise a topic" : "Practise next topic"} <ArrowRight /></Link>
          <Link href="/sheet" className={styles.sheetLink}>Open your revision sheet</Link>
        </div>
      </motion.section>

      <RecallMap concepts={concepts} activities={activities} nowIso={nowIso} />

      {fresh || !summary.stronger.length ? null : <Topics title="Got stronger" note="" items={summary.stronger} empty="" />}
      {fresh ? null : <Topics title="Needs another pass" note="" items={summary.needsPass} empty="No weak spots from your answers so far." />}
      {summary.notStarted.length ? <Topics title="Not started" note="" items={summary.notStarted} empty="" /> : null}

      {fresh || examDatePending ? null : <section className={styles.pace} aria-label="Pace to your target">
        <h3>To reach your target</h3>
        {summary.topicsLeft > 0 ? (
          <p>
            {summary.topicsLeft} topic{summary.topicsLeft === 1 ? " is" : "s are"} not strong yet, with {daysToExam} day{daysToExam === 1 ? "" : "s"} left. That is about <strong>{summary.perDay} topic{summary.perDay === 1 ? "" : "s"} a day</strong>.
            {gap > 0 ? ` You are ${gap} point${gap === 1 ? "" : "s"} below your ${target}% target.` : ` You are at or above your ${target}% target.`}
          </p>
        ) : <p>Every topic looks strong from your answers. Keep a quick review going so it stays that way.</p>}
      </section>}
    </div>
  );
}
