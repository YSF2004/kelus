export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

export type KelusAnalyticsEvent =
  | { name: "setup_started" }
  | { name: "setup_completed"; available_minutes: number }
  | { name: "waitlist_joined"; source: string }
  | { name: "question_submitted"; source: string; delivery?: "remote" | "local" | "needs_activation" }
  | { name: "material_confirmed"; concept_count: number }
  | { name: "search_landing_cta_clicked"; landing: string; placement: "hero" | "faq" | "close" }
  | { name: "material_upload_started"; role: string; course_type: "real"; acquisition_source?: string }
  | { name: "material_shared_in"; kind: string }
  | { name: "match_round_done"; pairs: number; misses: number }
  | { name: "material_upload_completed"; role: string; course_type: "real"; acquisition_source?: string }
  | { name: "material_upload_failed"; role: string; course_type: "real"; acquisition_source?: string }
  | { name: "material_processing_completed"; source_type: "pdf" | "notes"; topic_count: number; used_ocr: boolean; course_type: "real"; acquisition_source?: string }
  | { name: "material_processing_failed"; source_type: "pdf" | "notes"; reason: "ocr" | "extraction" | "cancelled"; course_type: "real"; acquisition_source?: string }
  | { name: "concept_review_started"; concept_count: number }
  | { name: "concept_review_updated"; action: "selected" | "removed" }
  | { name: "diagnosis_completed"; retrieval_count: number }
  | { name: "first_route_ready"; elapsed_ms: number; concept_count: number; course_type: "real" | "sample"; acquisition_source?: string }
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
  | { name: "pilot_milestone"; milestone: "first_topic" | "back_next_day" | "back_within_7_days" | "studied_3_days"; days_since_first: number }
  | { name: "question_flagged"; reason: "unclear" | "wrong_answer" | "not_in_notes" | "unsupported_explanation"; kind: string; variant: string; level: string; course_type: "real" | "sample" };

export function analyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID) && typeof window !== "undefined";
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
let waitingForBootstrap = false;

function flushPendingEvents() {
  if (typeof window.gtag !== "function") return;
  for (const pending of pendingEvents.splice(0)) {
    const { name, ...parameters } = pending;
    window.gtag("event", name, parameters);
  }
}

export function trackEvent(event: KelusAnalyticsEvent) {
  if (!analyticsEnabled()) return;
  if (typeof window.gtag !== "function") {
    if (pendingEvents.length < 100) pendingEvents.push(event);
    if (!waitingForBootstrap) {
      waitingForBootstrap = true;
      window.addEventListener("kelus-analytics-ready", flushPendingEvents, { once: true });
    }
    return;
  }
  flushPendingEvents();
  const { name, ...parameters } = event;
  window.gtag("event", name, parameters);
}

/** Tags every later event from this browser with its pilot group, so a pilot's numbers can be filtered. */
export function setPilotCohort(cohort: string | null) {
  if (!cohort || !analyticsEnabled() || typeof window.gtag !== "function") return;
  window.gtag("set", "user_properties", { pilot_cohort: cohort });
}
