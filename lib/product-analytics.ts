import { getSupabaseBrowserClient } from "./supabase-client";
import { queueGoogleAnalyticsEvent } from "./google-analytics";

export const PRODUCT_EVENT_NAMES = [
  "setup_completed",
  "material_map_confirmed",
  "diagnosis_completed",
  "session_started",
  "answer_evaluated",
  "route_recalculated",
  "session_completed",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];
export type ProductEventProperties = Record<string, string | number | boolean | null>;

const LOCAL_EVENT_KEY = "kelus-product-events-v1";
const SESSION_ID_KEY = "kelus-analytics-session-id";
const MAX_LOCAL_EVENTS = 200;

export type ProductEvent = {
  eventName: ProductEventName;
  occurredAt: string;
  analyticsSessionId: string;
  properties: ProductEventProperties;
};

function analyticsSessionId() {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(SESSION_ID_KEY, created);
  return created;
}

export function readLocalProductEvents(): ProductEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(LOCAL_EVENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item): item is ProductEvent => Boolean(
      item && typeof item === "object" && PRODUCT_EVENT_NAMES.includes((item as ProductEvent).eventName),
    )) : [];
  } catch {
    return [];
  }
}

export function createProductEvent(
  eventName: ProductEventName,
  properties: ProductEventProperties = {},
  occurredAt = new Date().toISOString(),
): ProductEvent {
  return { eventName, occurredAt, analyticsSessionId: analyticsSessionId(), properties };
}

export function trackProductEvent(
  eventName: ProductEventName,
  properties: ProductEventProperties = {},
  userId?: string | null,
) {
  if (typeof window === "undefined") return;
  const event = createProductEvent(eventName, properties);
  const localEvents = [...readLocalProductEvents(), event].slice(-MAX_LOCAL_EVENTS);
  window.localStorage.setItem(LOCAL_EVENT_KEY, JSON.stringify(localEvents));
  queueGoogleAnalyticsEvent(eventName, properties);

  if (!userId) return;
  const client = getSupabaseBrowserClient();
  if (!client) return;
  void client.from("product_events").insert({
    user_id: userId,
    event_name: event.eventName,
    analytics_session_id: event.analyticsSessionId,
    properties: event.properties,
    occurred_at: event.occurredAt,
  }).then(({ error }) => {
    if (error && process.env.NODE_ENV === "development") console.warn("Kelus analytics event was not synced", eventName, error.message);
  });
}
