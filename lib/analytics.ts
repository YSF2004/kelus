export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
export const POSTHOG_PROJECT_KEY =
  process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim() || "";
export const POSTHOG_API_HOST = "https://us.i.posthog.com";

export type KelusAnalyticsEvent =
  | { name: "source_intake_viewed"; variant: "reference" | "course_story" }
  | { name: "setup_started" }
  | { name: "setup_completed"; available_minutes: number }
  | { name: "waitlist_joined"; source: string }
  | { name: "question_submitted"; source: string; delivery?: "remote" | "local" | "needs_activation" }
  | { name: "material_confirmed"; concept_count: number }
  | { name: "search_landing_cta_clicked"; landing: string; placement: "hero" | "faq" | "close" }
  | { name: "material_upload_started"; role: string; course_type: "real"; acquisition_source?: string; intake_variant?: "reference" | "course_story" }
  | { name: "material_shared_in"; kind: string }
  | { name: "match_round_done"; pairs: number; misses: number }
  | { name: "material_upload_completed"; role: string; course_type: "real"; acquisition_source?: string; intake_variant?: "reference" | "course_story" }
  | { name: "material_upload_failed"; role: string; course_type: "real"; acquisition_source?: string; intake_variant?: "reference" | "course_story" }
  | { name: "material_processing_completed"; source_type: "pdf" | "notes"; topic_count: number; used_ocr: boolean; course_type: "real"; acquisition_source?: string }
  | { name: "material_processing_failed"; source_type: "pdf" | "notes"; reason: "ocr" | "extraction" | "cancelled"; course_type: "real"; acquisition_source?: string }
  | { name: "concept_review_started"; concept_count: number }
  | { name: "concept_review_updated"; action: "selected" | "removed" }
  | { name: "diagnosis_completed"; retrieval_count: number }
  | { name: "first_route_ready"; elapsed_ms: number; concept_count: number; course_type: "real" | "sample"; acquisition_source?: string; intake_variant?: "reference" | "course_story" }
  | { name: "first_question_shown"; elapsed_bucket: "under_30s" | "under_60s" | "under_2m" | "over_2m"; course_type: "real" | "sample" }
  | { name: "session_started"; session_number?: number; sample?: boolean; course_type: "real" | "sample" }
  | { name: "study_response_recorded"; format: "quick_check" | "own_words"; read_first: boolean; course_type: "real" | "sample" }
  | { name: "session_resumed" }
  | { name: "session_abandoned" }
  | { name: "session_completed"; concept_count: number; planned_minutes: number; session_number?: number; days_since_first?: number; sample?: boolean; course_type: "real" | "sample" }
  | { name: "session_usefulness_rated"; helpful: boolean; session_number?: number; course_type: "real" | "sample" }
  | { name: "learner_returned"; day: number; days_since_last: number; session_count: number; course_type: "real" }
  | { name: "invite_shared"; method: "share" | "copy"; session_number?: number }
  | { name: "result_shared"; method: "image" | "share" | "copy" | "whatsapp"; session_number?: number }
  | { name: "shared_result_opened"; valid: boolean }
  | { name: "shared_result_cta"; target: "own_notes" | "sample" }
  | { name: "invite_opened" }
  | { name: "next_route_opened"; source: "completion" | "calendar" }
  | { name: "reminder_downloaded" }
  | { name: "nudges_enabled" }
  | { name: "exam_added_to_calendar"; calendar: "google" | "file" }
  | { name: "app_installed" }
  | { name: "anki_exported"; card_count: number }
  | { name: "today_opened"; returning: boolean; has_next_route: boolean }
  | { name: "route_recalculated"; changed: boolean; outcome: "partial" | "failure" }
  | { name: "sample_loaded"; source: string }
  | { name: "pricing_viewed"; source: string }
  | { name: "soft_paywall_shown"; moment: "first_session" | "third_material" }
  | { name: "subscription_checkout_clicked"; source: string }
  | { name: "past_paper_practice_opened"; linked_prompt_count: number }
  | { name: "past_paper_response_compared"; wrote_answer: boolean }
  | { name: "past_paper_topic_started"; linked: boolean }
  | { name: "pilot_milestone"; milestone: "first_topic" | "back_next_day" | "back_within_7_days" | "studied_3_days"; days_since_first: number }
  | { name: "question_flagged"; reason: "unclear" | "wrong_answer" | "not_in_notes" | "unsupported_explanation"; kind: string; variant: string; level: string; course_type: "real" | "sample" };

export function analyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID) && typeof window !== "undefined";
}

