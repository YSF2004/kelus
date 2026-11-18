import { generateLocally, getLocalAiState } from "@/lib/local-ai";
import { buildPrompt, mergeAiContent, validateAiReply, type AiTopicContent, type AiTopicInput } from "@/domain/ai-content";
import posthog from "posthog-js";

/**
 * The app's side of question writing. It runs when a model is available (a proxy configured at build time, or this
 * browser's own on-device model already installed) unless the learner turned it off. Any failure returns null, and
 * the offline questions are used.
 */

const CONSENT_KEY = "kelus-ai-consent-v1";
const CONSENT_EVENT = "kelus-ai-consent";
const CACHE_PREFIX = "kelus-ai-topic-v1:";
const TIMEOUT_MS = 40_000;
const posthogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN && process.env.NEXT_PUBLIC_POSTHOG_HOST,
);

export function aiEndpoint() {
  return (process.env.NEXT_PUBLIC_AI_ENDPOINT ?? "").trim();
}

export function aiConfigured() {
  return aiEndpoint().length > 0;
}

/** Question writing is part of Kelus: on unless this browser has turned it off in Course options. */
export function getAiConsent() {
  try { return window.localStorage.getItem(CONSENT_KEY) !== "off"; } catch { return true; }
}

export function setAiConsent(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(CONSENT_KEY);
    else window.localStorage.setItem(CONSENT_KEY, "off");
  } catch { /* Without storage the setting cannot be kept; it stays on for this visit. */ }
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

export function subscribeAiConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Writing questions is possible: a configured service, or this browser's own on-device model, and the learner said yes. */
export function aiActive() {
  return getAiConsent() && (aiConfigured() || getLocalAiState() === "available");
}

function cacheKey(input: AiTopicInput) {
  let h = 2166136261;
  for (const ch of `${input.name}\n${input.pageText}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return CACHE_PREFIX + (h >>> 0).toString(36);
}

function aiSessionId(input: AiTopicInput) {
  if (!posthogConfigured || typeof window === "undefined") return null;
  const distinctId = posthog.get_distinct_id();
  return distinctId ? `topic-${distinctId}-${cacheKey(input)}` : null;
}

/** Pass the initialized browser identity and a stable per-topic session to the hosted model worker. */
function aiObservabilityHeaders(input: AiTopicInput): Record<string, string> {
  const sessionId = aiSessionId(input);
  if (!sessionId) return {};
  const distinctId = posthog.get_distinct_id();
  if (!distinctId) return {};
  return {
    "x-posthog-distinct-id": distinctId,
    "x-posthog-ai-session-id": sessionId,
  };
}

/** The on-device model stays private: its AI Observability event carries metadata, never prompt or reply content. */
function captureLocalAiGeneration(input: AiTopicInput, latencyMs: number, failed: boolean) {
  const sessionId = aiSessionId(input);
  if (!sessionId) return;
  posthog.capture("$ai_generation", {
    $ai_trace_id: crypto.randomUUID(),
    $ai_session_id: sessionId,
    $ai_model: "chrome-prompt-api",
    $ai_provider: "chrome",
    $ai_latency: latencyMs / 1_000,
    ...(failed ? { $ai_is_error: true } : {}),
  });
}

export function readCachedAi(input: AiTopicInput): AiTopicContent | null {
  try {
    const raw = window.localStorage.getItem(cacheKey(input));
    return raw ? (JSON.parse(raw) as AiTopicContent) : null;
  } catch { return null; }
}

export function forgetAiContent() {
  try {
    for (const key of Object.keys(window.localStorage)) if (key.startsWith(CACHE_PREFIX)) window.localStorage.removeItem(key);
  } catch { /* Nothing stored, nothing to forget. */ }
}

/** Asks the proxy to write questions for one topic. Returns checked content, or null on any problem. */
export async function fetchAiTopicContent(input: AiTopicInput, options: { endpoint?: string; fetchImpl?: typeof fetch } = {}): Promise<AiTopicContent | null> {
  const endpoint = options.endpoint ?? aiEndpoint();
  if (input.pageText.trim().length < 40) return null;
  const cached = typeof window !== "undefined" ? readCachedAi(input) : null;
  if (cached) return cached;
  if (!endpoint) return fetchOnDevice(input);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await (options.fetchImpl ?? fetch)(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...aiObservabilityHeaders(input) },
      body: JSON.stringify(buildPrompt(input)),
      signal: controller.signal,
    });
    if (!response.ok) {
      if (posthogConfigured) {
        posthog.logger.warn("ai_topic_generation_failed", {
          generation_path: "hosted",
          response_status: response.status,
        });
      }
      return null;
    }
    const data = (await response.json()) as { text?: unknown };
    if (typeof data.text !== "string") return null;
    const content = validateAiReply(data.text, input);
    if (content && typeof window !== "undefined") {
      try { window.localStorage.setItem(cacheKey(input), JSON.stringify(content)); } catch { /* Cache is optional. */ }
      if (posthogConfigured) posthog.logger.info("ai_topic_generated", { generation_path: "hosted" });
    }
    return content;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The same request, answered by the model in this browser. Slower, free, and private. */
async function fetchOnDevice(input: AiTopicInput): Promise<AiTopicContent | null> {
  const { system, user } = buildPrompt(input, { maxItems: 4 });
  const startedAt = Date.now();
  const raw = await generateLocally(system, user);
  captureLocalAiGeneration(input, Date.now() - startedAt, !raw);
  if (!raw) return null;
  const content = validateAiReply(raw, input);
  if (content && typeof window !== "undefined") {
    try { window.localStorage.setItem(cacheKey(input), JSON.stringify(content)); } catch { /* Cache is optional. */ }
    if (posthogConfigured) posthog.logger.info("ai_topic_generated", { generation_path: "on_device" });
  }
  return content;
}

/** Writes questions for the next few topics in the background, so they are ready the moment a session opens. */
export async function prefetchAiTopics(inputs: AiTopicInput[]) {
  for (const input of inputs) {
    if (!aiActive()) return;
    await fetchAiTopicContent(input);
  }
}

export { mergeAiContent };
