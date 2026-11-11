import { createDemoSnapshot } from "../data/demo-seed";
import { ALGORITHM_KIND, SELF_RATING_MASTERY } from "../domain/constants";
import { advanceDemoClock, isDemoClockEnabled } from "../domain/demo-clock";
import { recomputeConceptCache, withCachedState } from "../domain/learner-model";
import { generateRoute } from "../domain/routing-engine";
import { estimatedReadiness } from "../domain/readiness";
import { recalculateSessionRoute } from "../domain/session-engine";
import { buildConfirmedMaterialModel } from "../domain/material-intelligence";
import { createRetrievalEvent, sessionSummary } from "../domain/session";
import type { AnswerEvaluation, Concept, LearnerSnapshot, LearningEvent, ProposedConcept, RetrievalOutcome, SelfRating, StudySession } from "../domain/types";
import { createLearnerSnapshot, type SetupInput } from "./setup";

const STORAGE_KEY = "kelus-learning-state-v2";
const SERVER_NOW_MS = Date.parse("2026-09-05T12:00:00.000Z");

export type DemoState = {
  snapshot: LearnerSnapshot;
  nowIso: string;
  onboardingCompleted: boolean;
  diagnosisCompleted: boolean;
};

function refreshCaches(snapshot: LearnerSnapshot, nowIso: string): LearnerSnapshot {
  return {
    ...snapshot,
    learningActivities: snapshot.learningActivities ?? [],
    concepts: snapshot.concepts.map((concept) => withCachedState(concept, recomputeConceptCache(concept, snapshot.events, nowIso))),
  };
}

export function initialDemoState(nowMs = Date.now()): DemoState {
  const snapshot = createDemoSnapshot(nowMs);
  const nowIso = new Date(nowMs).toISOString();
  return { snapshot: refreshCaches(snapshot, nowIso), nowIso, onboardingCompleted: false, diagnosisCompleted: false };
}

const SERVER_SNAPSHOT = initialDemoState(SERVER_NOW_MS);

export function validStoredState(value: unknown): value is DemoState {
  const state = value as DemoState;
  return Boolean(
    Array.isArray(state?.snapshot?.concepts)
    && Array.isArray(state.snapshot.courses)
    && Array.isArray(state.snapshot.exams)
    && state.snapshot.exams?.[0]?.targetPercent
    && state.snapshot.concepts.every((concept) => typeof concept.examImportance === "number"),
  );
}

export function stateForAuthenticatedUser(state: DemoState, userId: string): DemoState {
  return {
    ...state,
    snapshot: {
      ...state.snapshot,
      profile: { ...state.snapshot.profile, id: userId },
      courses: state.snapshot.courses.map((course) => ({ ...course, userId })),
      exams: state.snapshot.exams.map((exam) => ({ ...exam, userId })),
      concepts: state.snapshot.concepts.map((concept) => ({ ...concept, userId })),
      events: state.snapshot.events.map((event) => ({ ...event, userId })),
      sessions: state.snapshot.sessions.map((session) => ({ ...session, userId })),
    },
  };
}

export function replaceDemoState(value: unknown) {
  if (!validStoredState(value)) throw new Error("The saved learner state is not compatible with this version of Kelus.");
  const state = { ...value, snapshot: refreshCaches(value.snapshot, value.nowIso) };
  persistDemoState(state);
  return state;
}

export function readStoredDemoState(): DemoState | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!validStoredState(parsed)) return null;
    return { ...parsed, snapshot: refreshCaches(parsed.snapshot, parsed.nowIso) };
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let clientCache: DemoState | null = null;
const emit = () => listeners.forEach((listener) => listener());

function persistDemoState(state: DemoState) {
  clientCache = state;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  emit();
}

