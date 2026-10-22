"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { useLearner } from "@/components/LearnerProvider";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import { ArrowLeft } from "@/components/Marks";
import { revisionSheet } from "@/domain/revision-sheet";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import { useDocumentTitle } from "@/lib/use-title";
import { toneAt } from "@/lib/topic-tone";
import styles from "./sheet.module.css";

const day = (iso: string) => new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });

/**
 * The sheet you wrote: every topic of the course in the student's own words, from their latest explanation, set beside
 * the line of their notes it was checked against, with what it left out in the margin and the lines that still come
 * back underlined. Made to be read the night before, printed, or saved as a PDF. Kelus writes none of it.
 */
export default function RevisionSheetPage() {
  const reduce = useReducedMotion() === true;
  const { state } = useLearner();
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  useDocumentTitle("Your revision sheet");
  useEffect(() => {
    document.body.classList.add("is-session-booklet", "is-session-complete", "is-sheet");
    return () => document.body.classList.remove("is-session-booklet", "is-session-complete", "is-sheet");
  }, []);

  const course = state.snapshot.courses[0];
  const concepts = course ? state.snapshot.concepts.filter((concept) => concept.courseId === course.id) : [];
  const sheet = revisionSheet({ concepts, activities: state.snapshot.learningActivities, events: state.snapshot.events, missed });
  const rise = (index: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay: Math.min(index, 10) * 0.04, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <main id="main" className={styles.page}>
      <nav className={styles.bar} aria-label="Sheet">
        <Link href="/today" className={styles.back}><ArrowLeft /> Study plan</Link>
        <span className={styles.brand} aria-hidden="true"><KelusLogoMark /></span>
        <button type="button" className={`k-btn ${styles.print}`} onClick={() => window.print()} disabled={!sheet.written}>Print or save as PDF</button>
      </nav>

      <header className={styles.head}>
        <p className={styles.running}>{course?.name ?? "Your course"} · revision sheet</p>
        <h1>The sheet you wrote.</h1>
        <p className={styles.lede}>Every topic in your own words, from the last time you explained it, beside the line of your notes it was checked against.</p>
        <p className={styles.meta}>
          <span><b>{sheet.written}</b> of {sheet.total} topics in your words</span>
          {sheet.comingBack ? <span><b>{sheet.comingBack}</b> {sheet.comingBack === 1 ? "line" : "lines"} still coming back</span> : null}
          <span>{day(state.nowIso)}</span>
        </p>
      </header>

      {sheet.total === 0 ? (
        <p className={styles.empty}>Add your notes and explain a topic: its page of the sheet starts there. <Link href="/today">Go to your plan</Link></p>
      ) : (
        <ol className={styles.entries} aria-label="Topics, in the order of your notes">
          {sheet.entries.map((entry, index) => (
            <motion.li key={entry.id} className={styles.entry} data-tone={toneAt(index)} data-written={entry.words ? "true" : undefined} {...rise(index)}>
              <div className={styles.text}>
                <h2><span className={styles.num} aria-hidden="true">{index + 1}</span>{entry.name}</h2>
                {entry.words ? (
                  <>
                    <blockquote className={styles.words}>
                      <p>“{entry.words}”</p>
                      <footer>Your words{entry.wordsAt ? `, ${day(entry.wordsAt)}` : ""}</footer>
                    </blockquote>
                    {entry.notes ? <p className={styles.notes}><span>Your notes</span> {entry.notes}</p> : null}
                  </>
                ) : (
                  <p className={styles.unwritten}>Not in your words yet. <Link href={`/concept?id=${encodeURIComponent(entry.id)}`}>Explain it</Link></p>
                )}
              </div>
              {/* The margin, as a teacher's pencil would use it: what was left out, what was turned around, what comes back. */}
              {entry.leftOut.length || entry.flipped || entry.comingBack.length ? (
                <aside className={styles.margin} aria-label={`Notes on ${entry.name}`}>
                  {entry.leftOut.length ? <p><span>Left out</span> {entry.leftOut.join(", ")}</p> : null}
                  {entry.flipped ? <p><span>Check</span> you wrote <i>{entry.flipped.said}</i>; your notes say <i>{entry.flipped.page}</i></p> : null}
                  {entry.comingBack.length ? (
                    <div className={styles.returning}>
                      <span>Still coming back</span>
                      {entry.comingBack.map((line) => <p key={line}><mark>{line}</mark></p>)}
                    </div>
                  ) : null}
                </aside>
              ) : null}
            </motion.li>
          ))}
        </ol>
      )}
      <p className={styles.foot}>Kelus wrote none of this sheet. It is your explanations, checked against your own notes.</p>
    </main>
  );
}
