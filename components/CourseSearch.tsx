"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Octicon } from "@/components/Octicon";
import { searchCourse, searchCoursePages, type CourseSearchDocument } from "@/lib/course-search";
import type { Concept, CourseMaterial, LearningActivity, LearningSourceReference } from "@/domain/types";
import { useAuth } from "@/components/AuthProvider";
import { readMaterialPdf } from "@/lib/material-sync";
import { extractSourcePages } from "@/lib/source-extraction";
import styles from "./CourseSearch.module.css";

export function CourseSearch({ concepts, activities, materials, onOpenSource }: { concepts: Concept[]; activities: LearningActivity[]; materials: CourseMaterial[]; onOpenSource: (source: LearningSourceReference, quote: string) => void }) {
  const reduce = useReducedMotion() === true;
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pageResults, setPageResults] = useState<ReturnType<typeof searchCoursePages>>([]);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState(false);
  const pageCache = useRef<CourseSearchDocument[] | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const topicResults = useMemo(() => submitted ? searchCourse(query, concepts, activities) : [], [submitted, query, concepts, activities]);
  const results = useMemo(() => [...pageResults, ...topicResults].filter((result, index, all) => index === all.findIndex((candidate) => candidate.source?.materialId === result.source?.materialId && candidate.source?.locator === result.source?.locator && candidate.quote === result.quote)).slice(0, 4), [pageResults, topicResults]);
  const suggestions = useMemo(() => concepts
    .filter((concept) => activities.some((activity) => activity.conceptId === concept.id))
    .slice(0, 3)
    .map((concept) => concept.name), [concepts, activities]);
  const sourceCount = materials.filter((material) => material.storage === "local" && !material.id.startsWith("material-demo-")).length;
  const exampleOnly = sourceCount === 0 && materials.some((material) => material.id.startsWith("material-demo-"));
  const canSearch = query.trim().length > 1;

  useEffect(() => {
    pageCache.current = null;
  }, [materials]);

  async function search(nextQuery = query) {
    if (nextQuery.trim().length < 2) return;
    setSubmitted(true);
    setReadError(false);
    setReading(true);
    try {
      if (!pageCache.current) {
        const readable = materials.filter((material) => material.storage === "local" && !material.id.startsWith("material-demo-"));
        const extracted = await Promise.allSettled(readable.map(async (material) => {
          const blob = await readMaterialPdf(material.id, auth.user?.id);
          if (!blob) return null;
          const file = new File([blob], material.fileName ?? material.title, { type: material.mimeType ?? "application/pdf" });
          const extraction = await extractSourcePages(file);
          return { materialId: material.id, label: material.title, locatorLabel: extraction.locatorLabel, pages: extraction.pages } satisfies CourseSearchDocument;
        }));
        pageCache.current = extracted.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
        if (readable.length > 0 && pageCache.current.length === 0) throw new Error("No saved sources could be read");
      }
      setPageResults(searchCoursePages(nextQuery, pageCache.current));
    } catch {
      setPageResults([]);
      setReadError(true);
    } finally {
      setReading(false);
    }
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void search();
  }

  function chooseSuggestion(suggestion: string) {
    setQuery(suggestion);
    setPageResults([]);
    void search(suggestion);
    requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
  }

  return (
    <section className={styles.panel} aria-labelledby="course-search-title">
      <div className={styles.heading}>
        <div>
          <div className={styles.titleRow}><h2 id="course-search-title">Ask your course</h2><span>On this device</span></div>
          <p>{sourceCount ? `Search ${sourceCount} ${sourceCount === 1 ? "source" : "sources"} and open the exact line.` : exampleOnly ? "This example shows how course search works. Add your own notes for page links." : "Search the original pages Kelus read from this course."}</p>
        </div>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label className="sr-only" htmlFor="course-search-query">Ask about your notes</label>
        <input ref={input} id="course-search-query" value={query} onChange={(event) => { setQuery(event.target.value); setSubmitted(false); setPageResults([]); }} placeholder="Why does water move in osmosis?" autoComplete="off" aria-describedby="course-search-status" />
        <button type="submit" disabled={!canSearch || reading}><Octicon name="paper-airplane" size={15} label="Search your course" /></button>
      </form>
      {!submitted && suggestions.length ? <div className={styles.suggestions} aria-label="Try a topic from this course"><span>Try</span>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => chooseSuggestion(suggestion)}>{suggestion}</button>)}</div> : null}
      {submitted ? (
        <motion.div className={styles.results} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} aria-live="polite">
          <p id="course-search-status" className={styles.status}>{reading ? "Checking the original pages on this device…" : results.length ? `${results.length} ${results.length === 1 ? "place" : "places"} found in your course` : "No matching line found"}</p>
          {reading ? null : results.length ? results.map((result) => {
            const source = result.source;
            const canOpenSource = Boolean(source && !source.materialId.startsWith("material-demo-"));
            return <article key={result.conceptId} className={styles.result}>
              <strong>{result.conceptName}</strong>
              <p>{result.answer}</p>
              {canOpenSource && source ? <button type="button" onClick={() => onOpenSource(source, result.quote)}>Show in {source.locator ?? "source"} <span aria-hidden="true">→</span></button> : <small>{exampleOnly ? "Example course · add your notes to open the original page." : "No exact source location is saved for this older topic."}</small>}
            </article>;
          }) : <p className={styles.empty}>{readError ? "Kelus could not reopen one of these files. Try that source from the shelf, or add it again." : "No confirmed passage matches that yet. Try the topic’s name, or add the lecture that covers it."}</p>}
        </motion.div>
      ) : <p className={styles.note}>{exampleOnly ? "Example answers stay inside this practice course. Your own course gets source links." : "Answers come from your course material. Kelus does not fill gaps with outside information."}</p>}
    </section>
  );
}
