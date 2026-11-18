"use client";

import { ThemeToggle } from "@/components/ThemeSwitch";
import { toneOf } from "@/lib/topic-tone";
import { uiWords } from "@/lib/ui-words";
import { ArrowOut, ArrowRight } from "@/components/Marks";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { kelusDuration, kelusEase } from "@/components/motion";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type SyntheticEvent } from "react";
import { toast } from "sonner";
import { InlineName } from "@/components/InlineName";
import { play, setSounds, soundsOn, subscribeSounds } from "@/lib/sound";
import { useLearner } from "@/components/LearnerProvider";
import { evaluateLearningResponse, type AnswerEvaluation } from "@/domain/answer-evaluation";
import { resumeSessionIndex } from "@/domain/session-engine";
import type { Concept, LearningActivity, LearningSourceReference, RetrievalOutcome, RouteAllocation } from "@/domain/types";
import { primaryActivitySourceReference, resolveEvidenceSource } from "@/domain/source-reference";
import { getMaterialsSnapshot, getServerMaterialsSnapshot, subscribeMaterials } from "@/lib/material-store";
import { readMaterialPdf } from "@/lib/material-sync";
import { useAuth } from "@/components/AuthProvider";
import { useDocumentTitle } from "@/lib/use-title";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import { LoopSteps } from "@/components/LoopSteps";
import { MarkStamp } from "@/components/MarkStamp";
import { QuickResult, type QuickStats } from "@/components/QuickResult";
import { comesBackLine, planLine } from "@/lib/verdict";
import { dayKey, habitSummary } from "@/domain/habit";
import { MinuteShift, RouteShift } from "@/components/RouteShift";
import { PracticeDrill } from "@/components/PracticeDrill";
import { NotesSection } from "@/components/NotesSection";
import { markdownToPages } from "@/domain/markdown-pages";
import type { ExtractedMaterialPage } from "@/domain/types";
import { QuickRun, type QuickRunResult } from "@/components/QuickRun";
import { buildQuickRun, quickOutcome, quickSummary } from "@/domain/quick-run";
import { flagKey, flaggedKeys } from "@/lib/flags";
import { aiActive, aiConfigured, fetchAiTopicContent, readCachedAi } from "@/lib/ai-client";
import { mergeAiContent, type AiTopicContent } from "@/domain/ai-content";
import { CourseSourceReader } from "@/components/CourseSourceReader";
import { SessionMenu } from "@/components/SessionMenu";
import { BlockOutline } from "@/components/BlockOutline";
import { addMissedLines } from "@/lib/missed-lines";
import { addKnownLines, forgetKnownLines, getKnownLines, getServerKnownLines, knownCount, subscribeKnownLines } from "@/lib/known-lines";
import { trackEvent } from "@/lib/analytics";
import { SAMPLE_COURSE_IDS } from "@/lib/pilot";
import { studyDraftKey } from "@/domain/study-draft";
import { SampleCourseNotice } from "@/components/SampleCourseNotice";

type Phase = "learn" | "retrieve" | "apply" | "evaluate" | "result" | "reroute";
type HelpMode = "hint" | "explain" | null;
type SourcePanelState = {
  title: string;
  locator: string | null;
  kind: "pdf" | "notes" | "link" | "unavailable";
  href: string | null;
  section?: ExtractedMaterialPage | null;
  reason?: "missing" | "read_failed" | "built_in";
};

const PHASE_LABEL: Record<"learn" | "retrieve" | "apply" | "evaluate", string> = {
  learn: "Read",
  retrieve: "Retrieve",
  apply: "Use",
  evaluate: "Mark",
};

function activityFallback(concept: Concept, promptText: string, modelAnswer: string): LearningActivity {
  return {
    id: `activity-${concept.id}`,
    conceptId: concept.id,
    learn: {
      title: `Build a usable explanation of ${concept.name}.`,
      explanation: modelAnswer,
      keyPoints: ["Read for the relationship between cause and result.", "Then close the explanation and retrieve it in your own words."],
    },
    retrieve: {
      prompt: promptText,
      hint: "Name the central relationship before adding detail.",
      explanation: modelAnswer,
      example: "Connect the concept to a concrete case from your course.",
      modelAnswer,
    },
    apply: {
      prompt: `Give one new example that correctly uses ${concept.name}.`,
      hint: "Change the context, but keep the same underlying relationship.",
      modelAnswer: `A strong example should name ${concept.name} and correctly connect its cause to its result.`,
    },
    sourceReferences: [],
  };
}

