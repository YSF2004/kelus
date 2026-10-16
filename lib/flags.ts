/**
 * "Flag this question": the pilot's quality signal. A flag is counted anonymously (the reason and the kind of
 * question, never its words) and the question is not asked again on this device. Its words leave the device only
 * if the student taps "Send it to the Kelus team", and then only to the Kelus inbox.
 */

import type { PracticeItem } from "@/domain/types";
import { trackEvent } from "@/lib/analytics";
import { captureCohort } from "@/lib/pilot";
import { questionsEndpoint, questionsInboxEmail } from "@/lib/questions";

export type FlagReason = "unclear" | "wrong_answer" | "not_in_notes";

export const FLAG_REASONS: Array<{ value: FlagReason; label: string }> = [
  { value: "unclear", label: "Doesn’t make sense" },
  { value: "wrong_answer", label: "The answer is wrong" },
  { value: "not_in_notes", label: "Not what my notes say" },
];

const STORAGE_KEY = "kelus:flagged-questions:v1";

/** The same question in any later run: its prompt and the line it quotes. */
export function flagKey(item: Pick<PracticeItem, "prompt" | "sourceQuote">) {
  let hash = 2166136261;
  for (const char of `${item.prompt}\u0000${item.sourceQuote}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : [];
  } catch {
    return [];
  }
}

/** Questions this student flagged: they are left out of later runs. */
export function flaggedKeys() {
  return new Set(read());
}

/** Counts the flag (anonymous) and remembers it on this device. */
export function flagQuestion(item: PracticeItem, reason: FlagReason) {
  const key = flagKey(item);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...read(), key])].slice(-300)));
  } catch { /* A flag that cannot be saved is still counted. */ }
  trackEvent({ name: "question_flagged", reason, kind: item.kind, variant: item.variant ?? "none", level: item.level ?? "recall" });
}

/** Only on the student's tap: the question, its answer and its line go to the Kelus inbox, so it can be fixed. */
export async function sendFlaggedQuestion(item: PracticeItem, reason: FlagReason, topic: string, given?: string) {
  const label = FLAG_REASONS.find((entry) => entry.value === reason)?.label ?? reason;
  const cohort = captureCohort("");
  const body = [
    `Reason: ${label}`,
    `Topic: ${topic}`,
    `Question: ${item.prompt}`,
    `Kelus's answer: ${item.modelAnswer}`,
    given ? `Student's answer: ${given}` : null,
    `Line from the notes: ${item.sourceQuote}`,
    cohort ? `Pilot group: ${cohort}` : null,
  ].filter(Boolean).join("\n");
  try {
    const response = await fetch(questionsEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: "Flagged question", email: questionsInboxEmail(), message: body, _subject: `Flagged question: ${label}`, _template: "table" }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
