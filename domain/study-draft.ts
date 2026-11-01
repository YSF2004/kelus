import type { CheckVerdict } from "./practice-check";
import type { QuickRun } from "./quick-run";

export type CheckFeedback = {
  right: boolean;
  how?: CheckVerdict["how"];
  unsure?: boolean;
  elsewhere?: string | null;
  given?: string;
  picked?: boolean;
  firstEver?: boolean;
};

/** An unfinished run is a device-local draft, not a completed learning event. */
export type StudyDraft = {
  reading: number;
  step: number;
  picked: number | null;
  typed: string;
  tapped: string | null;
  answered: CheckFeedback | null;
  known: string[];
  missed: string[];
  unsure: number;
  right: number;
  explained: string;
  compared: boolean;
  elapsedMs: number;
  responseTracked: boolean;
};

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type ReadDraft =
  | { kind: "restored"; draft: StudyDraft }
  | { kind: "empty" | "changed" | "invalid" | "unavailable" };

const PREFIX = "kelus:study-draft:v1:";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const integer = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value: unknown): value is string => typeof value === "string" && value.length <= 50_000;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function studyDraftKey(owner: string | null, session: string, concept: string) {
  return PREFIX + [owner ?? "guest", session, concept].map(encodeURIComponent).join(":");
}

/** Exact identity: never apply old scores to changed questions or model answers. */
export function studyRunSignature(run: QuickRun, total: number) {
  return JSON.stringify([run.topic, run.checks, run.sentences, run.explainPrompt, run.explainAnswer, run.explainQuote, total]);
}

export function validStudyDraft(value: unknown, run: QuickRun, total: number): value is StudyDraft {
  if (!record(value)) return false;
  const quotes = new Set(run.checks.map((item) => item.sourceQuote));
  const lines = (list: unknown): list is string[] => Array.isArray(list)
    && list.length <= total && list.every((line) => typeof line === "string" && quotes.has(line));
  if (!integer(value.reading, -1, 1000) || !integer(value.step, 0, total)
    || !(value.picked === null || integer(value.picked, 0, (run.checks[value.step]?.choices?.length ?? 0) - 1))
    || !text(value.typed) || !(value.tapped === null || text(value.tapped))
    || !lines(value.known) || !lines(value.missed)
    || !integer(value.right, 0, total) || !integer(value.unsure, 0, total)
    || value.right + value.missed.length > total || value.unsure > value.missed.length
    || !text(value.explained) || typeof value.compared !== "boolean"
    || !integer(value.elapsedMs, 0, Number.MAX_SAFE_INTEGER) || typeof value.responseTracked !== "boolean") return false;
  if (value.answered !== null) {
    const feedback = value.answered;
    if (value.step >= total || !record(feedback) || typeof feedback.right !== "boolean"
      || ![undefined, "exact", "spelling", "form", "words"].includes(feedback.how as string | undefined)
      || ![feedback.unsure, feedback.picked, feedback.firstEver].every((field) => field === undefined || typeof field === "boolean")
      || !(feedback.given === undefined || text(feedback.given))
      || !(feedback.elsewhere == null || text(feedback.elsewhere))) return false;
  }
  return true;
}

export function readStudyDraft(storage: DraftStorage, key: string, run: QuickRun, total: number, now = Date.now()): ReadDraft {
  let raw: string | null;
  try { raw = storage.getItem(key); } catch { return { kind: "unavailable" }; }
  if (!raw) return { kind: "empty" };
  try {
    const entry: unknown = JSON.parse(raw);
    if (!record(entry) || entry.version !== 1 || !integer(entry.at, 0, now + 60_000) || now - entry.at > MAX_AGE_MS) return { kind: "invalid" };
    if (entry.signature !== studyRunSignature(run, total)) return { kind: "changed" };
    return validStudyDraft(entry.draft, run, total) ? { kind: "restored", draft: entry.draft } : { kind: "invalid" };
  } catch { return { kind: "invalid" }; }
}

export function saveStudyDraft(storage: DraftStorage, key: string, run: QuickRun, total: number, draft: StudyDraft, now = Date.now()) {
  try {
    storage.setItem(key, JSON.stringify({ version: 1, signature: studyRunSignature(run, total), at: now, draft }));
    return true;
  } catch { return false; }
}

export function clearStudyDraft(storage: DraftStorage, key: string) {
  try { storage.removeItem(key); return true; } catch { return false; }
}