function SessionBody() {
  const router = useRouter();
  const search = useSearchParams();
  const reduceMotion = useReducedMotion();
  const sessionId = search.get("id");
  const { state, submit, abandon, removeTopic, renameTopic } = useLearner();
  const auth = useAuth();
  const materials = useSyncExternalStore(subscribeMaterials, getMaterialsSnapshot, getServerMaterialsSnapshot);
  const session = state.snapshot.sessions.find((item) => item.id === sessionId);
  const firstStudySession = !state.snapshot.sessions.some((item) => item.status === "complete" && !SAMPLE_COURSE_IDS.has(item.courseId));
  const [position, setPosition] = useState<{ sessionId: string; index: number } | null>(null);
  const index = position && session && position.sessionId === session.id
    ? position.index
    : session ? resumeSessionIndex(session, state.snapshot.events) : 0;
  const [retrieveAnswer, setRetrieveAnswer] = useState("");
  const [applicationAnswer, setApplicationAnswer] = useState("");
  const [phase, setPhase] = useState<Phase>("learn");
  const [helpMode, setHelpMode] = useState<HelpMode>(null);
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [lastOutcome, setLastOutcome] = useState<RetrievalOutcome | null>(null);
  const [quickStats, setQuickStats] = useState<QuickStats | null>(null);
  const [quickMissed, setQuickMissed] = useState<string[]>([]);
  const [routeBeforeIds, setRouteBeforeIds] = useState<string[]>([]);
  const [routeBeforeAllocations, setRouteBeforeAllocations] = useState<RouteAllocation[]>([]);
  const [sourcePanel, setSourcePanel] = useState<SourcePanelState | null>(null);
  const [evidenceSourceOverride, setEvidenceSourceOverride] = useState<{ conceptId: string; reference: LearningSourceReference } | null>(null);
  const [openingSource, setOpeningSource] = useState(false);
  const [sourceRevealed, setSourceRevealed] = useState(false);
  // The full notes slide in from the side when asked for; the page under the question never rearranges.
  const [notesOpen, setNotesOpen] = useState(false);
  // A missed line to circle on the original page; cleared when the topic changes.
  const [markedLine, setMarkedLine] = useState<string | null>(null);
  const [draftSaved, setDraftSaved] = useState<boolean | null>(null);
  const [sourceJump, setSourceJump] = useState(0);

  useEffect(() => {
    if (!notesOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setNotesOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [notesOpen]);
  const sourceRequest = useRef(0);
  const sourceCloseRef = useRef<HTMLButtonElement>(null);
  const sourceOpenerRef = useRef<HTMLElement | null>(null);
  const startedAt = useRef(0);
  const responseTimeMs = useRef(0);
  const sourceObjectUrl = useRef<string | null>(null);
  const conceptId = session?.plannedConceptIds[index];
  const concept = state.snapshot.concepts.find((item) => item.id === conceptId);
  const prompt = state.snapshot.prompts.find((item) => item.conceptId === conceptId);
  const baseActivity = state.snapshot.learningActivities?.find((item) => item.conceptId === conceptId)
    ?? (concept && prompt ? activityFallback(concept, prompt.promptText, prompt.modelAnswer) : null);
  // Optional, opt-in: questions written from this topic's page. Any failure leaves the offline questions in place.
  const [ai, setAi] = useState<{ id: string; content: AiTopicContent | null } | null>(null);
  const pageText = baseActivity?.teach?.pageText;
  const aiRequest = concept && pageText
    ? {
        name: concept.name,
        locator: primaryActivitySourceReference(baseActivity)?.locator ?? "this page",
        pageText,
        otherTopics: state.snapshot.concepts.filter((item) => item.id !== concept.id).map((item) => item.name),
      }
    : null;
  // On-device writing is slow and happens ahead of time from Today; here only finished questions are used,
  // so a run never changes while someone is answering it.
  const writtenAhead = aiRequest && !aiConfigured() && aiActive() ? readCachedAi(aiRequest) : null;
  useEffect(() => {
    if (!aiRequest || !aiConfigured() || !aiActive()) return;
    let live = true;
    void fetchAiTopicContent(aiRequest).then((content) => { if (live) setAi({ id: aiRequest.name === concept?.name ? concept.id : "", content }); });
    return () => { live = false; };
    // Re-run only when the topic changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conceptId]);
  const activity = baseActivity && writtenAhead ? mergeAiContent(baseActivity, writtenAhead) : baseActivity && ai && ai.id === conceptId ? mergeAiContent(baseActivity, ai.content) : baseActivity;
  const siblingNames = state.snapshot.concepts.filter((item) => item.courseId === concept?.courseId).map((item) => item.name);
  // Fixed when the topic opens, so finishing a run does not reshuffle it under the learner.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const round = useMemo(() => concept?.retrievalAttempts ?? 0, [conceptId]);
  const run = useMemo(
    () => {
      if (!activity || !concept) return null;
      const built = buildQuickRun({ activity, name: concept.name, siblingNames, round, readFirst: round === 0 });
      // A question the student flagged is never asked again on this device.
      const flagged = flaggedKeys();
      return built && flagged.size ? { ...built, checks: built.checks.filter((check) => !flagged.has(flagKey(check))) } : built;
    },
    // The run is rebuilt only when the topic or its content changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conceptId, round, activity?.practice?.length, activity?.teach?.aiExplanation],
  );
  const quickMode = Boolean(run);
  const uiw = uiWords();
  const [runKey, setRunKey] = useState(0);
  const soundsEnabled = useSyncExternalStore(subscribeSounds, soundsOn, () => false);
  const knownLines = useSyncExternalStore(subscribeKnownLines, getKnownLines, getServerKnownLines);
  const courseId = concept?.courseId;
  const courseConceptIds = new Set(state.snapshot.concepts.filter((item) => item.courseId === courseId).map((item) => item.id));
  // Fixed when the topic opens, like the run itself: the counter moves with this run's answers, not under them.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const knownAtOpen = useMemo(() => ({ set: new Set(knownLines.map((line) => line.quote)), count: knownCount(knownLines, courseConceptIds) }), [conceptId, runKey]);
  const total = session?.plannedConceptIds.length ?? 0;
  const focusStep = useCallback((node: HTMLElement | null) => {
    if (!node || (["retrieve", "apply"] as Phase[]).includes(phase)) return;
    // Where you'd type, if the screen has a field (a gap, an explanation), so you can just start typing; else the screen.
    const field = node.querySelector<HTMLElement>("input:not([disabled]):not([type=hidden]), textarea:not([disabled])");
    (field ?? node).focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    document.body.classList.add("is-session-booklet");
    return () => document.body.classList.remove("is-session-booklet");
  }, []);

  useEffect(() => () => {
    sourceRequest.current += 1;
    if (sourceObjectUrl.current) URL.revokeObjectURL(sourceObjectUrl.current);
  }, []);

  useEffect(() => {
    if (!sourcePanel) return;
    const previous = sourceOpenerRef.current;
    const timer = window.setTimeout(() => sourceCloseRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (sourceObjectUrl.current) {
          URL.revokeObjectURL(sourceObjectUrl.current);
          sourceObjectUrl.current = null;
        }
        setSourcePanel(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, [sourcePanel]);

  const before = useMemo<Concept[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(sessionStorage.getItem("kelus-session-before") || "[]") as Concept[]; }
    catch { return []; }
  }, []);

  // The tab names the topic you are on, so a glance at the browser says where the block is.
  const tabTopic = concept?.name;
  useDocumentTitle(tabTopic ? `${tabTopic} · Studying — Kelus` : null);

  if (!session || !concept || !prompt || !activity) {
    return (
      <main id="main" className="study-shell">
        <section className="materials-empty is-session-empty">
          <h1>No active revision yet.</h1>
          <p>Sessions open from your study plan. Each one walks a topic through the same loop:</p>
          <LoopSteps />
          <div className="materials-empty-actions">
            <button className="cta" type="button" onClick={() => router.replace("/today")}>
              Open today’s route <ArrowRight />
            </button>
          </div>
        </section>
      </main>
    );
  }

  const activeSessionId = session.id;
  const activeSession = session;
  const plannedLength = session.plannedConceptIds.length;
  const activeConcept = concept;
  const activePrompt = prompt;
  const activeActivity = activity;
  function checkAnswers(event: SyntheticEvent) {
    responseTimeMs.current = Math.max(0, Math.round(event.timeStamp - startedAt.current));
    const nextEvaluation = evaluateLearningResponse({
      retrieveAnswer,
      applicationAnswer,
      retrieveModelAnswer: activeActivity.retrieve.modelAnswer,
      applicationModelAnswer: activeActivity.apply.modelAnswer,
      assessment: activeActivity.assessment,
    });
    setEvaluation(nextEvaluation);
    setHelpMode(null);
    setPhase("evaluate");
  }

  function grade(outcome: RetrievalOutcome, texts?: { retrieve: string; application: string }) {
    // Hold the current page while the recorded event moves the resumable index forward.
    setPosition({ sessionId: activeSessionId, index });
    setLastOutcome(outcome);
    setRouteBeforeIds(activeSession.latestRoute.allocations.map((item) => String(item.conceptId)));
    setRouteBeforeAllocations(activeSession.latestRoute.allocations);
    submit({
      conceptId: activeConcept.id,
      sessionId: activeSessionId,
      promptId: activePrompt.id,
      responseText: `${texts?.retrieve ?? retrieveAnswer}\n\nApplication: ${texts?.application ?? applicationAnswer}`,
      outcome,
      responseTimeMs: responseTimeMs.current,
      answerRevealed: true,
      finish: index + 1 >= plannedLength ? { before } : undefined,
    });
    setPhase("result");
  }

  function resetForNextConcept() {
    setPosition({ sessionId: activeSessionId, index: index + 1 });
    setRetrieveAnswer("");
    setApplicationAnswer("");
    setEvaluation(null);
    setLastOutcome(null);
    setRouteBeforeIds([]);
    setRouteBeforeAllocations([]);
    setHelpMode(null);
    setSourceRevealed(false);
    setNotesOpen(false);
    setMarkedLine(null);
    setEvidenceSourceOverride(null);
    setPhase("learn");
    startedAt.current = 0;
    responseTimeMs.current = 0;
  }

  function finishQuick(result: QuickRunResult) {
    play("done");
    const outcome = quickOutcome({ ...result, readFirst: round === 0 });
    const firstPassOnly = round === 0 && outcome === "partial" && quickOutcome(result) === "success";
    const summary = `${quickSummary(result)}${firstPassOnly ? " Good first pass; Kelus will check it again later before calling it solid." : ""}`;
    setQuickStats({ right: result.right, total: result.total, unsure: result.unsure, self: result.self, coverage: result.coverage ?? null });
    setQuickMissed(result.missed);
    // What was missed comes back at the start of the next visit, as a warm-up.
    if (concept) addMissedLines(result.missed.map((quote) => ({ conceptId: concept.id, name: concept.name, quote, at: state.nowIso })));
    // What was right counts as a line you can recall; a miss takes the line off that count.
    if (concept) addKnownLines(result.known.map((quote) => ({ conceptId: concept.id, name: concept.name, quote, at: state.nowIso })));
    forgetKnownLines(result.missed);
    setRetrieveAnswer(result.explained);
    setApplicationAnswer(summary);
    responseTimeMs.current = result.elapsedMs;
    setEvaluation({
      outcome,
      score: result.total ? result.right / result.total : 0,
      label: outcome === "success" ? "Strong evidence" : outcome === "partial" ? "Partial evidence" : "Not enough evidence yet",
      explanation: summary,
      matchedRetrieve: 0,
      matchedApply: 0,
      criteria: [],
      contradiction: false,
      evidenceStatus: outcome === "success" ? "source_supported" : "incomplete",
      mode: "general",
      reviewNote: "Kelus checked the source-linked checks you completed. Compare with the source before relying on a nuanced answer.",
    });
    grade(outcome, { retrieve: result.explained, application: summary });
  }

  function retryCurrentConcept() {
    if (quickMode) {
      // A retry launched from the marked source is a repair pass, not a fresh
      // blind recall. Keep that page beside the next check so the student can
      // repair the relationship without hunting for the evidence again.
      const repairingFromSource = Boolean(notesOpen && markedLine);
      setRetrieveAnswer("");
      setApplicationAnswer("");
      setEvaluation(null);
      setHelpMode(null);
      setSourceRevealed(repairingFromSource);
      setNotesOpen(repairingFromSource);
      setRunKey((value) => value + 1);
      setPhase("learn");
      startedAt.current = performance.now();
      return;
    }
    setRetrieveAnswer("");
    setApplicationAnswer("");
    setEvaluation(null);
    setHelpMode(null);
    setSourceRevealed(false);
    setNotesOpen(false);
    setPhase("retrieve");
    startedAt.current = performance.now();
  }

  function advance() {
    const updatedSession = state.snapshot.sessions.find((item) => item.id === activeSessionId);
    if (routeChanged) {
      if (lastOutcome === "partial" || lastOutcome === "failure") {
        const previous = routeBeforeIds.length
          ? routeBeforeIds
          : activeSession.initialRoute.allocations.map((allocation) => String(allocation.conceptId));
        const next = updatedSession?.latestRoute.allocations.map((allocation) => String(allocation.conceptId)) ?? [];
        trackEvent({ name: "route_recalculated", changed: routeChanged || previous.join("|") !== next.join("|"), outcome: lastOutcome });
      }
      // In a quick run the result card already said where the plan goes next ("Continue to …"); a second
      // "Updated." screen would only be one more stop. The longer loop keeps its route view.
      if (!quickMode) {
        setPhase("reroute");
        return;
      }
    }
    if (index + 1 >= plannedLength) {
      router.push(`/session/complete?id=${activeSessionId}`);
      return;
    }
    resetForNextConcept();
  }

  function continueAfterReroute() {
    if (index + 1 >= plannedLength) {
      router.push(`/session/complete?id=${activeSessionId}`);
      return;
    }
    resetForNextConcept();
  }

  const completedIds = new Set(state.snapshot.events.filter((event) => event.sessionId === session.id && event.kind === "retrieval").map((event) => event.conceptId));
  const previousRemaining = routeBeforeIds.filter((id) => id !== "mixed-retrieval" && !completedIds.has(id) && session.plannedConceptIds.includes(id));
  const nextRemaining = session.plannedConceptIds.filter((id) => !completedIds.has(id));
  const routeOrderChanged = routeBeforeIds.length > 0 && previousRemaining.join("|") !== nextRemaining.join("|");
  const previousMinutes = new Map(routeBeforeAllocations.map((allocation) => [allocation.conceptId, allocation.minutes]));
  const minuteChanges = session.latestRoute.allocations
    .filter((allocation) => allocation.conceptId !== "mixed-retrieval" && nextRemaining.includes(allocation.conceptId) && previousMinutes.has(allocation.conceptId) && previousMinutes.get(allocation.conceptId) !== allocation.minutes)
    .map((allocation) => ({
      name: state.snapshot.concepts.find((item) => item.id === allocation.conceptId)?.name ?? "Topic",
      before: previousMinutes.get(allocation.conceptId)!,
      after: allocation.minutes,
    }));
  const routeChanged = routeOrderChanged || minuteChanges.length > 0;
  // The topic your answer pulled forward, named, so "the plan changed" is something you can see.
  const movedUpId = routeOrderChanged ? nextRemaining.find((id) => previousRemaining.includes(id) && nextRemaining.indexOf(id) < previousRemaining.indexOf(id)) : undefined;
  const movedUpName = state.snapshot.concepts.find((item) => item.id === movedUpId)?.name;
  const nextConceptName = state.snapshot.concepts.find((item) => item.id === session.plannedConceptIds[index + 1])?.name;
  const goalToday = habitSummary({ events: state.snapshot.events, concepts: state.snapshot.concepts.filter((item) => item.courseId === concept?.courseId) });
  const checkCount = state.snapshot.events.filter((event) => event.conceptId === concept.id && event.kind === "retrieval").length;
  const helpCopy = helpMode === "hint" ? activity.retrieve.hint : helpMode === "explain" ? activity.retrieve.explanation : null;
  const phaseSource = resolveEvidenceSource(
    phase === "apply" ? activity.apply.sourceReference : activity.retrieve.sourceReference,
    activity.sourceReferences,
  );
  const currentSource = evidenceSourceOverride?.conceptId === concept.id
    ? evidenceSourceOverride.reference
    : phaseSource.reference;
  // The plan should never look like a black box. Name the evidence that made this topic return sooner or later.
  const routeReason = lastOutcome === "success"
    ? `Your checks and explanation gave ${concept.name} room to come back later.`
    : quickMissed[0]
      ? `Because this line from ${currentSource?.locator ?? "your notes"} was not recalled yet.`
      : `Because this topic still needs another pass from your notes.`;
  const currentMaterial = materials.find((item) => item.id === currentSource?.materialId)
    ?? (currentSource?.materialId === "demo-syllabus-microeconomics" ? materials.find((item) => item.id === "material-demo-microeconomics") : null)
    ?? null;
  const hasReadableSource = currentMaterial?.storage === "local" && !currentMaterial.id.startsWith("material-demo-");
  const sourcePage = Number(currentSource?.locator?.match(/\d+/)?.[0] ?? 1);
  const recallWithoutLooking = ((["retrieve", "apply"] as Phase[]).includes(phase) || (quickMode && phase === "learn")) && !sourceRevealed;

  async function openSource(materialId: string, locator: string | null) {
    sourceOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const material = materials.find((item) => item.id === materialId)
      ?? (materialId === "demo-syllabus-microeconomics" ? materials.find((item) => item.id === "material-demo-microeconomics") : null);
    if (sourceObjectUrl.current) {
      URL.revokeObjectURL(sourceObjectUrl.current);
      sourceObjectUrl.current = null;
    }
    if (!material) {
      setSourcePanel({ title: "Course source", locator, kind: "unavailable", href: null, reason: "missing" });
      return;
    }
    if (material.id.startsWith("material-demo-")) {
      setSourcePanel({ title: material.title, locator, kind: "unavailable", href: null, reason: "built_in" });
      return;
    }
    if (material.storage === "url" && material.sourceUrl) {
      setSourcePanel({ title: material.title, locator, kind: "link", href: material.sourceUrl });
      return;
    }
    const request = ++sourceRequest.current;
    setOpeningSource(true);
    let blob: Blob | null = null;
    let readFailed = false;
    try {
      blob = await readMaterialPdf(materialId, auth.user?.id);
    } catch {
      readFailed = true;
    } finally {
      if (request === sourceRequest.current) setOpeningSource(false);
    }
    if (request !== sourceRequest.current) return;
    if (!blob) {
      setSourcePanel({
        title: material.title,
        locator,
        kind: "unavailable",
        href: null,
        reason: readFailed ? "read_failed" : "missing",
      });
      return;
    }
    const page = Number(locator?.match(/\d+/)?.[0] ?? 1);
    if (material.kind === "text") {
      const sections = markdownToPages(await blob.text());
      setSourcePanel({ title: material.title, locator, kind: "notes", href: null, section: sections[Math.min(Math.max(page, 1), sections.length) - 1] ?? null });
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    sourceObjectUrl.current = objectUrl;
    setSourcePanel({ title: material.title, locator, kind: "pdf", href: `${objectUrl}#page=${page}` });
  }

  function closeSource() {
    if (sourceObjectUrl.current) {
      URL.revokeObjectURL(sourceObjectUrl.current);
      sourceObjectUrl.current = null;
    }
    setSourcePanel(null);
  }

  /**
   * A correction is only useful if it takes the learner to the evidence, not
   * merely to the document. Keep the question and its quoted line together:
   * on a local source, the reader opens at that page with the line marked;
   * on a link or an unavailable file, retain the existing safe fallback.
   */
  function showCurrentEvidence() {
    const quote = quickMissed[0] ?? run?.extraFact ?? activity?.retrieve.modelAnswer ?? null;
    if (quote) setMarkedLine(quote);
    setSourceRevealed(true);

    if (currentMaterial?.storage === "local" && !currentMaterial.id.startsWith("material-demo-")) {
      setSourceJump((current) => current + 1);
      setNotesOpen(true);
      return;
    }

    if (currentSource && currentMaterial) void openSource(currentSource.materialId, currentSource.locator);
  }

  return (
    <main id="main" data-phase={phase} data-tone={toneOf(concept?.id, state.snapshot.concepts)} className={`study-shell${sourcePanel ? " is-source-open" : ""}${hasReadableSource ? "" : " is-source-missing"}${recallWithoutLooking && hasReadableSource ? " is-recalling" : ""}${quickMode ? " is-focus" : ""}${quickMode && notesOpen && hasReadableSource ? " is-notes-open" : ""}`}>
      <div className="study-context is-folio">
        <span className="study-context-title">
          <Link href="/" className="study-brand" aria-label="Kelus home"><KelusLogoMark /><span>kelus</span></Link>
          <span className="study-context-theme"><ThemeToggle /></span>
          {/* In a run the topic is named above the question, where the eye already is, not squeezed beside the mark. */}
          {quickMode ? null : <small><b>{concept.name}</b>{total > 1 ? ` · topic ${index + 1} of ${total}` : ""}</small>}
        </span>
        <div className="study-folio-actions">
          <SessionMenu
            label={uiw.more}
            items={[
              {
                label: soundsEnabled ? "Turn sounds off" : "Turn sounds on",
                onSelect: () => setSounds(!soundsEnabled),
              },
              ...(quickMode && hasReadableSource ? [{
                label: notesOpen ? "Hide your notes" : recallWithoutLooking ? "Peek at the notes" : "See your notes",
                onSelect: () => { setSourceRevealed(true); setNotesOpen((open) => !open); },
              }] : []),
              ...(quickMode ? [{
                label: "Remove this topic",
                danger: true,
                // No "are you sure": it can be undone from the note that appears.
                // The page lifts away first, then the topic goes, so the removal reads as one gesture.
                onSelect: () => {
                  const main = document.getElementById("main");
                  const go = () => { abandon(session.id); removeTopic(concept.id); router.push("/today"); };
                  if (!main || reduceMotion) { go(); return; }
                  main.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(-6px) scale(0.99)" }], { duration: 200, easing: "cubic-bezier(0.4, 0, 1, 1)", fill: "forwards" }).finished.then(go, go);
                },
              }] : []),
              {
                label: "Discard session",
                danger: true,
                confirm: { question: "Discard this session? Your answers so far are kept.", yes: "Discard" },
                onSelect: () => { trackEvent({ name: "session_abandoned" }); abandon(session.id); router.push("/today"); },
              },
            ]}
          />
          <button
            type="button"
            className="text-btn study-close"
            title="Back to your study plan — your place is kept"
            onClick={() => {
              if (quickMode && phase === "learn" && draftSaved === false) {
                toast.error("Your browser couldn’t save this answer. Keep this tab open, or enable browser storage before leaving.");
                return;
              }
              const done = session.plannedConceptIds.filter((id) => state.snapshot.events.some((event) => event.sessionId === session.id && event.kind === "retrieval" && event.conceptId === id)).length;
              toast(`${draftSaved && phase === "learn" ? "Your question and unfinished answer are saved on this device." : "Your completed topics are saved."} ${done ? `${done} of ${session.plannedConceptIds.length} topics done. ` : ""}Choose Continue on your plan to return.`);
              router.push("/today");
            }}
          >
            {uiw.close}
          </button>
        </div>
      </div>
      {session && SAMPLE_COURSE_IDS.has(session.courseId) ? <SampleCourseNotice compact /> : null}
      {(() => {
        const outline = quickMode ? (
          <BlockOutline
            course={state.snapshot.courses.find((item) => item.id === concept.courseId)?.name ?? "Your course"}
            topics={session.plannedConceptIds.map((id) => {
              const last = [...state.snapshot.events].reverse().find((event) => event.sessionId === session.id && event.kind === "retrieval" && event.conceptId === id);
              return { id, name: state.snapshot.concepts.find((item) => item.id === id)?.name ?? "Topic", outcome: last?.outcome ?? null, current: id === concept.id, tone: toneOf(id, state.snapshot.concepts) };
            })}
          />
        ) : null;
        // One outline, never two: in a run it takes the side column's place when that column shows (notes open),
        // and floats in the empty margin when the focus layout hides the column.
        const focusLayout = quickMode;
        return (
          <>
            {outline && focusLayout ? <div className="block-outline-float">{outline}</div> : null}
            <aside className="session-workspace-rail" aria-label="Course workspace">
              {outline ? outline : (
                <>
                  <p>Your course</p>
                  <strong>{state.snapshot.courses.find((item) => item.id === concept.courseId)?.name ?? "Course"}</strong>
                  <nav aria-label="Workspace sections">
                    <Link href="/today">Study plan</Link>
                    <Link href="/today?section=materials">Materials</Link>
                    <Link href="/today?section=map">Topics</Link>
                  </nav>
                  <div className="session-rail-topic"><span>Now studying</span><b>{concept.name}</b><small>{index + 1} of {total} topics</small></div>
                </>
              )}
            </aside>
          </>
        );
      })()}
      {hasReadableSource ? <div className="session-workspace-source" aria-label="Your notes">
        {quickMode ? <button type="button" className="session-notes-close" onClick={() => setNotesOpen(false)} aria-label="Close your notes">Close notes <ArrowRight /></button> : null}
        <CourseSourceReader key={`${currentMaterial.id}-${sourcePage}-${sourceJump}`} material={currentMaterial} initialPage={sourcePage} concealed={recallWithoutLooking} onShowSource={() => setSourceRevealed(true)} highlight={markedLine} />
      </div> : null}
      <div className="study-loop-track">
        {quickMode ? null : (
          <LoopSteps
            compact
            label="Study steps"
            current={(["read", "retrieve", "use", "mark"] as const)[phase === "result" || phase === "reroute" ? 3 : (["learn", "retrieve", "apply", "evaluate"] as const).indexOf(phase)]}
          />
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {phase === "reroute" ? (
          <motion.section
            ref={focusStep}
            tabIndex={-1}
            key="reroute"
            className="reroute-view is-page study-reroute-moment"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.18, ease: kelusEase }}
            aria-live="polite"
          >
            <motion.p
              className="study-mark-kicker"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.35, delay: reduceMotion ? 0 : 0.04, ease: kelusEase }}
            >
              Route
            </motion.p>
            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.55, delay: 0.06 }}
            >
              Updated.
            </motion.h1>
            <motion.p
              className="study-reroute-lede"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.5, delay: 0.1 }}
            >
              {routeOrderChanged ? "The remaining topic order changed." : "The topic order stayed; the time plan changed."} {nextConceptName ? `${nextConceptName} is next.` : "You have reached the end of this session."}
            </motion.p>
            {nextConceptName ? (
              <motion.p
                className="study-reroute-moved"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduceMotion ? 0.1 : 0.4, delay: reduceMotion ? 0 : 0.14, ease: kelusEase }}
              >
                Next up{" "}
                <strong>
                  {nextConceptName}
                </strong>
              </motion.p>
            ) : null}
            {routeOrderChanged ? (
              <RouteShift
                before={previousRemaining.map((id) => ({ id, name: state.snapshot.concepts.find((item) => item.id === id)?.name ?? "Topic" }))}
                after={nextRemaining.map((id) => ({ id, name: state.snapshot.concepts.find((item) => item.id === id)?.name ?? "Topic" }))}
              />
            ) : null}
            {minuteChanges.length ? <MinuteShift changes={minuteChanges.slice(0, 3)} /> : null}
            <p className="reroute-whisper" aria-label="How this answer changed your plan">{evaluation?.label ?? "New evidence"} · {routeOrderChanged ? "Order updated" : "Time updated"}</p>
            <motion.button
              type="button"
              className="cta"
              onClick={continueAfterReroute}
              transition={{ type: "spring", bounce: 0, duration: 0.28 }}
            >
              Continue <ArrowRight />
            </motion.button>
          </motion.section>
        ) : phase === "result" ? (
          <motion.section
            ref={focusStep}
            tabIndex={-1}
            key={`${concept.id}-result`}
            className="study-question is-page study-mark-moment"
            // The next screen is there the frame after the click: no exit to wait for, a short settle from almost visible.
            initial={reduceMotion ? false : { opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.18, ease: kelusEase }}
          >
            <p className="study-count sr-only" aria-live="polite">Marked</p>
            {lastOutcome && !quickMode ? <MarkStamp outcome={lastOutcome} /> : null}
            {quickMode && lastOutcome ? (
              <QuickResult
                outcome={lastOutcome}
                conceptId={concept.id}
                topic={concept.name}
                attempts={checkCount}
                stats={quickStats}
                // The definition was just compared on the screen before, so end on something else: the line that was
                // missed, or a line from the page that this run did not use.
                remember={quickMissed[0] ?? run?.extraFact ?? activity.retrieve.modelAnswer}
                rememberLabel={quickMissed[0] ? (quickMissed.length > 1 ? uiw.missedSome : uiw.missedOne) : run?.extraFact ? uiw.oneMore : uiw.worth}
                locator={currentSource?.locator ?? "your notes"}
                goalDone={goalToday.topicsToday}
                goal={goalToday.goal}
                habit={{ today: dayKey(new Date(Date.parse(state.nowIso))), streak: goalToday.streak, week: goalToday.week, backTomorrow: goalToday.backTomorrow }}
                comesBack={comesBackLine(concept.nextReviewAt, state.nowIso)}
                routeLine={planLine({ next: nextConceptName, movedUp: movedUpName, orderChanged: routeOrderChanged })}
                routeReason={routeReason}
                nextName={nextConceptName}
                path={{
                  practised: state.snapshot.concepts.filter((item) => item.courseId === concept.courseId && item.retrievalAttempts > 0).length,
                  total: courseConceptIds.size,
                  here: state.snapshot.concepts.filter((item) => item.courseId === concept.courseId).findIndex((item) => item.id === concept.id),
                  done: state.snapshot.concepts.filter((item) => item.courseId === concept.courseId).map((item) => item.retrievalAttempts > 0),
                  recalled: knownCount(knownLines, courseConceptIds),
                }}
                onRetry={retryCurrentConcept}
                onContinue={advance}
                onSource={currentSource && currentMaterial ? showCurrentEvidence : undefined}
                details={(
                  <div className="session-value-proof" aria-label="What changed in your plan">
                    <div>
                      <span>{concept.name}</span>
                      <strong>{comesBackLine(concept.nextReviewAt, state.nowIso)}</strong>
                    </div>
                    {movedUpName ? <div><span>Moved up</span><strong>{movedUpName}</strong></div> : null}
                    {minuteChanges.length ? <div><span>Time adjusted</span><strong>{minuteChanges.slice(0, 2).map((change) => `${change.name} ${change.before} → ${change.after} min`).join(" · ")}</strong></div> : null}
                  </div>
                )}
              />
            ) : (
              <>
            <motion.p
              className="study-mark-kicker"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.35, delay: reduceMotion ? 0 : 0.04, ease: kelusEase }}
            >
              Mark
            </motion.p>
            <motion.h1
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.55, delay: 0.06 }}
            >
              {lastOutcome === "success" ? "Solid pass." : lastOutcome === "partial" ? "Partly there." : "Needs another attempt."}
            </motion.h1>
            <motion.p
              className="study-mark-summary"
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.5, delay: 0.12 }}
            >
              {concept.name} · {checkCount === 1 ? "first check" : `${checkCount} checks`}
            </motion.p>
            <motion.p
              className="study-mark-whisper"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.4, delay: reduceMotion ? 0 : 0.18, ease: kelusEase }}
            >
              {lastOutcome === "success" ? "You used the idea in your own words." : `Return to the source idea: ${activity.retrieve.modelAnswer}`}
            </motion.p>
            <p className="study-reroute-lede" role="status">
              {routeOrderChanged ? "The remaining topic order changed. " : minuteChanges.length ? "The topic order stayed, but the time plan changed. " : "The rest of your plan is unchanged. "}
              {nextConceptName ? `${nextConceptName} is next.` : "This is the last topic in this session."}
            </p>
            <div className="session-value-proof" aria-label="What changed in this session">
              <div>
                <span>This check</span>
                <strong>{evaluation?.label ?? (lastOutcome === "failure" ? "Needs another pass" : "Partial evidence")}</strong>
              </div>
              <div>
                <span>Your next choice</span>
                <strong>{lastOutcome === "success" ? `Continue${nextConceptName ? ` to ${nextConceptName}` : " to your summary"}.` : `Try ${concept.name} again now, or continue${nextConceptName ? ` to ${nextConceptName}` : " to your summary"}.`}</strong>
              </div>
              {minuteChanges.length ? <div><span>Time adjusted</span><strong>{minuteChanges.slice(0, 2).map((change) => `${change.name} ${change.before} → ${change.after} min`).join(" · ")}</strong></div> : null}
            </div>
            {quickMode ? null : <PracticeDrill key={concept.id} items={activity.practice ?? []} />}
            {currentSource && currentMaterial ? (
              <button
                type="button"
                className="text-btn session-source-return"
                onClick={() => void openSource(currentSource.materialId, currentSource.locator)}
              >
                Review the source behind this topic <ArrowOut />
              </button>
            ) : null}
            <div className="study-result-actions">
              {lastOutcome !== "success" ? <motion.button type="button" className="cta" onClick={retryCurrentConcept} transition={{ type: "spring", bounce: 0, duration: 0.28 }}>Try again <span aria-hidden="true">↻</span></motion.button> : null}
              <button type="button" className={lastOutcome === "success" ? "cta" : "text-btn"} onClick={advance}>{nextConceptName ? `Continue to ${nextConceptName}` : "Finish session"} <ArrowRight /></button>
            </div>
              </>
            )}
          </motion.section>
        ) : (
          <motion.section
            ref={focusStep}
            tabIndex={-1}
            key={`${concept.id}-${phase}`}
            className="study-question is-page"
            initial={reduceMotion ? false : { opacity: 0.6, y: 4 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, transition: { duration: 0 } }}
            transition={{ duration: 0.18, ease: kelusEase }}
          >
            <p className="study-count sr-only" aria-live="polite">{PHASE_LABEL[phase as "learn" | "retrieve" | "apply" | "evaluate"]}</p>

            {phase === "learn" && quickMode && run ? (
              <QuickRun
                key={`${auth.user?.id ?? "guest"}-${session.id}-${concept.id}-${runKey}`}
                run={run}
                persistenceKey={studyDraftKey(auth.user?.id ?? null, session.id, concept.id)}
                onPersistenceChange={setDraftSaved}
                courseType={session?.courseId === "course-microeconomics" ? "sample" : "real"}
                onRevealSource={() => setSourceRevealed(true)}
                sourceReferences={activity.sourceReferences}
                onShowLine={(quote, reference) => {
                  setEvidenceSourceOverride({ conceptId: concept.id, reference });
                  setMarkedLine(quote);
                  setSourceRevealed(true);
                  const sourceMaterial = materials.find((material) => material.id === reference.materialId)
                    ?? (reference.materialId === "demo-syllabus-microeconomics" ? materials.find((material) => material.id === "material-demo-microeconomics") : null);
                  if (sourceMaterial?.storage === "local" && !sourceMaterial.id.startsWith("material-demo-")) {
                    setSourceJump((current) => current + 1);
                    setNotesOpen(true);
                  } else {
                    void openSource(reference.materialId, reference.locator);
                  }
                }}
                onFinish={finishQuick}
                // The first session teaches the source-to-question connection before recall.
                // Later topics begin with a check and keep their source one tap away.
                readFirst={firstStudySession && index === 0}
                firstStudySession={firstStudySession && index === 0}
                known={knownAtOpen.set}
                recalled={knownAtOpen.count}
                // A topic Kelus misnamed is renamed right here, the way the course is: tap the name (⌘Z undoes it).
                context={<p className="study-topic-kicker"><b><InlineName value={concept.name} onSave={(next) => renameTopic(concept.id, next)} label="Rename this topic" /></b>{total > 1 ? <span>{uiw.topicOf(index + 1, total)}</span> : null}</p>}
              />
            ) : null}

            {phase === "learn" && !quickMode ? (
              <div className="session-learn">
                <h1>{activity.learn.title}</h1>
                <p className="session-explanation">{activity.learn.explanation}</p>
                {activity.teach?.aiExplanation ? <p className="session-ai-explanation"><span>In plain words</span>{activity.teach.aiExplanation}</p> : null}
                <ul>{activity.learn.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul>
                {activity.sourceReferences.length ? (
                  <div className="session-sources" aria-label="Course sources">
                    <span>Source</span>
                    {activity.sourceReferences.map((reference) => {
                      const locator = reference.locator?.trim();
                      const showLocator = locator && !/not your upload|demo/i.test(locator);
                      return (
                      <button key={`${reference.materialId}-${reference.locator}`} type="button" disabled={openingSource} onClick={() => void openSource(reference.materialId, reference.locator)}>
                        {reference.label}{showLocator ? ` · ${locator}` : ""} <ArrowOut />
                      </button>
                      );
                    })}
                  </div>
                ) : null}
                {openingSource ? <p role="status" className="session-source-note">Opening your source…</p> : null}
                <motion.button
                  type="button"
                  className="cta"
                  onClick={() => { setPhase("retrieve"); startedAt.current = performance.now(); }}
                  transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                >
                  Retrieve it <ArrowRight />
                </motion.button>
              </div>
            ) : null}

            {phase === "retrieve" ? (
              <div className="session-work is-retrieve">
                <p className="study-mark-kicker">Retrieve</p>
                <h1>{activity.retrieve.prompt}</h1>
                <label className="session-work-lede" htmlFor="retrieve-answer">
                  Close the page. Write it in your own words.
                </label>
                <textarea
                  id="retrieve-answer"
                  className="session-work-field"
                  autoFocus
                  value={retrieveAnswer}
                  onChange={(event) => setRetrieveAnswer(event.target.value)}
                  placeholder="From memory…"
                  rows={6}
                />
                <details
                  className="session-help-page"
                  open={helpMode ? true : undefined}
                  onToggle={(event) => {
                    if (!(event.target as HTMLDetailsElement).open) setHelpMode(null);
                  }}
                >
                  <summary>Need a hint?</summary>
                  <div className="session-help-choices" role="group" aria-label="Help options">
                    <button type="button" className={helpMode === "hint" ? "is-active" : undefined} onClick={() => setHelpMode(helpMode === "hint" ? null : "hint")}>Hint</button>
                    <button type="button" className={helpMode === "explain" ? "is-active" : undefined} onClick={() => setHelpMode(helpMode === "explain" ? null : "explain")}>Explain</button>
                  </div>
                  <AnimatePresence mode="wait">{helpCopy ? <motion.p key={helpMode} initial={{ opacity: 0, y: reduceMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>{helpCopy}</motion.p> : null}</AnimatePresence>
                </details>
                <div className="session-work-actions">
                  <motion.button
                    type="button"
                    className="cta"
                    disabled={!retrieveAnswer.trim()}
                    onClick={() => { setHelpMode(null); setPhase("apply"); }}
                    transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                  >
                    Continue <ArrowRight />
                  </motion.button>
                  <button type="button" className="text-btn study-back" onClick={() => { setHelpMode(null); setPhase("learn"); }}>
                    Back
                  </button>
                </div>
              </div>
            ) : null}

            {phase === "apply" ? (
              <div className="session-work is-apply">
                <p className="study-mark-kicker">Use</p>
                <h1>{activity.apply.prompt}</h1>
                <label className="session-work-lede" htmlFor="application-answer">
                  Use the idea to explain this question.
                </label>
                <textarea
                  id="application-answer"
                  className="session-work-field"
                  autoFocus
                  value={applicationAnswer}
                  onChange={(event) => setApplicationAnswer(event.target.value)}
                  placeholder="Work the new case…"
                  rows={6}
                />
                <details className="session-help-page" open={helpMode === "hint" || undefined}>
                  <summary>Need a hint?</summary>
                  <p>{activity.apply.hint}</p>
                </details>
                <div className="session-work-actions">
                  <motion.button
                    type="button"
                    className="cta"
                    disabled={!applicationAnswer.trim()}
                    onClick={checkAnswers}
                    transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                  >
                    Check my thinking <ArrowRight />
                  </motion.button>
                  <button type="button" className="text-btn study-back" onClick={() => { setHelpMode(null); setPhase("retrieve"); }}>
                    Back
                  </button>
                </div>
              </div>
            ) : null}

            {phase === "evaluate" ? (
              <div className="study-feedback is-page is-mark-folio">
                <h1>Mark.</h1>
                <p className="study-mark-lede">Set your answers beside the model, then record what stuck.</p>
                {currentSource && currentMaterial ? <button type="button" className="text-btn session-source-compare" onClick={() => void openSource(currentSource.materialId, currentSource.locator)}>View original page · {currentSource.locator ?? "source"} <ArrowOut /></button> : null}
                {evaluation ? (
                  <motion.div
                    className={`answer-evaluation is-page is-${evaluation.outcome}`}
                    role="status"
                    initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: 0.5, ease: kelusEase }}
                  >
                    <h2>{evaluation.evidenceStatus === "contradicted" ? "Check the relationship" : evaluation.label}</h2>
                    <p>{evaluation.explanation}</p>
                    {evaluation.criteria.length ? (
                      <ul className="answer-criteria" aria-label="Assessment criteria">
                        {evaluation.criteria.map((criterion, criterionIndex) => (
                          <motion.li
                            key={criterion.id}
                            className={criterion.met ? "is-met" : "is-missing"}
                            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.3, delay: 0.75 + criterionIndex * 0.14, ease: kelusEase }}
                          >
                            <span aria-hidden="true">{criterion.met ? "✓" : "○"}</span>{criterion.label}
                          </motion.li>
                        ))}
                      </ul>
                    ) : null}
                    <p className="assessment-boundary"><strong>{evaluation.evidenceStatus === "incomplete" ? "What Kelus cannot confirm yet" : "What Kelus checked"}</strong> {evaluation.reviewNote}</p>
                    <small>Compared with the source · not a grade</small>
                    <div className="study-ratings" role="group" aria-label="Record answer evidence">
                      <motion.button
                        type="button"
                        className="is-primary"
                        onClick={() => grade(evaluation.outcome)}
                        transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                      >
                        Mark this
                      </motion.button>
                      {evaluation.outcome === "success" ? (
                        <button type="button" className="is-outline" onClick={() => grade("partial")}>
                          I needed more help
                        </button>
                      ) : null}
                      {evaluation.outcome !== "failure" ? (
                        <button type="button" className="is-ghost" onClick={() => grade("failure")}>
                          I did not understand it
                        </button>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
                <div className="answer-pages" aria-label="Compare your answers">
                  <section>
                    <span>Your retrieval</span>
                    <p>{retrieveAnswer}</p>
                  </section>
                  <section>
                    <span>Key idea</span>
                    <p>{activity.retrieve.modelAnswer}</p>
                  </section>
                  <section>
                    <span>Your application</span>
                    <p>{applicationAnswer}</p>
                  </section>
                  <section>
                    <span>A sound application</span>
                    <p>{activity.apply.modelAnswer}</p>
                  </section>
                </div>
              </div>
            ) : null}
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {sourcePanel ? (
          <motion.aside
            key={`${sourcePanel.title}-${sourcePanel.locator}`}
            className="session-source-panel"
            role="dialog"
            aria-modal="false"
            aria-label={`Course source: ${sourcePanel.title}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
            transition={{ duration: reduceMotion ? kelusDuration.micro : kelusDuration.moderate, ease: kelusEase }}
          >
            <header>
              <div><span>{sourcePanel.reason === "built_in" ? "Built-in example" : "From your course"}</span><strong>{sourcePanel.title}</strong>{sourcePanel.locator && sourcePanel.reason !== "built_in" ? <small>{sourcePanel.locator}</small> : null}</div>
              <button ref={sourceCloseRef} type="button" onClick={closeSource} aria-label="Close course source">Close</button>
            </header>
            {sourcePanel.kind === "notes" && sourcePanel.section ? <div className="session-source-notes"><NotesSection page={sourcePanel.section} title={sourcePanel.title} /></div> : null}
            {sourcePanel.kind === "pdf" && sourcePanel.href ? <iframe title={`${sourcePanel.title} ${sourcePanel.locator ?? ""}`} src={sourcePanel.href} /> : null}
            {sourcePanel.kind === "link" && sourcePanel.href ? (
              <div className="session-source-link">
                <p>This source is saved as a web link. Open it when you need the original context; your session stays here.</p>
                <a href={sourcePanel.href} target="_blank" rel="noreferrer">Open original source <ArrowOut /></a>
              </div>
            ) : null}
            {sourcePanel.kind === "unavailable" ? (
              <div className="session-source-link">
                <p>
                  {sourcePanel.reason === "built_in"
                    ? "This is a practice example, not a document you uploaded. Add your own PDF in Materials to study with page references."
                    : sourcePanel.reason === "read_failed"
                    ? "Kelus could not open this PDF just now. Your session stays here — add the file again from Materials, then reopen the source."
                    : "The reference is part of your learning activity, but the original file is not available on this device."}
                </p>
                <button type="button" onClick={() => router.push("/materials")}>{sourcePanel.reason === "built_in" ? "Add your own material" : "Add the PDF again"} <ArrowRight /></button>
              </div>
            ) : null}
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<main id="main" className="study-shell"><p>Opening your plan…</p></main>}>
      <SessionBody />
    </Suspense>
  );
}
