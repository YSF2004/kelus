"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  finishSession,
  completeDiagnosis as persistDiagnosis,
  completeOnboarding,
  confirmMaterialConcepts,
  getDemoSnapshot,
  getServerDemoSnapshot,
  recordRetrieval,
  removeMaterialLearning,
  loadAminaDemo,
  resetDemoState,
  replaceDemoState,
  shiftDemoDay,
  startSession,
  stateForAuthenticatedUser,
  subscribeDemoState,
  type DemoState,
} from "@/lib/demo-store";
import type { AnswerEvaluation, Concept, ProposedConcept, RetrievalOutcome, SelfRating } from "@/domain/types";
import type { SetupInput } from "@/lib/setup";
import { readLearnerState, writeLearnerState } from "@/lib/learner-sync";
import { synchronizeCourseMaterials } from "@/lib/material-sync";
import { trackProductEvent } from "@/lib/product-analytics";

type Store = {
  state: DemoState;
  start: (courseId: string, examId: string) => string;
  submit: (input: {
    conceptId: string;
    sessionId: string;
    promptId: string;
    responseText: string;
    outcome: RetrievalOutcome;
    evaluation?: AnswerEvaluation | null;
    responseTimeMs?: number | null;
    answerRevealed?: boolean;
    finish?: { before: Concept[] };
  }) => void;
  reset: () => void;
  skipDay: () => void;
  completeSetup: (input: SetupInput) => void;
  completeDiagnosis: (input: {
    ratings: Record<string, SelfRating>;
    retrievals: Array<{ conceptId: string; promptId: string; responseText: string; outcome: RetrievalOutcome; responseTimeMs: number; evaluation?: AnswerEvaluation | null }>;
  }) => void;
  useDemo: () => void;
  confirmConcepts: (proposals: ProposedConcept[]) => void;
  removeMaterialSource: (materialId: string) => void;
};

const StoreContext = createContext<Store | null>(null);

