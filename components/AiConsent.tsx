"use client";

import { useSyncExternalStore } from "react";
import { aiConfigured, forgetAiContent, getAiConsent, setAiConsent, subscribeAiConsent } from "@/lib/ai-client";
import { getLocalAiState, subscribeLocalAi } from "@/lib/local-ai";

/** Which model writes questions here, if any: the hosted service, this browser's installed model, or none. */
function useAiSource() {
  const on = useSyncExternalStore(subscribeAiConsent, getAiConsent, () => false);
  const local = useSyncExternalStore(subscribeLocalAi, getLocalAiState, () => "unknown");
  const source = aiConfigured() ? "hosted" : local === "available" ? "device" : null;
  return { on, source };
}

/**
 * The one line that says how questions are written, where a student first sees them: under the topic check after an
 * import. Nothing is labelled "AI" elsewhere; the questions are simply part of Kelus.
 */
export function AiNote() {
  const { on, source } = useAiSource();
  if (!on || !source) return null;
  return (
    <p className="ai-note">
      {source === "hosted"
        ? "Kelus writes your questions from these pages with Anthropic’s model. Only the page text is sent; every question must quote it."
        : "Your browser’s built-in model writes your questions from these pages; your notes stay on this device."}{" "}
      <a href="/privacy#ai-questions">How it works</a>
    </p>
  );
}

/** In Course options: question writing can be turned off (and what it wrote removed), or back on. */
export function AiSetting() {
  const { on, source } = useAiSource();
  if (!source) return null;
  return (
    <button
      type="button"
      className="rail-menu-item"
      aria-pressed={on}
      onClick={() => { if (on) { setAiConsent(false); forgetAiContent(); } else setAiConsent(true); }}
    >
      {on ? "Write questions with AI: on" : "Write questions with AI: off"}
    </button>
  );
}