/** Mirrors the device-level analytics exclusion used by the existing GA bootstrap. */
export function analyticsOptedOut() {
  if (typeof window === "undefined") return true;

  const requested = new URLSearchParams(window.location?.search ?? "").get("internal");
  if (requested === "1") return true;
  if (requested === "0") return false;

  try {
    return window.localStorage?.getItem("kelus-internal") === "1";
  } catch {
    return false;
  }
}

/**
 * A short, controlled label for the search page that started this visit. It is
 * deliberately never a file name, note title, search query, or referrer.
 */
export function getAcquisitionSource() {
  if (typeof window === "undefined") return undefined;
  try {
    const source = window.sessionStorage.getItem("kelus-acquisition-source");
    return source && /^[a-z0-9-]{2,64}$/.test(source) ? source : undefined;
  } catch {
    return undefined;
  }
}

const pendingEvents: KelusAnalyticsEvent[] = [];
const pendingPostHogEvents: KelusAnalyticsEvent[] = [];
let waitingForBootstrap = false;
let postHogCapture: ((name: string, properties: Record<string, string | number | boolean>) => void) | null = null;
let pilotCohort: string | null = null;

function postHogProperties(event: KelusAnalyticsEvent) {
  const { name: _name, ...values } = event;
  const properties: Record<string, string | number | boolean> = {};

  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      properties[key] = value;
    }
  }

  if (pilotCohort) properties.pilot_cohort = pilotCohort;
  return properties;
}

function sendToPostHog(event: KelusAnalyticsEvent) {
  if (!postHogCapture) return;
  try {
    postHogCapture(event.name, postHogProperties(event));
  } catch {
    // Analytics failures must never interrupt a study action.
  }
}

/** Called only after the browser SDK has initialized. */
export function connectPostHog(
  capture: (name: string, properties: Record<string, string | number | boolean>) => void,
) {
  if (!POSTHOG_PROJECT_KEY || analyticsOptedOut()) {
    postHogCapture = null;
    pendingPostHogEvents.length = 0;
    return;
  }

  postHogCapture = capture;
  for (const event of pendingPostHogEvents.splice(0)) sendToPostHog(event);
}

export function disconnectPostHog() {
  postHogCapture = null;
}

function flushPendingEvents() {
  if (typeof window.gtag !== "function") return;
  for (const pending of pendingEvents.splice(0)) {
    const { name, ...parameters } = pending;
    window.gtag("event", name, parameters);
  }
}

export function trackEvent(event: KelusAnalyticsEvent) {
  if (typeof window === "undefined") return;

  if (analyticsEnabled()) {
    if (typeof window.gtag !== "function") {
      if (pendingEvents.length < 100) pendingEvents.push(event);
      if (!waitingForBootstrap) {
        waitingForBootstrap = true;
        window.addEventListener("kelus-analytics-ready", flushPendingEvents, { once: true });
      }
    } else {
      flushPendingEvents();
      const { name, ...parameters } = event;
      window.gtag("event", name, parameters);
    }
  }

  if (!POSTHOG_PROJECT_KEY || analyticsOptedOut()) return;
  if (postHogCapture) {
    sendToPostHog(event);
  } else if (pendingPostHogEvents.length < 100) {
    pendingPostHogEvents.push(event);
  }
}

const FIRST_QUESTION_STARTED_AT = "kelus-first-question-started-at";

/** Starts an anonymous first-use timer. It contains no course name, file name, or note content. */
export function startFirstQuestionTimer() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem(FIRST_QUESTION_STARTED_AT, String(Date.now())); } catch { /* Optional measurement. */ }
}

/** Sends one deliberately coarse time-to-first-question bucket, then clears the timer. */
export function trackFirstQuestionShown(courseType: "real" | "sample") {
  if (typeof window === "undefined") return;
  let startedAt = 0;
  try {
    startedAt = Number(window.sessionStorage.getItem(FIRST_QUESTION_STARTED_AT));
    window.sessionStorage.removeItem(FIRST_QUESTION_STARTED_AT);
  } catch { return; }
  if (!Number.isFinite(startedAt) || startedAt <= 0) return;
  const elapsed = Math.max(0, Date.now() - startedAt);
  const elapsed_bucket = elapsed < 30_000 ? "under_30s" : elapsed < 60_000 ? "under_60s" : elapsed < 120_000 ? "under_2m" : "over_2m";
  trackEvent({ name: "first_question_shown", elapsed_bucket, course_type: courseType });
}

/** Tags every later event from this browser with its pilot group, so a pilot's numbers can be filtered. */
export function setPilotCohort(cohort: string | null) {
  pilotCohort = cohort;
  if (!cohort || !analyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("set", "user_properties", { pilot_cohort: cohort });
}
