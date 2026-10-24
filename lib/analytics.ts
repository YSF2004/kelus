export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";

export type KelusAnalyticsEvent =
  | { name: "setup_started" }
  | { name: "page_view"; page_path: string; page_location: string; page_title: string; send_to: string }
  | { name: "setup_completed"; available_minutes: number }
  | { name: "waitlist_joined"; source: string }
  | { name: "question_submitted"; source: string; delivery?: "remote" | "local" | "needs_activation" }
  | { name: "material_confirmed"; concept_count: number }
  | { name: "material_upload_started"; role: string; course_type: "real" }
  | { name: "material_upload_completed"; role: string; course_type: "real" }
  | { name: "material_upload_failed"; role: string; course_type: "real" }
  | { name: "concept_review_started"; concept_count: number }
  | { name: "concept_review_updated"; action: "selected" | "removed" }
  | { name: "diagnosis_completed"; retrieval_count: number }
  | { name: "first_route_ready"; elapsed_ms: number; concept_count: number; course_type: "real" | "sample" }
  | { name: "session_started"; session_number?: number; sample?: boolean; course_type: "real" | "sample" }
  | { name: "study_response_recorded"; format: "quick_check" | "own_words"; read_first: boolean; course_type: "real" | "sample" }
  | { name: "session_resumed" }
  | { name: "session_abandoned" }
  | { name: "session_completed"; concept_count: number; planned_minutes: number; session_number?: number; days_since_first?: number; sample?: boolean; course_type: "real" | "sample" }
  | { name: "session_usefulness_rated"; helpful: boolean; session_number?: number }
  | { name: "learner_returned"; day: number; days_since_last: number; session_count: number }
  | { name: "invite_shared"; method: "share" | "copy"; session_number?: number }
  | { name: "invite_opened" }
  | { name: "next_route_opened"; source: "completion" | "calendar" }
  | { name: "reminder_downloaded" }
  | { name: "nudges_enabled" }
  | { name: "app_installed" }
  | { name: "anki_exported"; card_count: number }
  | { name: "today_opened"; returning: boolean; has_next_route: boolean }
  | { name: "route_recalculated"; changed: boolean; outcome: "partial" | "failure" }
  | { name: "sample_loaded"; source: string }
  | { name: "pricing_viewed"; source: string }
  | { name: "soft_paywall_shown"; moment: "first_session" | "third_material" }
  | { name: "subscription_checkout_clicked"; source: string }
  | { name: "pilot_milestone"; milestone: "first_topic" | "back_next_day" | "back_within_7_days" | "studied_3_days"; days_since_first: number }
  | { name: "question_flagged"; reason: "unclear" | "wrong_answer" | "not_in_notes"; kind: string; variant: string; level: string };

export function analyticsEnabled() {
  return Boolean(GA_MEASUREMENT_ID) && typeof window !== "undefined";
}

const pendingEvents: KelusAnalyticsEvent[] = [];
let waitingForBootstrap = false;
let pendingCohort: string | null = null;

function sendEvent(event: KelusAnalyticsEvent) {
  if (typeof window.gtag !== "function") return;
  const { name, ...parameters } = event;
  const gaParameters: Record<string, GoogleAnalyticsParameter> = { ...parameters };
  // Never send URL query strings or fragments with a page view: callback URLs
  // may contain authentication codes or other private values.
  if (name === "page_view") {
    if (typeof gaParameters.page_path === "string") {
      gaParameters.page_path = gaParameters.page_path.split(/[?#]/, 1)[0] || "/";
    }
    if (typeof gaParameters.page_location === "string") {
      gaParameters.page_location = gaParameters.page_location.split(/[?#]/, 1)[0];
    }
  }
  // GA4 treats `source` as traffic attribution. Our source is the in-product
  // entry point (for example `pricing_page`), not a referring campaign.
  if ("source" in gaParameters) {
    gaParameters.interaction_source = gaParameters.source;
    delete gaParameters.source;
  }
  // `session_number` is reserved by GA4 and cannot be registered as a custom
  // dimension. Keep Kelus's study-session ordinal distinct from GA sessions.
  if ("session_number" in gaParameters) {
    gaParameters.study_session_index = gaParameters.session_number;
    delete gaParameters.session_number;
  }
  window.gtag("event", name, gaParameters);
}

function flushPendingEvents() {
  if (typeof window.gtag !== "function") return;
  if (pendingCohort) {
    window.gtag("set", "user_properties", { pilot_cohort: pendingCohort });
    pendingCohort = null;
  }
  for (const pending of pendingEvents.splice(0)) {
    sendEvent(pending);
  }
}

function waitForBootstrap() {
  if (waitingForBootstrap) return;
  waitingForBootstrap = true;
  window.addEventListener("kelus-analytics-ready", () => {
    waitingForBootstrap = false;
    flushPendingEvents();
  }, { once: true });
}

export function trackEvent(event: KelusAnalyticsEvent) {
  if (!analyticsEnabled()) return;
  if (typeof window.gtag !== "function") {
    if (pendingEvents.length < 100) pendingEvents.push(event);
    waitForBootstrap();
    return;
  }
  flushPendingEvents();
  sendEvent(event);
}

/** Tags every later event from this browser with its pilot group, so a pilot's numbers can be filtered. */
export function setPilotCohort(cohort: string | null) {
  if (!cohort || !analyticsEnabled()) return;
  pendingCohort = cohort;
  if (typeof window.gtag === "function") flushPendingEvents();
  else waitForBootstrap();
}
