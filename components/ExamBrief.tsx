"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { extractPastPaperQuestions, mapPastPaperQuestions, summarizePastPaperCoverage } from "@/domain/past-paper";
import type { PastPaperExamBrief } from "@/domain/past-paper";
import type { Concept, CourseMaterial, ExtractedMaterialPage, LearningActivity } from "@/domain/types";
import { extractSourcePages } from "@/lib/source-extraction";
import { readMaterialPdf } from "@/lib/material-sync";
import { useAuth } from "@/components/AuthProvider";
import { ArrowRight } from "@/components/Marks";
import { examGapShareText } from "@/lib/exam-gap-share";
import styles from "./ExamBrief.module.css";

type Props = {
  papers: CourseMaterial[];
  concepts: Concept[];
  activities: LearningActivity[];
  onCoverageChange?: (topics: PastPaperExamBrief["topics"]) => void;
};

/**
 * The brief is a coverage view, not an exam prediction. It names only direct links that can be traced back to the
 * student's material and offers the weakest linked topic as a concrete next action.
 */
export function ExamBrief({ papers, concepts, activities, onCoverageChange }: Props) {
  const auth = useAuth();
  const reduceMotion = useReducedMotion() === true;
  const [pages, setPages] = useState<ExtractedMaterialPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const paperKey = papers.map((paper) => paper.id).join(",");

  useEffect(() => {
    let cancelled = false;
    if (!papers.length) return;
    void (async () => {
      try {
        const parsed = await Promise.all(papers.map(async (paper) => {
          const file = await readMaterialPdf(paper.id, auth.user?.id);
          if (!file) throw new Error(`${paper.title} is no longer on this device. Add it again to build the exam brief.`);
          return extractSourcePages(new File([file], paper.fileName ?? `${paper.title}.pdf`, { type: paper.mimeType ?? "application/pdf" }));
        }));
        if (!cancelled) setPages(parsed.flatMap((result) => result.pages));
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Kelus could not read this past paper.");
      }
    })();
    return () => { cancelled = true; };
  }, [paperKey, papers, auth.user?.id]);

  const brief = useMemo(() => {
    if (!pages) return null;
    const questions = extractPastPaperQuestions(pages);
    return summarizePastPaperCoverage({ questionMaps: mapPastPaperQuestions({ questions, concepts, activities }), concepts });
  }, [pages, concepts, activities]);

  useEffect(() => {
    onCoverageChange?.(brief?.topics ?? []);
  }, [brief, onCoverageChange]);

  if (!papers.length) return null;

  async function shareExamFocus() {
    if (!brief) return;
    const text = examGapShareText(brief);
    const url = window.location.origin.includes("localhost") ? window.location.origin : "https://kelus.me";
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "Kelus exam focus", text, url });
        setShareStatus("Summary shared. Your notes and past paper stayed private.");
      } catch {
        // Closing the share sheet does not need an error message.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareStatus("Summary copied. Your notes and past paper stayed private.");
    } catch {
      setShareStatus(`Copy this summary: ${text}`);
    }
  }

  return (
    <motion.section
      className={styles.brief}
      aria-labelledby="exam-brief-title"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Exam focus</p>
          <h2 id="exam-brief-title">What this paper asks about.</h2>
        </div>
        <div className={styles.headingActions}>
          {brief?.promptCount ? <button type="button" className={styles.shareSummary} onClick={() => void shareExamFocus()}>Share summary</button> : null}
          <Link href="/today?section=materials#past-paper-title" className={styles.mapLink}>See every prompt <ArrowRight /></Link>
        </div>
      </div>

      {error ? <p className={styles.message} role="alert">{error}</p> : !brief ? <p className={styles.message} role="status">Reading the paper against your study topics…</p> : !brief.promptCount ? <p className={styles.message}>No clear question prompts were found. Add a text-based past paper to make this view useful.</p> : (
        <>
          <p className={styles.lede}>
            {brief.linkedTopicCount ? <>This paper directly connects to <strong>{brief.linkedTopicCount} of {concepts.length} study topics</strong>.</> : "Kelus found prompts, but no confirmed topic connections yet."}
            {brief.unlinkedTopicCount ? <> {brief.unlinkedTopicCount} topic{brief.unlinkedTopicCount === 1 ? " has" : "s have"} no direct connection here—this does not mean {brief.unlinkedTopicCount === 1 ? "it" : "they"} will not appear.</> : null}
          </p>
          {shareStatus ? <p className={styles.shareStatus} role="status">{shareStatus}</p> : null}

          {brief.priority ? <section className={styles.priority} aria-label="Best place to start from the past paper">
            <div>
              <span>Start with this</span>
              <strong>{brief.priority.conceptName}</strong>
              <p>Appears in {brief.priority.promptCount} past-paper prompt{brief.priority.promptCount === 1 ? "" : "s"} · {brief.priority.attempts ? `${Math.round(brief.priority.mastery * 100)}% evidence from ${brief.priority.attempts} ${brief.priority.attempts === 1 ? "try" : "tries"}` : "not practised yet"}</p>
            </div>
            <div className={styles.priorityActions}>
              <Link href={`/past-paper?topic=${encodeURIComponent(brief.priority.conceptId)}`} className="k-btn">Try a real prompt <ArrowRight /></Link>
              <Link href={`/concept?id=${encodeURIComponent(brief.priority.conceptId)}`} className={styles.topicLink}>Study topic</Link>
            </div>
          </section> : null}

          <div className={styles.columns}>
            <section aria-label="Topics linked to the past paper">
              <h3>Direct links</h3>
              <ul>
                {brief.topics.slice(0, 4).map((topic) => <li key={topic.conceptId}>
                  <Link href={`/concept?id=${encodeURIComponent(topic.conceptId)}`}>{topic.conceptName}</Link>
                  <span>{topic.promptCount} prompt{topic.promptCount === 1 ? "" : "s"} · {topic.attempts ? `${Math.round(topic.mastery * 100)}% evidence` : "not practised"}</span>
                </li>)}
              </ul>
            </section>
            <section aria-label="Prompts still needing course evidence">
              <h3>Needs a source match</h3>
              <p>{brief.unmatchedPromptCount ? `${brief.unmatchedPromptCount} prompt${brief.unmatchedPromptCount === 1 ? " has" : "s have"} no confirmed support in your course yet. Add the lecture or reading before relying on an answer.` : "Every extracted prompt has a confirmed topic link."}</p>
            </section>
          </div>
        </>
      )}
    </motion.section>
  );
}
