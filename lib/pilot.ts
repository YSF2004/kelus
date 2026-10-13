import type { StudySession } from "@/domain/types";

/**
 * Pilot measurement, on the analytics Kelus already has (GA4, ads signals off). Four questions, each answerable
 * from one event and its parameters, without accounts or a paid service:
 *
 * 1. First-session completion: session_completed with session_number 1, over session_started with session_number 1.
 * 2. 7-day return: learner_returned with day ≤ 7, over learners with a first session_completed.
 * 3. Repeat sessions: session_completed with session_number ≥ 2.
 * 4. Usefulness: session_usefulness_rated, split by helpful.
 *
 * The sample course never counts: its events carry sample: true and returns are not sent for it.
 */

const COHORT_KEY = "kelus-pilot-cohort";
const RETURN_KEY = "kelus-pilot-returned-day";

const DAY = 86_400_000;

/** The built-in sample course: practising on it is not a pilot signal. */
export const SAMPLE_COURSE_IDS = new Set(["course-microeconomics"]);

/** Calendar day number in the learner's own time zone. */
function localDay(iso: string | number) {
  const date = new Date(iso);
  return Math.floor((date.getTime() - date.getTimezoneOffset() * 60_000) / DAY);
}

/** Real (non-sample) sessions that reached the end, oldest first. */
function completed(sessions: StudySession[], sampleCourseIds: Set<string>) {
  return sessions
    .filter((session) => session.status === "complete" && !sampleCourseIds.has(session.courseId))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}

/** Which session this is for the learner, and how long since their first, for session events. */
export function sessionContext(input: { sessions: StudySession[]; sessionId?: string; nowIso: string; sampleCourseIds?: Set<string> }) {
  const done = completed(input.sessions, input.sampleCourseIds ?? SAMPLE_COURSE_IDS);
  const index = input.sessionId ? done.findIndex((session) => session.id === input.sessionId) : -1;
  const sessionNumber = index >= 0 ? index + 1 : done.length + 1;
  const first = done[0]?.startedAt ?? input.nowIso;
  return { session_number: sessionNumber, days_since_first: Math.max(0, localDay(input.nowIso) - localDay(first)) };
}

/**
 * A return: the learner opened Kelus on a later day than a completed session. Sent at most once per calendar day, so
 * "came back within 7 days" is one count per learner per day. Null when there is nothing to report.
 */
export function returnVisit(input: { sessions: StudySession[]; nowIso: string; sampleCourseIds?: Set<string> }) {
  const done = completed(input.sessions, input.sampleCourseIds ?? SAMPLE_COURSE_IDS);
  if (!done.length) return null;
  const today = localDay(input.nowIso);
  const firstDay = localDay(done[0].startedAt);
  const lastDay = Math.max(...done.map((session) => localDay(session.endedAt ?? session.startedAt)));
  if (lastDay >= today) return null;
  return { day: today - firstDay, days_since_last: today - lastDay, session_count: done.length };
}

/** True the first time it is called on a given calendar day, so a return is counted once. */
export function firstTimeToday(nowIso: string) {
  try {
    const today = String(localDay(nowIso));
    if (localStorage.getItem(RETURN_KEY) === today) return false;
    localStorage.setItem(RETURN_KEY, today);
    return true;
  } catch {
    return false;
  }
}

/** A pilot group name from a link like kelus.me/?pilot=lycee-2b: lowercase letters, digits and dashes only. */
export function cleanCohort(value: string | null | undefined) {
  const cohort = (value ?? "").trim().toLocaleLowerCase();
  return /^[a-z0-9-]{1,32}$/.test(cohort) ? cohort : null;
}

/** Remembers the pilot group from the link, and returns the one this browser belongs to (if any). */
export function captureCohort(search: string) {
  try {
    const fromLink = cleanCohort(new URLSearchParams(search).get("pilot"));
    if (fromLink) localStorage.setItem(COHORT_KEY, fromLink);
    return fromLink ?? cleanCohort(localStorage.getItem(COHORT_KEY));
  } catch {
    return null;
  }
}

/**
 * The class this browser belongs to: its pilot group if it came from one, otherwise a random code made once
 * ("class-k3x9qa"). It names no course and no person; it only lets one class's invites be counted together.
 */
export function classCode() {
  const existing = captureCohort("");
  if (existing) return existing;
  const code = `class-${Math.random().toString(36).slice(2, 8).padEnd(6, "0")}`;
  try {
    localStorage.setItem(COHORT_KEY, code);
  } catch {
    /* Private mode: the link still works, it just is not remembered. */
  }
  return code;
}

/** The link a student sends their class: kelus.me itself, tagged with the class code. Never their notes. */
export function inviteLink(code: string, origin = "https://kelus.me") {
  return `${origin}/?pilot=${encodeURIComponent(code)}&via=invite`;
}
