"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { extractPastPaperQuestions, mapPastPaperQuestions } from "@/domain/past-paper";
import type { Concept, CourseMaterial, ExtractedMaterialPage, LearningActivity } from "@/domain/types";
import { extractSourcePages } from "@/lib/source-extraction";
import { readMaterialPdf } from "@/lib/material-sync";
import { readPastPaperCorrections, rejectPastPaperMatch, restorePastPaperMatch, savePastPaperCorrections, withoutRejectedPastPaperMatches, type PastPaperMatchCorrection } from "@/lib/past-paper-corrections";
import { useAuth } from "@/components/AuthProvider";
import { useLearner } from "@/components/LearnerProvider";
import styles from "./PastPaperPanel.module.css";

type Props = { papers: CourseMaterial[]; concepts: Concept[]; activities: LearningActivity[] };

/** A deliberately bounded exam view: it maps evidence, never invents a grade or a marking scheme. */
export function PastPaperPanel({ papers, concepts, activities }: Props) {
  const [paperId, setPaperId] = useState(papers[0]?.id ?? "");
  const paper = papers.find((item) => item.id === paperId) ?? papers[0] ?? null;
  if (!paper) return null;
  return (
    <>
      {papers.length > 1 ? <label className="sr-only" htmlFor="past-paper-picker">Choose past paper</label> : null}
      <PastPaperAnalysis key={paper.id} paper={paper} papers={papers} paperId={paperId} onSelectPaper={setPaperId} concepts={concepts} activities={activities} />
    </>
  );
}

function PastPaperAnalysis({ paper, papers, paperId, onSelectPaper, concepts, activities }: { paper: CourseMaterial; papers: CourseMaterial[]; paperId: string; onSelectPaper: (id: string) => void; concepts: Concept[]; activities: LearningActivity[] }) {
  const auth = useAuth();
  const { state } = useLearner();
  const reduceMotion = useReducedMotion() === true;
  const courseId = state.snapshot.courses[0]?.id ?? "guest";
  const [pages, setPages] = useState<ExtractedMaterialPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [corrections, setCorrections] = useState<PastPaperMatchCorrection[]>(() => readPastPaperCorrections(courseId));
  const [restored, setRestored] = useState<{ question: string; conceptId: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const file = await readMaterialPdf(paper.id, auth.user?.id);
        if (!file) throw new Error("This past paper is no longer on this device. Add it again to map it.");
        const parsed = await extractSourcePages(new File([file], paper.fileName ?? `${paper.title}.pdf`, { type: paper.mimeType ?? "application/pdf" }));
        if (!cancelled) setPages(parsed.pages);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Kelus could not read this past paper.");
      }
    })();
    return () => { cancelled = true; };
  }, [paper, auth.user?.id]);

  const questionMaps = useMemo(() => pages ? withoutRejectedPastPaperMatches(mapPastPaperQuestions({ questions: extractPastPaperQuestions(pages), concepts, activities }), corrections) : [], [pages, concepts, activities, corrections]);
  const covered = new Set(questionMaps.flatMap((question) => question.matches.map((match) => match.conceptId))).size;
  const unlinked = questionMaps.filter((question) => !question.matches.length).length;

  function reject(question: string, conceptId: string) {
    const next = rejectPastPaperMatch(corrections, question, conceptId);
    setCorrections(next);
    savePastPaperCorrections(courseId, next);
    setRestored({ question, conceptId });
  }

  function restore() {
    if (!restored) return;
    const next = restorePastPaperMatch(corrections, restored.question, restored.conceptId);
    setCorrections(next);
    savePastPaperCorrections(courseId, next);
    setRestored(null);
  }

  return (
    <motion.section className={styles.panel} aria-labelledby="past-paper-title" initial={reduceMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .28, ease: [0.22, 1, 0.36, 1] }}>
      <div className={styles.head}>
        <div><p className={styles.eyebrow}>Exam focus</p><h2 id="past-paper-title" className={styles.title}>See what this paper asks about.</h2></div>
        {papers.length > 1 ? <select id="past-paper-picker" className={styles.picker} value={paperId} onChange={(event) => onSelectPaper(event.target.value)} aria-label="Choose past paper">{papers.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select> : null}
      </div>
      <p className={styles.lede}>Kelus connects each question only to topics and source lines already in your course. It does not predict a grade or create a marking scheme.</p>
      {error ? <p className={styles.empty} role="alert">{error}</p> : !pages ? <p className={styles.notice} role="status">Reading the paper against your study topics…</p> : !questionMaps.length ? <p className={styles.empty}>No clear question prompts were found. This can happen with a scan or answer-only paper; add a text-based copy to map it.</p> : <>
        <div className={styles.summary} aria-label="Exam focus summary"><span className={styles.stat}>{questionMaps.length} prompts found</span><span className={styles.stat}>{covered} study topics connected</span>{unlinked ? <span className={`${styles.stat} ${styles.statWarm}`}>{unlinked} prompt{unlinked === 1 ? "" : "s"} need matching notes</span> : null}</div>
        <ol className={styles.questions}>{questionMaps.map((question) => <li key={question.id} className={styles.question}><div><p className={styles.questionText}>{question.text}</p><span className={styles.page}>Past paper · page {question.pageNumber}</span></div><div className={styles.matches}>{question.matches.length ? question.matches.map((match) => <div key={match.conceptId}><div className={styles.match}><Link href={`/concepts/${match.conceptId}`}>{match.conceptName}</Link><small>{Math.round(match.mastery * 100)}% evidence</small></div>{match.sources[0] ? <span className={styles.source}>{match.sources[0].label}{match.sources[0].locator ? ` · ${match.sources[0].locator}` : ""}</span> : null}<button type="button" className={styles.reject} onClick={() => reject(question.text, match.conceptId)}>Wrong link</button></div>) : <p className={styles.unlinked}>No confirmed topic matches this yet. Add the lecture or reading that supports it.</p>}</div></li>)}</ol>
        {restored ? <p className={styles.correction} role="status">Link removed from this course. <button type="button" onClick={restore}>Undo</button></p> : null}
        <p className={styles.notice}>Use this as a revision checklist: start with a linked prompt, then add supporting notes for anything that remains unmatched.</p>
      </>}
    </motion.section>
  );
}