export function LearnerProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const state = useSyncExternalStore(subscribeDemoState, getDemoSnapshot, getServerDemoSnapshot);
  const syncedUser = useRef<string | null>(null);
  const lastWritten = useRef("");
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const userId = auth.user?.id;
    if (!userId) {
      syncedUser.current = null;
      lastWritten.current = "";
      return () => { active = false; };
    }
    syncedUser.current = null;
    queueMicrotask(() => { if (active) setSyncMessage("Syncing your learning route…"); });
    readLearnerState(userId).then((remote) => {
      if (!active) return;
      if (remote) {
        const claimed = stateForAuthenticatedUser(remote, userId);
        replaceDemoState(claimed);
        lastWritten.current = JSON.stringify(claimed);
        void Promise.allSettled(claimed.snapshot.courses.map((course) => synchronizeCourseMaterials(userId, course.id)));
      } else {
        const claimed = stateForAuthenticatedUser(state, userId);
        replaceDemoState(claimed);
        lastWritten.current = JSON.stringify(claimed);
        void writeLearnerState(userId, claimed).catch(() => setSyncMessage("Saved on this device. Cloud sync will retry."));
        void Promise.allSettled(claimed.snapshot.courses.map((course) => synchronizeCourseMaterials(userId, course.id)));
      }
      syncedUser.current = userId;
      setSyncMessage(null);
    }).catch(() => {
      if (!active) return;
      syncedUser.current = userId;
      setSyncMessage("Saved on this device. Cloud sync is unavailable.");
    });
    return () => { active = false; };
    // Load once when the authenticated account changes; live state writes are
    // handled by the separate debounced effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  useEffect(() => {
    const userId = auth.user?.id;
    if (!userId || syncedUser.current !== userId) return;
    const claimed = stateForAuthenticatedUser(state, userId);
    const serialized = JSON.stringify(claimed);
    if (serialized === lastWritten.current) return;
    const timeout = window.setTimeout(() => {
      writeLearnerState(userId, claimed).then(() => {
        lastWritten.current = serialized;
        setSyncMessage(null);
      }).catch(() => setSyncMessage("Saved on this device. Cloud sync will retry."));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [auth.user?.id, state]);
  const store = useMemo<Store>(() => ({
    state,
    start(courseId, examId) {
      const { session } = startSession(state, courseId, examId);
      const completed = state.snapshot.sessions.filter((item) => item.status === "complete");
      const lastCompleted = completed.map((item) => item.endedAt).filter((value): value is string => Boolean(value)).sort().at(-1);
      const daysSincePrevious = lastCompleted
        ? Math.max(0, Math.floor((Date.parse(state.nowIso) - Date.parse(lastCompleted)) / 86_400_000))
        : null;
      trackProductEvent("session_started", {
        course_id: courseId,
        planned_minutes: session.plannedMinutes,
        concept_count: session.plannedConceptIds.length,
        completed_session_count: completed.length,
        days_since_previous_session: daysSincePrevious,
      }, auth.user?.id);
      return session.id;
    },
    submit(input) {
      const next = recordRetrieval(state, input);
      const previousSession = state.snapshot.sessions.find((item) => item.id === input.sessionId);
      const updatedSession = next.snapshot.sessions.find((item) => item.id === input.sessionId);
      const routeChanged = (updatedSession?.routeChanges.length ?? 0) > (previousSession?.routeChanges.length ?? 0);
      trackProductEvent("answer_evaluated", {
        session_id: input.sessionId,
        concept_id: input.conceptId,
        outcome: input.evaluation?.outcome ?? input.outcome,
        score: input.evaluation?.score ?? null,
        assistance_used: Boolean(input.answerRevealed),
      }, auth.user?.id);
      trackProductEvent("route_recalculated", {
        session_id: input.sessionId,
        concept_id: input.conceptId,
        materially_reordered: routeChanged,
      }, auth.user?.id);
      if (input.finish) {
        const completed = finishSession(next, input.sessionId, input.finish.before);
        const summary = completed.snapshot.sessions.find((item) => item.id === input.sessionId)?.summary;
        trackProductEvent("session_completed", {
          session_id: input.sessionId,
          planned_minutes: previousSession?.plannedMinutes ?? null,
          route_change_count: updatedSession?.routeChanges.length ?? 0,
          readiness_before: summary?.readinessBefore ?? null,
          readiness_after: summary?.readinessAfter ?? null,
        }, auth.user?.id);
      }
    },
    reset() {
      resetDemoState();
    },
    skipDay() {
      if (process.env.NODE_ENV !== "development") return;
      shiftDemoDay(state, 1);
    },
    completeSetup(input) {
      completeOnboarding(input);
      trackProductEvent("setup_completed", {
        days_until_exam: Math.max(0, Math.ceil((Date.parse(input.examDate) - Date.now()) / 86_400_000)),
        target_percent: input.targetPercent,
        available_minutes: input.availableMinutes,
      }, auth.user?.id);
    },
    completeDiagnosis(input) {
      persistDiagnosis(state, input);
      trackProductEvent("diagnosis_completed", {
        rated_concept_count: Object.keys(input.ratings).length,
        retrieval_check_count: input.retrievals.length,
      }, auth.user?.id);
    },
    useDemo() {
      loadAminaDemo();
    },
    confirmConcepts(proposals) {
      confirmMaterialConcepts(state, proposals);
      trackProductEvent("material_map_confirmed", {
        concept_count: proposals.length,
        material_count: new Set(proposals.map((item) => item.materialId)).size,
        relationship_ready: proposals.length > 1,
      }, auth.user?.id);
    },
    removeMaterialSource(materialId) {
      removeMaterialLearning(state, materialId);
    },
  }), [auth.user?.id, state]);
  return <StoreContext.Provider value={store}>{auth.user && syncMessage ? <p className="learner-sync-status" role="status">{syncMessage}</p> : null}{children}</StoreContext.Provider>;
}

export function useLearner() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("LearnerProvider missing");
  return value;
}
