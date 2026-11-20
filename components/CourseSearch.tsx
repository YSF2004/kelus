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
  const topicResults = useMemo(() => submitted ? searchCourse(query, concepts, activities) : [], [submitted, query, concepts, activities]);
  const results = useMemo(() => [...pageResults, ...topicResults].filter((result, index, all) => index === all.findIndex((candidate) => candidate.source?.materialId === result.source?.materialId && candidate.source?.locator === result.source?.locator && candidate.quote === result.quote)).slice(0, 4), [pageResults, topicResults]);
  const canSearch = query.trim().length > 1;

  useEffect(() => {
    pageCache.current = null;
  }, [materials]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSearch) return;
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
      setPageResults(searchCoursePages(query, pageCache.current));
    } catch {
      setPageResults([]);
      setReadError(true);
    } finally {
      setReading(false);
    }
  }

  return (
    <section className={styles.panel} aria-labelledby="course-search-title">
      <div className={styles.heading}>
        <div><h2 id="course-search-title">Ask your course</h2><p>Search the original pages Kelus read from this course.</p></div>
      </div>
      <form className={styles.form} onSubmit={submit}>
        <label className="sr-only" htmlFor="course-search-query">Ask about your notes</label>
        <input id="course-search-query" value={query} onChange={(event) => { setQuery(event.target.value); setSubmitted(false); setPageResults([]); }} placeholder="Why does water move in osmosis?" autoComplete="off" />
        <button type="submit" disabled={!canSearch || reading}><Octicon name="paper-airplane" size={15} label="Search your course" /></button>
      </form>
      {submitted ? (
        <motion.div className={styles.results} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} aria-live="polite">
          {reading ? <p className={styles.note}>Checking the original pages on this device…</p> : results.length ? results.map((result) => {
            const source = result.source;
            return <article key={result.conceptId} className={styles.result}>
              <strong>{result.conceptName}</strong>
              <p>{result.answer}</p>
              {source ? <button type="button" onClick={() => onOpenSource(source, result.quote)}>Show in {source.locator ?? "source"} <span aria-hidden="true">→</span></button> : <small>No exact source location is saved for this older topic.</small>}
            </article>;
          }) : <p className={styles.empty}>{readError ? "Kelus could not reopen one of these files. Try that source from the shelf, or add it again." : "No confirmed passage matches that yet. Try the topic’s name, or add the lecture that covers it."}</p>}
        </motion.div>
      ) : <p className={styles.note}>Answers come from your course material. Kelus does not fill gaps with outside information.</p>}
    </section>
  );
}
