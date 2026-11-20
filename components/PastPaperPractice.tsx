"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ArrowLeft, ArrowRight } from "@/components/Marks";
import { useAuth } from "@/components/AuthProvider";
import { useLearner } from "@/components/LearnerProvider";
import { comparePastPaperResponse, evidenceForPastPaperQuestion, extractPastPaperQuestions, mapPastPaperQuestions } from "@/domain/past-paper";
import type { ExtractedMaterialPage } from "@/domain/types";
import { extractSourcePages } from "@/lib/source-extraction";
import { readMaterialPdf } from "@/lib/material-sync";
import { getMaterialsSnapshot, getServerMaterialsSnapshot, subscribeMaterials } from "@/lib/material-store";
import { trackEvent } from "@/lib/analytics";
import { readPastPaperCorrections, withoutRejectedPastPaperMatches, type PastPaperMatchCorrection } from "@/lib/past-paper-corrections";
import styles from "./PastPaperPractice.module.css";

export function PastPaperPractice() {
  const { state, start, abandon } = useLearner();
  const auth = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const reduce = useReducedMotion() === true;
  const materials = useSyncExternalStore(subscribeMaterials, getMaterialsSnapshot, getServerMaterialsSnapshot);
  const papers = useMemo(() => materials.filter((item) => item.storage === "local" && item.role === "past_exam"), [materials]);
  const course = state.snapshot.courses[0];
  const [pages, setPages] = useState<ExtractedMaterialPage[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [response, setResponse] = useState({ questionId: "", answer: "", compared: false });
  const focus = search.get("topic");
  const paperKey = papers.map((paper) => paper.id).join(",");
  const courseId = course?.id ?? "guest";
  const [corrections] = useState<PastPaperMatchCorrection[]>(() => readPastPaperCorrections(courseId));

  useEffect(() => {
    document.body.classList.add("is-kelus-space", "is-booklet-page", "is-course-studio");
    return () => document.body.classList.remove("is-kelus-space", "is-booklet-page", "is-course-studio");
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!papers.length) return;
    void (async () => {
      setMessage(null);
      try {
        const parsed = await Promise.allSettled(papers.map(async (paper) => {
          const file = await readMaterialPdf(paper.id, auth.user?.id);
          if (!file) throw new Error(`${paper.title} is no longer on this device. Add it again before practising it.`);
          return extractSourcePages(new File([file], paper.fileName ?? `${paper.title}.pdf`, { type: paper.mimeType ?? "application/pdf" }));
        }));
        const readable = parsed.flatMap((result) => result.status === "fulfilled" ? result.value.pages : []);
        const failed = parsed.filter((result) => result.status === "rejected");
        if (!cancelled) {
          setPages(readable);
          setMessage(failed.length ? `${failed.length === 1 ? "One past paper could not be read" : `${failed.length} past papers could not be read`}. Add a readable copy to use every prompt.` : null);
        }
      } catch (caught) {
        if (!cancelled) { setPages([]); setMessage(caught instanceof Error ? caught.message : "Kelus could not read this past paper."); }
      }
    })();
    return () => { cancelled = true; };
  }, [paperKey, papers, auth.user?.id]);

  const availablePages = useMemo(() => papers.length ? pages : [], [papers.length, pages]);
  const questionMaps = useMemo(() => availablePages ? withoutRejectedPastPaperMatches(mapPastPaperQuestions({
    questions: extractPastPaperQuestions(availablePages),
    concepts: state.snapshot.concepts,
    activities: state.snapshot.learningActivities,
  }), corrections).filter((item) => item.matches.length) : [], [availablePages, state.snapshot.concepts, state.snapshot.learningActivities, corrections]);
  const defaultQuestion = questionMaps.find((item) => item.matches.some((match) => match.conceptId === focus)) ?? questionMaps[0] ?? null;
  const question = questionMaps.find((item) => item.id === selectedId) ?? defaultQuestion;
  const match = question?.matches.find((item) => item.conceptId === focus) ?? question?.matches[0] ?? null;
  const evidence = useMemo(() => question && match ? evidenceForPastPaperQuestion({ question, match, activities: state.snapshot.learningActivities }) : null, [question, match, state.snapshot.learningActivities]);
  const answer = response.questionId === question?.id ? response.answer : "";
  const compared = response.questionId === question?.id && response.compared;
  const comparison = evidence && compared ? comparePastPaperResponse(answer, evidence) : null;
  useEffect(() => {
    if (!questionMaps.length) return;
    trackEvent({ name: "past_paper_practice_opened", linked_prompt_count: questionMaps.length });
  }, [questionMaps.length]);

  function nextPrompt() {
    if (!questionMaps.length || !question) return;
    const next = questionMaps
      .filter((item) => item.id !== question.id)
      .sort((left, right) => (left.matches[0]?.mastery ?? 1) - (right.matches[0]?.mastery ?? 1) || left.text.localeCompare(right.text))[0]?.id ?? question.id;
    setSelectedId(next);
    setResponse({ questionId: next, answer: "", compared: false });
  }

  function studyTopic() {
    if (!match) return;
    const concept = state.snapshot.concepts.find((item) => item.id === match.conceptId);
    const course = concept && state.snapshot.courses.find((item) => item.id === concept.courseId);
    const exam = course && state.snapshot.exams.find((item) => item.courseId === course.id && item.isActive);
    if (!course || !exam) return;
    const open = state.snapshot.sessions.find((item) => item.courseId === course.id && item.status === "in_progress");
    if (open) abandon(open.id);
    const sessionId = start(course.id, exam.id, match.conceptId);
    trackEvent({ name: "past_paper_topic_started", linked: true });
    router.push(`/session?id=${sessionId}`);
  }

  return (
    <AppShell>
      <article className={styles.page}>
        <nav className={styles.crumbs} aria-label="Where you are"><Link href="/today?section=map"><ArrowLeft /> Topics</Link><span>Past paper</span></nav>
        {course ? <nav className={styles.workspaceNav} aria-label={`${course.name} workspace`}>
          <span>{course.name}</span>
          <Link href="/today">Study plan</Link>
          <Link href="/today?section=materials">Materials</Link>
          <Link href="/today?section=map">Topics</Link>
          <Link href="/today?section=progress">Progress</Link>
          <strong aria-current="page">Past paper</strong>
        </nav> : null}
        <header className={styles.header}>
          <h1>Answer first. Then check the line that supports it.</h1>
          <span>This is a real prompt from your past paper. Kelus does not grade it or invent a mark scheme.</span>
        </header>

        {message ? <p className={styles.message} role="status">{message}</p> : null}
        {availablePages === null ? <p className={styles.message} role="status">Preparing prompts from your past paper…</p> : !question ? (
          <section className={styles.empty}>
            <h2>{papers.length ? "No source-backed prompt yet." : "Add a past paper to practise from it."}</h2>
            <p>{papers.length ? "Kelus found no prompt it can support with your confirmed topics. Add the lecture or reading for this exam, then return here to answer against the original line." : "Choose the exam paper you want to practise. Kelus will keep it beside your course material and only use prompts it can trace back to your notes."}</p>
            <div className={styles.emptyActions}>
              <Link href={`/today?section=materials&add=${papers.length ? "notes" : "past_exam"}&returnTo=${encodeURIComponent("/past-paper")}`} className="k-btn">{papers.length ? "Add supporting notes" : "Add a past paper"} <ArrowRight /></Link>
              {papers.length ? <Link href="/today?section=map" className="text-btn">Check confirmed topics</Link> : null}
            </div>
          </section>
        ) : (
          <section className={styles.workspace} aria-labelledby="past-paper-question">
            <div className={styles.meta}><span>Question {questionMaps.findIndex((item) => item.id === question.id) + 1} of {questionMaps.length}</span><span>Past paper · page {question.pageNumber}</span></div>
            <h2 id="past-paper-question">{question.text}</h2>
            <p className={styles.route}>Linked to <strong>{match?.conceptName}</strong> from your course material.</p>
            <label className={styles.answer}>
              <span>Your answer, from memory</span>
              <textarea value={answer} onChange={(event) => setResponse({ questionId: question.id, answer: event.target.value, compared: false })} placeholder="Write what you remember before opening your notes…" rows={6} />
            </label>
            <div className={styles.actions}>
              <button type="button" className="k-btn" onClick={() => { setResponse({ questionId: question.id, answer, compared: true }); trackEvent({ name: "past_paper_response_compared", wrote_answer: answer.trim().length > 0 }); }}>Compare to my notes <ArrowRight /></button>
              <button type="button" className="text-btn" onClick={nextPrompt}>Choose another prompt</button>
            </div>

            <AnimatePresence initial={false}>
              {compared && evidence ? <motion.section key={question.id} className={styles.evidence} aria-live="polite" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
                <div className={styles.evidenceHeading}><span>From your notes</span><strong>{evidence.source?.label ?? evidence.conceptName}{evidence.source?.locator ? ` · ${evidence.source.locator}` : ""}</strong></div>
                <blockquote>{evidence.quote}</blockquote>
                {answer.trim() ? <p className={styles.coverage}>{comparison?.mentioned.length ? <>Your answer names <strong>{comparison.mentioned.join(", ")}</strong> from this source line.</> : "Your answer uses different words from this source line. Read the line, then decide what you want to add."}{comparison?.notMentioned.length ? <> You may want to check <strong>{comparison.notMentioned.join(", ")}</strong>.</> : null}</p> : <p className={styles.coverage}>Read this line, then decide whether you could explain it in your own words. Kelus does not treat an empty answer as a wrong one.</p>}
                <div className={styles.evidenceActions}><button type="button" className="k-btn" onClick={nextPrompt}>Next source-backed prompt <ArrowRight /></button><button type="button" className="text-btn" onClick={studyTopic}>Revise {match?.conceptName}</button><Link href={`/concept?id=${encodeURIComponent(match!.conceptId)}`} className="text-btn">Open topic</Link></div>
              </motion.section> : null}
            </AnimatePresence>
          </section>
        )}
      </article>
    </AppShell>
  );
}