export function subscribeDemoState(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDemoSnapshot() {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;
  if (!clientCache) clientCache = readStoredDemoState() ?? SERVER_SNAPSHOT;
  return clientCache;
}

export const getServerDemoSnapshot = () => SERVER_SNAPSHOT;

export function resetDemoState(nowMs = Date.now()) {
  const state = initialDemoState(nowMs);
  persistDemoState(state);
  return state;
}

export function loadAminaDemo(nowMs = Date.now()) {
  const nowIso = new Date(nowMs).toISOString();
  const state: DemoState = {
    snapshot: refreshCaches(createDemoSnapshot(nowMs), nowIso),
    nowIso,
    onboardingCompleted: true,
    diagnosisCompleted: true,
  };
  persistDemoState(state);
  return state;
}

export function completeOnboarding(input: SetupInput, nowMs = Date.now()) {
  const nowIso = new Date(nowMs).toISOString();
  const state: DemoState = {
    snapshot: createLearnerSnapshot(input, nowMs),
    nowIso,
    onboardingCompleted: true,
    diagnosisCompleted: false,
  };
  persistDemoState(state);
  return state;
}

export function completeDiagnosis(state: DemoState, input: {
  ratings: Record<string, SelfRating>;
  retrievals: Array<{ conceptId: string; promptId: string; responseText: string; outcome: RetrievalOutcome; responseTimeMs: number; evaluation?: AnswerEvaluation | null }>;
}) {
  const userId = state.snapshot.profile.id;
  const ratingEvents: LearningEvent[] = Object.entries(input.ratings).flatMap(([conceptId, rating]) => {
    const concept = state.snapshot.concepts.find((item) => item.id === conceptId);
    if (!concept) return [];
    const mastery = SELF_RATING_MASTERY[rating];
    return [{
      id: `diagnosis-rating-${concept.id}`,
      userId,
      conceptId: concept.id,
      sessionId: null,
      kind: "self_rating",
      outcome: null,
      selfRating: rating,
      assistance: "none",
      responseTimeMs: null,
      promptId: null,
      responseText: null,
      masteryBefore: 0,
      masteryAfter: mastery,
      createdAt: state.nowIso,
    }];
  });
  let snapshot = refreshCaches({ ...state.snapshot, events: ratingEvents }, state.nowIso);
  const retrievalEvents: LearningEvent[] = [];
  for (const retrieval of input.retrievals) {
    const concept = snapshot.concepts.find((item) => item.id === retrieval.conceptId);
    if (!concept) continue;
    const event = createRetrievalEvent({
      id: `diagnosis-retrieval-${retrieval.conceptId}`,
      userId,
      concept,
      sessionId: "diagnosis",
      promptId: retrieval.promptId,
      responseText: retrieval.responseText,
      evaluation: retrieval.evaluation,
      outcome: retrieval.outcome,
      responseTimeMs: retrieval.responseTimeMs,
      createdAt: state.nowIso,
    });
    retrievalEvents.push(event);
    snapshot = refreshCaches({ ...snapshot, events: [...snapshot.events, event] }, state.nowIso);
  }
  const next = { ...state, snapshot, diagnosisCompleted: true };
  persistDemoState(next);
  return next;
}

export function confirmMaterialConcepts(state: DemoState, proposals: ProposedConcept[]) {
  if (!proposals.length) throw new Error("Keep at least one concept before building the map.");
  const course = state.snapshot.courses[0];
  if (!course) throw new Error("Set a destination before confirming concepts.");
  const model = buildConfirmedMaterialModel({
    proposals,
    courseId: course.id,
    userId: state.snapshot.profile.id,
    nowIso: state.nowIso,
  });
  const materialIds = new Set(proposals.map((proposal) => proposal.materialId));
  const activitiesWithoutReplacedSources = state.snapshot.learningActivities.map((activity) => ({
    ...activity,
    sourceReferences: activity.sourceReferences.filter((reference) => !materialIds.has(reference.materialId)),
  }));
  const replacedIds = new Set(state.snapshot.learningActivities
    .filter((activity, index) => activity.sourceReferences.some((reference) => materialIds.has(reference.materialId))
      && activitiesWithoutReplacedSources[index].sourceReferences.length === 0)
    .map((activity) => activity.conceptId));
  const retainedConcepts = state.snapshot.concepts.filter((concept) => !replacedIds.has(concept.id));
  const retainedIds = new Set(retainedConcepts.map((concept) => concept.id));
  const newConcepts = model.concepts.filter((concept) => !retainedIds.has(concept.id));
  const retainedActivities = activitiesWithoutReplacedSources.filter((activity) => !replacedIds.has(activity.conceptId));
  const mergedActivities = retainedActivities.map((activity) => {
    const incoming = model.learningActivities.find((candidate) => candidate.conceptId === activity.conceptId);
    if (!incoming) return activity;
    const references = [...activity.sourceReferences];
    for (const reference of incoming.sourceReferences) {
      if (!references.some((item) => item.materialId === reference.materialId && item.locator === reference.locator)) references.push(reference);
    }
    return { ...activity, sourceReferences: references };
  });
  const retainedRelationships = state.snapshot.relationships.filter((relationship) => !replacedIds.has(relationship.fromId) && !replacedIds.has(relationship.toId));
  const relationships = [...retainedRelationships, ...model.relationships].filter((relationship, index, items) => items.findIndex((item) => item.id === relationship.id) === index);
  const snapshot: LearnerSnapshot = {
    ...state.snapshot,
    concepts: [...retainedConcepts, ...newConcepts],
    relationships,
    prompts: [...state.snapshot.prompts.filter((prompt) => !replacedIds.has(prompt.conceptId)), ...model.prompts.filter((prompt) => !retainedIds.has(prompt.conceptId))],
    learningActivities: [...mergedActivities, ...model.learningActivities.filter((activity) => !retainedIds.has(activity.conceptId))],
    events: state.snapshot.events.filter((event) => !replacedIds.has(event.conceptId)),
    sessions: state.snapshot.sessions.filter((session) => !session.plannedConceptIds.some((conceptId) => replacedIds.has(conceptId))),
  };
  const next = { ...state, snapshot, diagnosisCompleted: false };
  persistDemoState(next);
  return next;
}

export function removeMaterialLearning(state: DemoState, materialId: string) {
  const activities = state.snapshot.learningActivities.map((activity) => ({
    ...activity,
    sourceReferences: activity.sourceReferences.filter((reference) => reference.materialId !== materialId),
  }));
  const removedIds = new Set(activities
    .filter((activity) => {
      const previous = state.snapshot.learningActivities.find((item) => item.id === activity.id);
      return previous?.sourceReferences.some((reference) => reference.materialId === materialId) && activity.sourceReferences.length === 0;
    })
    .map((activity) => activity.conceptId));
  if (!removedIds.size && activities.every((activity, index) => activity.sourceReferences.length === state.snapshot.learningActivities[index]?.sourceReferences.length)) return state;
  const concepts = state.snapshot.concepts.filter((concept) => !removedIds.has(concept.id));
  const snapshot: LearnerSnapshot = {
    ...state.snapshot,
    concepts,
    relationships: state.snapshot.relationships.filter((relationship) => !removedIds.has(relationship.fromId) && !removedIds.has(relationship.toId)),
    prompts: state.snapshot.prompts.filter((prompt) => !removedIds.has(prompt.conceptId)),
    learningActivities: activities.filter((activity) => !removedIds.has(activity.conceptId)),
    events: state.snapshot.events.filter((event) => !removedIds.has(event.conceptId)),
    sessions: state.snapshot.sessions.filter((session) => !session.plannedConceptIds.some((conceptId) => removedIds.has(conceptId))),
  };
  const next = {
    ...state,
    snapshot,
    diagnosisCompleted: state.diagnosisCompleted && concepts.length > 0,
  };
  persistDemoState(next);
  return next;
}

export function recordRetrieval(state: DemoState, input: {
  conceptId: string;
  sessionId: string;
  promptId: string;
  responseText: string;
  outcome: RetrievalOutcome;
  evaluation?: AnswerEvaluation | null;
  responseTimeMs?: number | null;
  answerRevealed?: boolean;
}) {
  const concept = state.snapshot.concepts.find((item) => item.id === input.conceptId);
  const session = state.snapshot.sessions.find((item) => item.id === input.sessionId);
  if (!concept || !session) return state;
  const event = createRetrievalEvent({
    id: `evt-${crypto.randomUUID()}`,
    userId: state.snapshot.profile.id,
    concept,
    sessionId: input.sessionId,
    promptId: input.promptId,
    responseText: input.responseText,
    outcome: input.outcome,
    evaluation: input.evaluation,
    responseTimeMs: input.responseTimeMs,
    answerRevealed: input.answerRevealed,
    createdAt: state.nowIso,
  });
  let snapshot = refreshCaches({ ...state.snapshot, events: [...state.snapshot.events, event] }, state.nowIso);
  const recalculated = recalculateSessionRoute({ snapshot, session, previousRoute: session.latestRoute, nowIso: state.nowIso });
  const movedConcept = recalculated.change?.movedConceptId
    ? snapshot.concepts.find((item) => item.id === recalculated.change?.movedConceptId)
    : null;
  const explainedChange = recalculated.change?.meaningful ? {
    ...recalculated.change,
    explanation: `Your ${input.outcome === "success" ? "independent" : input.outcome === "partial" ? "partial" : "not-yet"} answer on ${concept.name} changed its mastery estimate.${movedConcept ? ` ${movedConcept.name} now has higher learning value for the remaining time.` : " Kelus recalculated the remaining route."}`,
  } : recalculated.change;
  const completedIds = [...new Set(snapshot.events.filter((item) => item.sessionId === session.id && item.kind === "retrieval").map((item) => item.conceptId))];
  const originalIds = session.initialRoute.allocations
    .map((item) => item.conceptId)
    .filter((id): id is string => id !== "mixed-retrieval");
  const futureIds = recalculated.route.allocations
    .map((item) => item.conceptId)
    .filter((id): id is string => id !== "mixed-retrieval" && originalIds.includes(id) && !completedIds.includes(id));
  const unchangedRemaining = originalIds.filter((id) => !completedIds.includes(id) && !futureIds.includes(id));
  const sessions = snapshot.sessions.map((item) => item.id === session.id ? {
    ...item,
    plannedConceptIds: [...completedIds, ...futureIds, ...unchangedRemaining],
    latestRoute: recalculated.route,
    routeChanges: explainedChange?.meaningful ? [...item.routeChanges, explainedChange] : item.routeChanges,
  } : item);
  snapshot = { ...snapshot, sessions };
  const next = { ...state, snapshot };
  persistDemoState(next);
  return next;
}

export function startSession(state: DemoState, courseId: string, examId: string) {
  const exam = state.snapshot.exams.find((item) => item.id === examId);
  if (!exam) throw new Error("Active exam missing.");
  const route = generateRoute({
    concepts: state.snapshot.concepts.filter((concept) => concept.courseId === courseId),
    relationships: state.snapshot.relationships,
    events: state.snapshot.events,
    exam,
    nowIso: state.nowIso,
  });
  const plannedConceptIds = route.allocations.map((item) => item.conceptId).filter((id): id is string => id !== "mixed-retrieval");
  const session: StudySession = {
    id: `session-${crypto.randomUUID()}`,
    userId: state.snapshot.profile.id,
    courseId,
    examId,
    startedAt: state.nowIso,
    endedAt: null,
    plannedMinutes: route.availableMinutes,
    readinessBefore: estimatedReadiness(state.snapshot.concepts.filter((concept) => concept.courseId === courseId)),
    plannedConceptIds,
    initialRoute: route,
    latestRoute: route,
    routeChanges: [],
    status: "in_progress",
    summary: null,
  };
  const next = { ...state, snapshot: { ...state.snapshot, sessions: [...state.snapshot.sessions, session] } };
  persistDemoState(next);
  return { state: next, session };
}

export function finishSession(state: DemoState, sessionId: string, before: Concept[]) {
  const session = state.snapshot.sessions.find((item) => item.id === sessionId);
  if (!session) return state;
  const after = state.snapshot.concepts.filter((concept) => concept.courseId === session.courseId);
  const summary = sessionSummary(before.filter((concept) => concept.courseId === session.courseId), after);
  summary.readinessBefore = session.readinessBefore;
  const sessions = state.snapshot.sessions.map((item) => item.id === sessionId
    ? { ...item, status: "complete" as const, endedAt: state.nowIso, summary }
    : item);
  const next = { ...state, snapshot: { ...state.snapshot, sessions } };
  persistDemoState(next);
  return next;
}

export function shiftDemoDay(state: DemoState, days = 1) {
  if (!isDemoClockEnabled()) return state;
  const nowIso = advanceDemoClock(state.nowIso, days);
  const next = { ...state, snapshot: refreshCaches(state.snapshot, nowIso), nowIso };
  persistDemoState(next);
  return next;
}

export { ALGORITHM_KIND };
