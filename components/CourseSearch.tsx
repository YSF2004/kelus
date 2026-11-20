"use client";

import { motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { Octicon } from "@/components/Octicon";
import { searchCourse } from "@/lib/course-search";
import type { Concept, LearningActivity, LearningSourceReference } from "@/domain/types";
import styles from "./CourseSearch.module.css";

export function CourseSearch({ concepts, activities, onOpenSource }: { concepts: Concept[]; activities: LearningActivity[]; onOpenSource: (source: LearningSourceReference) => void }) {
  const reduce = useReducedMotion() === true;
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const results = useMemo(() => submitted ? searchCourse(query, concepts, activities) : [], [submitted, query, concepts, activities]);
  const canSearch = query.trim().length > 1;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canSearch) setSubmitted(true);
  }

  return (
    <section className={styles.panel} aria-labelledby="course-search-title">
      <div className={styles.heading}>
        <div><h2 id="course-search-title">Ask your course</h2><p>Kelus searches only the notes you confirmed.</p></div>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label className="sr-only" htmlFor="course-search-query">Ask about your notes</label>
        <input id="course-search-query" value={query} onChange={(event) => { setQuery(event.target.value); setSubmitted(false); }} placeholder="Where is osmosis explained?" autoComplete="off" />
        <button type="submit" disabled={!canSearch}><Octicon name="paper-airplane" size={15} label="Search your course" /></button>
      </form>
      {submitted ? (
        <motion.div className={styles.results} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} aria-live="polite">
          {results.length ? results.map((result) => {
            const source = result.source;
            return <article key={result.conceptId} className={styles.result}>
              <strong>{result.conceptName}</strong>
              <p>{result.answer}</p>
              {source ? <button type="button" onClick={() => onOpenSource(source)}>Open {source.locator ?? "source"} <span aria-hidden="true">→</span></button> : <small>No exact source location is saved for this older topic.</small>}
            </article>;
          }) : <p className={styles.empty}>No confirmed passage matches that yet. Try the topic’s name, or add the lecture that covers it.</p>}
        </motion.div>
      ) : <p className={styles.note}>Answers come from your course material. Kelus does not fill gaps with outside information.</p>}
    </section>
  );
}
