"use client";

import { useSyncExternalStore } from "react";
import { aiConfigured, forgetAiContent, getAiConsent, setAiConsent, subscribeAiConsent } from "@/lib/ai-client";
import { getLocalAiProgress, getLocalAiState, prepareLocalAi, subscribeLocalAi } from "@/lib/local-ai";
import styles from "./AiConsent.module.css";

/**
 * Off by default. Shown only when there is a model to use: a configured question-writing service, or this browser's
 * own on-device model (recent Chrome). One row, like a setting: what it does, where the text goes, and a switch.
 */
export function AiConsent() {
  const on = useSyncExternalStore(subscribeAiConsent, getAiConsent, () => false);
  const local = useSyncExternalStore(subscribeLocalAi, getLocalAiState, () => "unknown");
  const progress = useSyncExternalStore(subscribeLocalAi, getLocalAiProgress, () => 0);
  const remote = aiConfigured();
  const onDevice = !remote && local !== "unknown" && local !== "unavailable";
  if (!remote && !onDevice) return null;

  async function change(next: boolean) {
    if (!next) { setAiConsent(false); forgetAiContent(); return; }
    if (remote) { setAiConsent(true); return; }
    // The model download has to start from this click.
    setAiConsent(await prepareLocalAi());
  }

  const downloading = local === "downloading";
  return (
    <section className={styles.row} aria-labelledby="ai-consent-title">
      <div className={styles.text}>
        <h3 id="ai-consent-title">Smarter questions</h3>
        <p>
          An AI model reads each topic’s page and writes questions that test understanding: apply the idea, predict what
          happens, pick the reason. Every question quotes your page; anything it can’t quote is thrown away.
        </p>
        <p className={styles.fine}>
          {remote
            ? "Only that page text is sent, to a Kelus service that passes it to Anthropic’s API. Your files, name and answers stay on this device. "
            : "The model runs inside Chrome, so your notes never leave this device. The first time, Chrome downloads it (about 2 GB, once). "}
          Turn it off any time and what it wrote is removed. <a href="/privacy#ai-questions">Details</a>
        </p>
        {downloading ? <p className={styles.fine} role="status">Downloading the on-device model, {Math.round(progress * 100)}%</p> : null}
      </div>
      <label className={styles.switch}>
        <input type="checkbox" role="switch" checked={on} disabled={downloading} onChange={(event) => void change(event.target.checked)} aria-describedby="ai-consent-title" />
        <span aria-hidden="true" />
        <span className="sr-only">{on ? "On" : "Off"}</span>
      </label>
    </section>
  );
}
