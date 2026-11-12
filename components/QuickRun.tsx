"use client";

import { ArrowRight, Cross, Tick } from "@/components/Marks";
import type { ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LineMove } from "@/components/LineMove";
import { buildAnswerReason, feedbackHeadline } from "@/domain/answer-reason";
import { resolveEvidenceSource, type EvidenceSourceResolution } from "@/domain/source-reference";
import type { LearningSourceReference } from "@/domain/types";
import { checkAnswer, type CheckVerdict } from "@/domain/practice-check";
import { explainMatch, looksLikeWords } from "@/domain/answer-evaluation";
import { PackArt } from "@/components/PackArt";
import { ListenButton } from "@/components/ListenButton";
import { play, setSounds, soundsOn, subscribeSounds } from "@/lib/sound";
import { hiddenLines, hideLine } from "@/lib/hidden-lines";
import { asksForTheTopic, gapChoices, keyWordsIn, linesAround, readingLines, whereAnswerBelongs, type QuickRun as Run, type SelfGrade } from "@/domain/quick-run";
import { trackEvent } from "@/lib/analytics";
import { FLAG_REASONS, flagQuestion, sendFlaggedQuestion, type FlagReason } from "@/lib/flags";
import { Octicon } from "@/components/Octicon";
import { uiWords } from "@/lib/ui-words";
import { clearStudyDraft, readStudyDraft, saveStudyDraft, type CheckFeedback, type StudyDraft } from "@/domain/study-draft";
import styles from "./QuickRun.module.css";

/** `missed` holds the page lines behind the checks that were wrong or not sure, so the result can point back to them. */
export type QuickRunResult = { right: number; total: number; unsure: number; self: SelfGrade; explained: string; elapsedMs: number; missed: string[]; /** The lines behind the checks that were right. */ known: string[]; /** Key ideas from the notes the explanation used, when there were enough to compare. */ coverage?: { hits: number; keys: number } | null };

const noSubscribe = () => () => {};
const modKeyNow = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ");
const touchNow = () => window.matchMedia("(pointer: coarse)").matches;

function EvidenceSourceAction({ resolution, quote, onShowLine, testId, label }: {
  resolution: EvidenceSourceResolution;
  quote: string;
  onShowLine?: (quote: string, source: LearningSourceReference) => void;
  testId?: string;
  label: string;
}) {
  if (resolution.kind === "source") {
    return onShowLine ? (
      <button
        data-testid={testId ?? "source-evidence-jump"}
        type="button"
        className={styles.sourceJump}
        onClick={() => onShowLine(quote, resolution.reference)}
      >
        {label}<ArrowRight aria-hidden="true" />
      </button>
    ) : null;
  }

  if (resolution.kind === "ambiguous") {
    return (
      <div className={styles.sourceFallback} role="group" aria-label="Choose a course source">
        <p>This saved question isn’t linked to one file. Choose a source to check whether the passage appears there.</p>
        {onShowLine ? (
          <div className={styles.sourceChoices}>
            {resolution.options.map((source) => (
              <button
                key={`${source.materialId}-${source.locator ?? ""}`}
                type="button"
                className={styles.sourceJump}
                onClick={() => onShowLine(quote, source)}
              >
                {source.label || "Course source"}{source.locator ? ` · ${source.locator}` : ""}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <p className={styles.sourceFallback} role="status">
      This quote is saved with the question, but no course file is linked to verify it.{" "}
      <Link href="/materials">Open Materials</Link>
    </p>
  );
}

/** A line from the notes with the words the checks will ask for marked, so reading points at them. */
function Marked({ line, words }: { line: string; words: string[] }) {
  if (!words.length) return <>{line}</>;
  const pattern = new RegExp(`(?<![\\p{L}])(${words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}])`, "giu");
  return <>{line.split(pattern).map((part, index) => (index % 2 ? <mark key={index}>{part}</mark> : part))}</>;
}

const GRADES: Array<{ value: SelfGrade; label: string; hint: string }> = [
  { value: "nailed", label: "Nailed it", hint: "Same idea, my own words" },
  { value: "partly", label: "Partly", hint: "Some of it" },
  { value: "missed", label: "Missed it", hint: "Not really" },
];

/**
 * One topic as a short run: instant checks that quote the page, then one explanation in your own words.
 * It is the whole loop for a topic: no separate read, use and mark screens.
 */
/** Why a typed answer that was not word for word still counts. */
function acceptedNote(how: NonNullable<CheckVerdict["how"]>, word: string) {
  if (how === "spelling") return `Counted. Your notes spell it “${word}”.`;
  if (how === "form") return `Counted. Your notes say “${word}”.`;
  return `Counted. The gap was just “${word}”.`;
}

export function QuickRun({ run: providedRun, persistenceKey, onPersistenceChange, onRevealSource, onShowLine, sourceReferences = [], onFinish, onChecksDone, context, readFirst = false, firstStudySession = false, known, recalled, courseType = "real" }: {
  run: Run;
  persistenceKey?: string;
  onPersistenceChange?: (saved: boolean) => void;
  courseType?: "real" | "sample";
  /** A topic met for the first time: its lines are read, one at a time, before anything is asked. */
  readFirst?: boolean;
  /** Show the one-time explanation of how notes become questions, answers, and evidence. */
  firstStudySession?: boolean;
  /** The lines already recalled, and how many of the course's lines that is: the counter in the top bar. */
  known?: Set<string>;
  recalled?: number;
  onRevealSource: () => void;
  /** Available course files; used only when older questions have no saved per-question source. */
  sourceReferences?: LearningSourceReference[];
  /** Open this exact source and mark the quoted line when possible. */
  onShowLine?: (quote: string, source: LearningSourceReference) => void;
  onFinish: (result: QuickRunResult) => void;
  /** A warm-up is checks only: given this, the last Next ends the run instead of opening the explanation. */
  onChecksDone?: (result: { right: number; total: number; missed: string[]; known: string[] }) => void;
  /** Which topic this is, set beside the progress bar as its caption rather than as a label above the question. */
  context?: ReactNode;
}) {
  // An optional AI result must never replace a question while it is being answered.
  const [run] = useState(providedRun);
  const reduce = useReducedMotion() === true;
  const modKey = useSyncExternalStore(noSubscribe, modKeyNow, () => "⌘");
  const touch = useSyncExternalStore(noSubscribe, touchNow, () => false);
  const soundOn = useSyncExternalStore(subscribeSounds, soundsOn, () => false);
  const w = uiWords();
  const total = firstStudySession && !onChecksDone ? Math.min(2, run.checks.length) : run.checks.length;
  const [resume] = useState(() => {
    if (!persistenceKey || typeof window === "undefined") return { kind: "empty" as const };
    try { return readStudyDraft(window.localStorage, persistenceKey, run, total); }
    catch { return { kind: "unavailable" as const }; }
  });
  const draft = resume.kind === "restored" ? resume.draft : null;
  const finished = useRef(false);
  const [saveFailed, setSaveFailed] = useState(resume.kind === "unavailable");
  // Lines a student hid as not worth reading stay out of the reading for good, on this device.
  const [lines, setLines] = useState(() => (readFirst ? readingLines(run).filter((line) => !hiddenLines().has(line)) : []));
  // -1 once reading is over (or there is nothing to read); otherwise the last line shown so far.
  const [reading, setReading] = useState(() => draft ? Math.min(draft.reading, lines.length - 1) : (lines.length >= 2 ? 0 : -1));
  const [knownNow, setKnownNow] = useState<string[]>(draft?.known ?? []);
  const [change, setChange] = useState<"+1" | "−1">("+1");
  const [bump, setBump] = useState(() => draft?.known.filter((quote) => !known?.has(quote)).length ?? 0);
  const started = useRef(0);
  const firstResponseTracked = useRef(draft?.responseTracked ?? false);
  // The first study session is a deliberately short two-idea introduction. Later
  // sessions keep the full run, and warm-ups keep their own check count.
  const [step, setStep] = useState(draft?.step ?? 0); // 0..total-1 = checks, total = explain
  const [picked, setPicked] = useState<number | null>(draft?.picked ?? null);
  const [typed, setTyped] = useState(draft?.typed ?? "");
  const [answered, setAnswered] = useState<CheckFeedback | null>(draft?.answered ?? null);
  // A word tapped from four is recognised, not recalled: it earns the check, never a line on the recall count.
  const [tapped, setTapped] = useState<string | null>(draft?.tapped ?? null);
  const [drop, setDrop] = useState(() => [...new Set(draft?.missed ?? [])].filter((quote) => known?.has(quote)).length);
  // Flagging a question: closed, choosing a reason, or flagged (and maybe sent to the Kelus team).
  // "Show it in your notes": the line asked about, between the lines around it.
  const [around, setAround] = useState(false);
  const [flag, setFlag] = useState<null | "choosing" | { reason: FlagReason; sent: "no" | "sending" | "yes" | "failed" }>(null);
  const [missed, setMissed] = useState<string[]>(draft?.missed ?? []);
  const [unsure, setUnsure] = useState(draft?.unsure ?? 0);
  const [right, setRight] = useState(draft?.right ?? 0);
  const [explained, setExplained] = useState(draft?.explained ?? "");
  const [compared, setCompared] = useState(draft?.compared ?? false);
  const [nudge, setNudge] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { started.current = performance.now() - (draft?.elapsedMs ?? 0); }, [draft]);
  useEffect(() => {
    if (!persistenceKey || finished.current) return;
    const snapshot: StudyDraft = {
      reading, step, picked, typed, tapped, answered, known: knownNow, missed, unsure, right,
      explained, compared, elapsedMs: Math.max(0, Math.round(performance.now() - started.current)),
      responseTracked: firstResponseTracked.current,
    };
    let saved = false;
    try { saved = saveStudyDraft(window.localStorage, persistenceKey, run, total, snapshot); } catch { /* Storage access itself may be denied. */ }
    setSaveFailed(!saved);
    onPersistenceChange?.(saved);
  }, [persistenceKey, run, total, reading, step, picked, typed, tapped, answered, knownNow, missed, unsure, right, explained, compared, onPersistenceChange]);

  function clearDraft() {
    finished.current = true;
    if (persistenceKey) {
      try { clearStudyDraft(window.localStorage, persistenceKey); } catch { /* The completed learning event is saved separately. */ }
    }
  }
  useEffect(() => {
    if (!answered) return;
    nextRef.current?.focus();
    nextRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [answered, reduce]);

  const onChecks = step < total;
  const match = compared ? explainMatch(explained, run.explainAnswer, run.topic) : null;
  // Below three key words there is too little to compare fairly, so nothing is highlighted or suggested.
  const useful = match && match.keys >= 3 && explained.trim() ? match : null;
  const item = onChecks ? run.checks[step] : null;
  const checkSource = resolveEvidenceSource(item?.sourceReference, sourceReferences);
  const explanationSource = resolveEvidenceSource(run.explainSourceReference, sourceReferences);
  const answerReason = item && answered ? buildAnswerReason(item) : null;
  const unsupportedExplanation = answerReason?.qualityIssue === "unsupported_explanation";
  const headline = answerReason && answered ? feedbackHeadline(answerReason, { right: answered.right, unsure: answered.unsure, given: answered.given }) : null;
  // A headline that already says both words ("The word is “price”, not “quantity”.") makes the answer row and the
  // gap's reason a repeat; they stay in the trace for screen readers, out of sight.
  const headlineSaysIt = Boolean(headline) && (answerReason?.shape === "gap" || answerReason?.shape === "changed" || answerReason?.shape === "same");
  const chips = item ? gapChoices(item, run) : [];
  const nextLabel = step + 1 >= total
    ? (onChecksDone ? w.seeHow : w.sayIt)
    : firstStudySession ? w.nextIdea : w.next;

  /** A light tap on phones: a short one when right, a slightly longer one when not. Never on desktop. */
  function feel(ok: boolean) {
    try { if (window.matchMedia("(pointer: coarse)").matches) navigator.vibrate?.(ok ? 8 : [14, 40, 14]); } catch { /* Not supported: fine. */ }
  }

  function answer(value: string | number) {
    if (!item || answered) return;
    recordFirstResponse("quick_check");
    const verdict = checkAnswer(item, value, run.sentences.join(" "));
    const ok = verdict.right;
    if (typeof value === "number") setPicked(value);
    const given = typeof value === "number" ? item.choices?.[value] ?? "" : value.trim();
    const fromChips = typeof value === "string" && tapped !== null && tapped === value;
    // The very first line a student ever recalls: the moment to say what Kelus does with it.
    // Only an answer the student produced is a recall: a typed gap. A right pick from choices (which topic, which
    // word, true or false) is recognition, scored but not moving the line on.
    const recalled = item.kind === "cloze" && !fromChips;
    const firstEver = ok && recalled && known !== undefined && known.size === 0 && knownNow.length === 0;
    setAnswered({ right: ok, how: verdict.how, given, picked: fromChips, firstEver, elsewhere: ok ? null : whereAnswerBelongs(item, given, run.sentences) });
    if (ok) {
      setRight((count) => count + 1);
      if (recalled) { setKnownNow((list) => [...list, item.sourceQuote]); if (!known?.has(item.sourceQuote)) { setBump((count) => count + 1); setChange("+1"); } }
    } else {
      setMissed((list) => [...list, item.sourceQuote]);
      if (known?.has(item.sourceQuote) && !missed.includes(item.sourceQuote)) { setDrop((count) => count + 1); setChange("−1"); }
    }
    feel(ok);
    play(ok ? "right" : "miss");
  }

  // "Not sure" earns no credit, shows the answer, and does not break a streak: honesty should never cost more than guessing.
  function notSure() {
    if (!item || answered) return;
    recordFirstResponse("quick_check");
    setAnswered({ right: false, unsure: true });
    setUnsure((count) => count + 1);
    setMissed((list) => [...list, item.sourceQuote]);
    if (known?.has(item.sourceQuote) && !missed.includes(item.sourceQuote)) { setDrop((count) => count + 1); setChange("−1"); }
  }

  function recordFlag(reason: FlagReason) {
    if (!item) return;
    flagQuestion(item, reason, courseType);
    setFlag({ reason, sent: "no" });
  }

  function sendFlag(reason: FlagReason) {
    if (!item || !answered) return;
    setFlag({ reason, sent: "sending" });
    void sendFlaggedQuestion(item, reason, run.topic || "Warm-up", answered.given)
      .then((ok) => setFlag({ reason, sent: ok ? "yes" : "failed" }));
  }

  function next() {
    if (onChecksDone && step + 1 >= total) { onChecksDone({ right, total, missed, known: knownNow }); clearDraft(); return; }
    setAnswered(null); setPicked(null); setTyped(""); setTapped(null); setFlag(null); setAround(false);
    setStep((current) => current + 1);
  }

  // On a wide screen the notes open beside the comparison. On a phone they would land above it and push it away,
  // and the comparison already quotes the page; "Peek at the notes" in More still opens them.
  function compare() {
    // Key-mashing is neither an answer nor "I don't remember"; ask once, kindly, instead of grading it.
    if (explained.trim() && !looksLikeWords(explained)) { setNudge(true); return; }
    recordFirstResponse("own_words");
    setCompared(true);
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) onRevealSource();
  }

  function recordFirstResponse(format: "quick_check" | "own_words") {
    if (firstResponseTracked.current) return;
    firstResponseTracked.current = true;
    trackEvent({ name: "study_response_recorded", format, read_first: readFirst, course_type: courseType });
  }

  function finish(self: SelfGrade, at: number) {
    // The own-words answer is the truest recall: said from memory and nailed, with most of the page's key ideas in
    // it where they could be counted, its line counts as recalled.
    const explainedWell = self === "nailed" && (!useful || useful.hits / useful.keys >= 0.6) && !missed.includes(run.explainQuote);
    const knownLines = explainedWell && !knownNow.includes(run.explainQuote) ? [...knownNow, run.explainQuote] : knownNow;
    // Not said in full is not recalled yet: the line comes back first in the next warm-up, like a missed check.
    const missedLines = self !== "nailed" && !missed.includes(run.explainQuote) ? [...missed, run.explainQuote] : missed;
    onFinish({ right, total, unsure, self, explained, elapsedMs: Math.max(0, Math.round(at - started.current)), missed: missedLines, known: knownLines, coverage: useful ? { hits: useful.hits, keys: useful.keys } : null });
    clearDraft();
  }

  // In the explanation: ⌘↵ (Ctrl+Enter) compares; once compared, 1, 2 and 3 pick how close it was.
  useEffect(() => {
    if (item || reading >= 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (!compared && event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); compare(); return; }
      if (compared && !event.metaKey && !event.ctrlKey && !event.altKey && /^[123]$/.test(event.key) && !(event.target instanceof HTMLTextAreaElement)) {
        if (!explained.trim() && event.key !== "3") return;
        event.preventDefault(); finish(GRADES[Number(event.key) - 1].value, event.timeStamp);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, compared, explained, reading]);

  // Reading: Enter shows the next line, then opens the first check.
  useEffect(() => {
    if (reading < 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setReading(-1); return; }
      if (event.key !== "Enter" || event.metaKey || event.ctrlKey || event.altKey || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) return;
      event.preventDefault();
      setReading((current) => (current + 1 < lines.length ? current + 1 : -1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading, lines.length]);

  // 1-4 pick an option, like a quiz.
  useEffect(() => {
    if (!item || item.kind !== "choice" || answered || reading >= 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < (item.choices?.length ?? 0)) { event.preventDefault(); answer(index); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, answered, reading]);

  const motionProps = reduce
    ? {}
    // The next card replaces the old one in the same frame and settles from almost visible: nothing to wait for.
    : { initial: { opacity: 0.6, y: 4 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, transition: { duration: 0 } }, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const } };

  // The counter means something: lines of these notes answered correctly. It rises with a right answer to a line
  // you had not shown before, and falls when you miss one you had.
  const count = recalled == null ? null : Math.max(0, recalled + bump - drop);
  const readingNow = reading >= 0;
  const segments = (lines.length >= 2 ? 1 : 0) + total + (onChecksDone ? 0 : 1);
  const at = readingNow ? 0 : (lines.length >= 2 ? 1 : 0) + step;

  return (
    <div className={styles.run}>
      <header className={styles.top}>
        <ol className={styles.steps} aria-label={`Step ${Math.min(at + 1, segments)} of ${segments}`}>
          {Array.from({ length: segments }, (_, index) => (
            <li key={index} className={index < at ? styles.done : index === at ? styles.now : undefined} aria-current={index === at ? "step" : undefined} />
          ))}
        </ol>
        {/* While the question's answer is the topic's own name, the caption keeps only its place in the block. */}
        <div className={styles.context} data-topic-hidden={item && asksForTheTopic(item) && !answered ? "" : undefined}>{context}</div>
        {/* Nothing to count yet on a first visit: the count appears with the first correct line. */}
        {count == null || (count === 0 && !drop) ? <span /> : (
          <p className={styles.recall} aria-label={`${count} ${count === 1 ? "line" : "lines"} from your notes answered correctly`}>
            <span className={styles.recallNumber}>
              <motion.b key={count} initial={reduce || !(bump || drop) ? false : { y: bump ? -6 : 6, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0, duration: 0.35 }}>{count}</motion.b>
              <AnimatePresence>{(bump || drop) && !reduce ? <motion.i key={`${bump}-${drop}`} aria-hidden="true" className={change === "−1" ? styles.minus : undefined} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -12 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}>{change}</motion.i> : null}</AnimatePresence>
            </span>
            <span aria-hidden="true"><span className={styles.recallLong}>{count === 1 ? "line" : "lines"} answered correctly</span><span className={styles.recallShort}>correct</span></span>
          </p>
        )}
        {/* Sounds are on by default, the way a study app answers you; one tap here silences them for good. */}
        <button type="button" className={styles.mute} onClick={() => setSounds(!soundOn)} aria-pressed={!soundOn} aria-label={soundOn ? "Mute sounds" : "Turn sounds on"} title={soundOn ? "Mute sounds" : "Turn sounds on"}>
          <Octicon name={soundOn ? "unmute" : "mute"} size={16} />
        </button>
      </header>
      {/* Saving is silent when it works: the note appears only when something happened worth knowing. */}
      {persistenceKey && (saveFailed || resume.kind === "restored" || resume.kind === "changed" || resume.kind === "invalid") ? (
        <p className={`${styles.saveStatus}${saveFailed ? ` ${styles.saveError}` : resume.kind !== "restored" && resume.kind !== "changed" && resume.kind !== "invalid" ? ` ${styles.saveQuiet}` : ""}`} role={saveFailed ? "alert" : "status"} data-testid="status-study-save">
          {saveFailed
            ? "This browser couldn’t save your place. Keep this tab open, or enable browser storage."
            : resume.kind === "restored"
              ? "Resumed where you left off · saved on this device"
              : resume.kind === "changed"
                ? "The questions changed, so this topic has restarted. New progress is saved on this device."
                : resume.kind === "invalid"
                  ? "The previous draft couldn’t be restored. This run is saved on this device."
                  : "Saved on this device"}
        </p>
      ) : null}

      <AnimatePresence mode="wait" initial={false}>
        {readingNow ? (
          <motion.section key="read" className={`${styles.card} ${styles.thumb}`} {...motionProps} aria-label="Read it first">
            <h1 className={styles.prompt}>{w.readTitle}</h1>
            {firstStudySession ? <p className={styles.flowHint}>{w.flowHint}</p> : null}
            <ol className={styles.readLines} aria-live="polite">
              {lines.slice(0, reading + 1).map((line, index) => (
                <motion.li key={line} initial={reduce || index === 0 ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                  <Marked line={line} words={keyWordsIn(line, run)} />
                  <button type="button" className={styles.hideLine} aria-label="Hide this line: it isn’t worth reading" title="Not worth reading" onClick={() => {
                    hideLine(line);
                    const rest = lines.filter((kept) => kept !== line);
                    setLines(rest);
                    // Nothing left to read, or this was the last line shown: go on as Continue would.
                    if (rest.length < 1) setReading(-1);
                    else setReading((current) => Math.min(current, rest.length - 1));
                  }}><Cross size={10} /></button>
                </motion.li>
              ))}
            </ol>
            <div className={`${styles.row} ${styles.readRow}`}>
              <button type="button" className={`k-btn ${styles.primary}`} autoFocus key={reading} onClick={() => setReading((current) => (current + 1 < lines.length ? current + 1 : -1))}>
                {reading + 1 < lines.length ? w.continue : w.fromMemory}<kbd className={styles.key} aria-hidden="true">↵</kbd>
              </button>
              <ListenButton key={`listen-${reading}`} text={lines[reading] ?? ""} className={styles.listen} label={w.listen} stopLabel={w.stop} />
              <button type="button" className={styles.link} onClick={() => setReading(-1)}>{w.skip}<kbd className={styles.linkKey} aria-hidden="true">Esc</kbd></button>
            </div>
          </motion.section>
        ) : item ? (
          <motion.section
            key={`check-${step}`}
            // On a phone the answers wait at thumb height until one is picked, then rise above the verdict's sheet.
            className={`${styles.card}${item.kind === "choice" && !answered ? ` ${styles.thumb}` : ""}`}
            {...motionProps}
            aria-label={`Check ${step + 1} of ${total}`}
          >
            {checkSource.kind === "source" ? (
              <div className={styles.sourceCue}>
                <span>From your notes · {checkSource.reference.label}{checkSource.reference.locator ? ` · ${checkSource.reference.locator}` : ""}</span>
                {onShowLine ? (
                  <button
                    type="button"
                    onClick={() => onShowLine(item.sourceQuote, checkSource.reference)}
                  >
                    Open source
                  </button>
                ) : null}
              </div>
            ) : null}
            {/* "Which idea does this describe? “…”": the ask as a small line, the quoted line as the title. */}
            {(() => {
              const at = item.prompt.indexOf("“");
              const ask = at > 0 ? item.prompt.slice(0, at).trim() : "";
              return ask && item.kind === "choice"
                ? <h1 className={styles.prompt}><span className={styles.ask}>{ask}</span>{" "}{item.prompt.slice(at)}</h1>
                : <h1 className={styles.prompt}>{item.prompt}</h1>;
            })()}

            {item.kind === "choice" ? (
              <motion.div layout={!reduce} transition={{ layout: { type: "spring", bounce: 0, duration: 0.38 } }} className={`${styles.choices}${item.variant === "truefalse" ? ` ${styles.trueFalse}` : ""}`} role="group" aria-label="Choose one">
                {item.choices?.map((choice, index) => {
                  const isRight = answered && index === item.correctIndex;
                  const isWrong = answered && !isRight && index === picked;
                  const state = answered ? (isRight ? styles.right : isWrong ? styles.wrong : styles.dim) : "";
                  return (
                    <motion.button
                      key={choice}
                      type="button"
                      className={`${styles.choice} ${state}`}
                      disabled={Boolean(answered)}
                      onClick={() => answer(index)}
                      initial={reduce ? false : { opacity: 0, y: 6 }}
                      // The picked answer answers back: a right one lifts for a beat, a wrong one shakes its head.
                      animate={reduce || !answered || picked !== index ? { opacity: 1, y: 0, scale: 1, x: 0 } : answered.right ? { opacity: 1, y: 0, scale: [1, 1.025, 1], x: 0 } : { opacity: 1, y: 0, scale: 1, x: [0, -5, 5, -3, 3, 0] }}
                      transition={reduce ? { duration: 0 } : answered && picked === index ? { duration: 0.34, ease: "easeOut" } : { duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: 0.03 + index * 0.03 }}
                    >
                      {/* The number becomes the verdict in place, so the eye does not have to travel. */}
                      <kbd aria-hidden="true">{isRight ? <motion.span className={styles.kbdMark} initial={reduce ? false : { scale: 0.6, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }}><Tick size={12} /></motion.span> : isWrong ? <motion.span className={styles.kbdMark} initial={reduce ? false : { scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}><Cross size={12} /></motion.span> : index + 1}</kbd>
                      <span>{choice}</span>
                    </motion.button>
                  );
                })}
              </motion.div>
            ) : (
              <motion.form
                className={styles.gap}
                onSubmit={(event) => { event.preventDefault(); if (typed.trim()) answer(typed); }}
                // A wrong word gives a small shake, the way a lock refuses a key; a right one just settles.
                animate={!reduce && answered && !answered.right && !answered.unsure ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
                transition={{ duration: 0.32, ease: "easeOut" }}
              >
                <label htmlFor={`run-gap-${step}`} className="sr-only">Your answer, one word</label>
                <span className={styles.field} data-state={answered ? (answered.right ? "right" : answered.unsure ? "unsure" : "wrong") : undefined}>
                  <input id={`run-gap-${step}`} value={typed} onChange={(event) => { setTyped(event.target.value); setTapped(null); }} disabled={Boolean(answered)} autoComplete="off" autoFocus={!(touch && chips.length)} placeholder={w.oneWord} />
                  {answered?.right ? <motion.span className={styles.fieldMark} aria-hidden="true" initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 520, damping: 26 }}><Tick size={16} /></motion.span> : null}
                </span>
                {!answered ? <button type="submit" className={`k-btn ${styles.primary}`} disabled={!typed.trim()}>{w.check}<kbd className={styles.key} aria-hidden="true">↵</kbd></button> : null}
              </motion.form>
            )}
            {/* On a phone, typing one word is the slow part: tap the word instead. On a keyboard, recall it. */}
            {touch && !answered && chips.length ? (
              <div className={styles.chips} role="group" aria-label="Or tap the word">
                {/* A tap puts the word in the gap; Check commits it, so a slip of the thumb costs nothing. */}
                {chips.map((word) => (
                  <motion.button key={word} type="button" className={styles.chip} aria-pressed={tapped === word} onClick={() => { setTyped(word); setTapped(word); }}>{word}</motion.button>
                ))}
              </div>
            ) : null}

            {!answered ? <button type="button" className={styles.unsure} onClick={notSure}>{w.notSure}</button> : null}

            {answered ? (
              <motion.div
                className={`${styles.feedback} ${answered.right ? styles.ok : answered.unsure ? styles.isUnsure : styles.no}`}
                role="status"
                // On a phone the verdict's sheet can be swiped away to the next check: it follows the thumb, resists,
                // and springs back unless the swipe was long or quick enough. Next and Enter work as before.
                drag={touch && !reduce ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={{ left: 0.55, right: 0.08 }}
                dragSnapToOrigin
                onDragEnd={(_, info) => { if (info.offset.x < -80 || info.velocity.x < -500) next(); }}
                initial={reduce ? false : touch ? { opacity: 1, y: "100%" } : { opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={touch ? { type: "spring", bounce: 0, duration: 0.38 } : { type: "spring", bounce: 0, duration: 0.28 }}>
                {/* A small verdict, then one line that names the exact difference: the teacher's sentence, not a label. */}
                <span className={styles.verdict}>{answered.right ? <PackArt name="check" className={styles.mark} /> : null}{answered.unsure ? w.workItOut : answered.right ? (answered.firstEver ? w.firstRightShort : w.rightShort) : w.notQuiteYet}</span>
                {/* A wrong pick with nothing more to say gets no headline: "Not quite yet" above it already says "Not quite." */}
                {headline || answered.unsure || answered.right || item.kind === "cloze" ? <strong className={styles.headline}>{headline ?? (answered.unsure ? (item.kind === "cloze" ? w.itWas(item.modelAnswer) : w.lineFrom) : answered.right ? (answered.firstEver ? w.firstRight : w.right) : w.notQuiteWas(item.modelAnswer))}</strong> : null}
                {answered.right && answered.picked ? <p className={styles.pickedNote}>{w.pickedNote}</p> : null}
                <ol className={styles.reasoningTrace} aria-label="Your answer, the reason, and the source">
                  <li className={`${styles.reasoningStep}${headlineSaysIt ? " sr-only" : ""}`}>
                    <span className={styles.reasoningNumber} aria-hidden="true">1</span>
                    <div className={styles.reasoningBody}>
                      <p className={styles.answerRow}>
                        <span><span className={styles.reasoningLabel}>Your answer</span> {answered.given?.trim() || w.notSure}</span>
                        {answerReason?.answer && !answered.right ? <span><span className={styles.reasoningLabel}>{answerReason.grounded ? "Your notes" : "Suggested"}</span> <b>{answerReason.answer}</b></span> : null}
                      </p>
                    </div>
                  </li>
                  <li className={`${styles.reasoningStep}${headlineSaysIt ? " sr-only" : ""}`}>
                    <span className={styles.reasoningNumber} aria-hidden="true">2</span>
                    <div className={styles.reasoningBody}>
                      <span className={styles.reasoningLabel}>
                        {!answerReason?.grounded ? "What your notes say" : answered.right ? "Why this answer holds" : answered.unsure ? "How to reason it through" : "Why this answer doesn’t match"}
                      </span>
                      <p className={styles.reasoningText}>
                        {answerReason?.reason}
                      </p>
                      {unsupportedExplanation ? (
                        <div className={styles.flag}>
                          {flag !== null && typeof flag === "object" && flag.reason === "unsupported_explanation" ? (
                            <p className={styles.flagDone} role="status">
                              Flagged. Kelus won’t ask it again.{" "}
                              {flag.sent === "yes" ? "Sent to the Kelus team, thank you." : flag.sent === "sending" ? "Sending…" : (
                                <button type="button" className={styles.flagLink} onClick={() => sendFlag("unsupported_explanation")}>
                                  {flag.sent === "failed" ? "Couldn’t send. Try again" : "Send it to the Kelus team"}
                                </button>
                              )}
                            </p>
                          ) : (
                            <button type="button" className={styles.flagLink} onClick={() => recordFlag("unsupported_explanation")}>
                              Report this explanation
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </li>
                  <li className={`${styles.reasoningStep} ${styles.reasoningEvidence}`}>
                    <span className={styles.reasoningNumber} aria-hidden="true">3</span>
                    <div className={styles.reasoningBody}>
                      <div className={styles.evidenceHeading}>
                        <span className={styles.evidenceLabel}>{checkSource.kind === "source" ? "Evidence from your notes" : "Quoted passage"}</span>
                        {checkSource.kind === "source" ? (
                          <span className={styles.evidenceLocation}>
                            {checkSource.reference.label}{checkSource.reference.locator ? ` · ${checkSource.reference.locator}` : ""}
                          </span>
                        ) : null}
                      </div>
                      {around && linesAround(run, item.sourceQuote) ? (
                        <div className={styles.around} aria-label="This line in your notes">
                          {linesAround(run, item.sourceQuote)!.before ? <p>{linesAround(run, item.sourceQuote)!.before}</p> : null}
                          <p className={styles.aroundLine}>{linesAround(run, item.sourceQuote)!.line}</p>
                          {linesAround(run, item.sourceQuote)!.after ? <p>{linesAround(run, item.sourceQuote)!.after}</p> : null}
                        </div>
                      ) : <p className={styles.quote}>“{item.sourceQuote}”</p>}
                      {checkSource.kind === "source" && !onShowLine && !around && linesAround(run, item.sourceQuote) ? (
                        <button
                          data-testid="source-evidence-jump"
                          type="button"
                          className={styles.sourceJump}
                          onClick={() => setAround(true)}
                        >
                          {w.showInNotes}<ArrowRight aria-hidden="true" />
                        </button>
                      ) : (
                        <EvidenceSourceAction
                          resolution={checkSource}
                          quote={item.sourceQuote}
                          label={w.seeOnPage}
                          onShowLine={(quote, source) => {
                            setAround(true);
                            onShowLine?.(quote, source);
                          }}
                        />
                      )}
                    </div>
                  </li>
                </ol>
                {/* When this line comes back, in words. Not for a shrug: nothing was tried. */}
                {answered.unsure ? null : <LineMove quote={item.sourceQuote} right={answered.right} recall={item.kind === "cloze" && !answered.picked} nowIso={new Date().toISOString()} />}
                {/* Accepted on purpose, and said so: the student sees the notes' own word, not a silent pass. */}
                {answered.right && item.kind === "cloze" && answered.how && answered.how !== "exact" ? <p className={styles.accepted}>{acceptedNote(answered.how, item.modelAnswer)}</p> : null}
                {answered.firstEver ? <p className={styles.firstNote}><PackArt name="ranking" className={styles.firstArt} size={64} /><span>A short review is planned in a few days to help this idea stay familiar.</span></p> : null}
                {answered.elsewhere ? (
                  <div className={styles.elsewhere}>
                    <span>{answered.given && !/\s/.test(answered.given) ? w.belongsWord(answered.given) : w.belongs}</span>
                    <p>“{answered.elsewhere}”</p>
                  </div>
                ) : null}
                <button ref={nextRef} type="button" className={`k-btn ${styles.primary}`} onClick={next}>{nextLabel} <ArrowRight /></button>
                {/* The swipe is said once, on the first answer of a run, where a thumb would try it. */}
                {touch && step === 0 && !reduce ? <p className={styles.swipeHint} aria-hidden="true">or swipe this left</p> : null}
                {/* The quiet tools, in one row under the way on: hear the line, or flag a bad question. A bad question is
                    the student's to call. One tap counts it and drops it from later runs; its words go to the Kelus team
                    only on a second, explicit tap. */}
                <div className={styles.lineTools}>
                  <ListenButton key={`listen-q-${step}`} text={item.sourceQuote} className={styles.listen} label={w.listen} stopLabel={w.stop} />
                  {!unsupportedExplanation ? <div className={styles.flag}>
                    {flag === null ? (
                      <button type="button" className={styles.flagLink} onClick={() => setFlag("choosing")}>{w.flag}</button>
                    ) : flag === "choosing" ? (
                      <div className={styles.flagReasons} role="group" aria-label="What is wrong with this question?">
                        {FLAG_REASONS.filter((reason) => reason.value !== "unsupported_explanation").map((reason) => (
                          <button key={reason.value} type="button" className={styles.flagReason} onClick={() => recordFlag(reason.value)}>{reason.label}</button>
                        ))}
                        <button type="button" className={styles.flagLink} onClick={() => setFlag(null)}>Cancel</button>
                      </div>
                    ) : (
                      <p className={styles.flagDone} role="status">
                        Flagged. Kelus won’t ask it again.{" "}
                        {flag.sent === "yes" ? "Sent to the Kelus team, thank you." : flag.sent === "sending" ? "Sending…" : (
                          <button type="button" className={styles.flagLink} onClick={() => sendFlag(flag.reason)}>
                            {flag.sent === "failed" ? "Couldn’t send. Try again" : "Send it to the Kelus team"}
                          </button>
                        )}
                      </p>
                    )}
                  </div> : null}
                </div>
              </motion.div>
            ) : null}
          </motion.section>
        ) : (
          <motion.section key="explain" className={styles.card} {...motionProps} aria-label="Explain it">
            <h1 className={styles.prompt}>{run.explainPrompt}</h1>
            <label htmlFor="run-explain" className="sr-only">Your explanation</label>
            {!compared ? <textarea id="run-explain" className={styles.area} rows={4} autoFocus value={explained} onChange={(event) => { setExplained(event.target.value); setNudge(false); }} placeholder={w.writeIt} /> : null}
            {nudge && !compared ? <p className={styles.nudge} role="alert">That doesn’t look like an answer yet. Write a few words from memory, or tap “I don’t remember”.</p> : null}
            {!compared ? (
              <div className={styles.row}>
                <button type="button" className={`k-btn ${styles.primary}`} onClick={compare}>{w.compare}<kbd className={styles.key} aria-hidden="true">{modKey}↵</kbd></button>
                {!explained.trim() || nudge ? <button type="button" className={styles.link} onClick={() => { recordFirstResponse("own_words"); setExplained(""); setNudge(false); setCompared(true); }}>{w.dontRemember}</button> : null}
              </div>
            ) : (
              <motion.div className={styles.compare} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                <div>
                  <span>{w.yourWords}</span>
                  <p>{explained.trim() || "Nothing written."}</p>
                </div>
                <div>
                  <span>{w.pageSays}</span>
                  <p>
                    {useful
                      ? useful.parts.map((part, index) => (part.key ? <mark key={index} className={part.hit ? styles.hit : part.flip ? styles.flip : styles.miss} title={part.flip ? `You wrote “${part.flip}”` : undefined} style={{ animationDelay: `${120 + index * 18}ms` }}>{part.text}</mark> : part.text))
                      : run.explainAnswer}
                  </p>
                </div>
                {useful ? (
                  // How much of the page's idea you said, as a meter and the words you left out as chips: no sentence.
                  <div className={styles.coverage} role="status" aria-label={`You used ${useful.hits} of ${useful.keys} key words.${useful.missed.length ? ` Left out: ${useful.missed.slice(0, 3).join(", ")}.` : ""}`}>
                    <span className={styles.meter} aria-hidden="true">
                      <b>{useful.hits}<small>/{useful.keys}</small></b>
                      <span className={styles.meterTrack}><motion.i initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: useful.keys ? useful.hits / useful.keys : 0 }} transition={{ type: "spring", bounce: 0, duration: 0.7, delay: 0.2 }} /></span>
                      <span>{w.keyWords}</span>
                    </span>
                    {useful.missed.length ? (
                      <span className={styles.missedWords} aria-hidden="true">
                        <em>{w.leftOut}</em>
                        {useful.missed.slice(0, 3).map((word, index) => <motion.span key={word} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + index * 0.06, duration: 0.2 }}>{word}</motion.span>)}
                      </span>
                    ) : useful.flipped.length ? null : <span className={styles.allIn} aria-hidden="true"><Octicon name="check-circle" size={14} /> {w.allIn}</span>}
                    {useful.flipped.length ? <p className={styles.flipNote}>Check the direction: you wrote <b>{useful.flipped[0].said}</b> where your notes say <b>{useful.flipped[0].page}</b>.</p> : null}
                  </div>
                ) : null}
                {run.explainQuote ? (
                  <div className={styles.evidence} data-testid="text-explanation-evidence" data-compact={run.explainQuote === run.explainAnswer ? "" : undefined}>
                    <span>{explanationSource.kind === "source" ? w.evidence : "Quoted passage"}{explanationSource.kind === "source" ? ` · ${explanationSource.reference.label}${explanationSource.reference.locator ? ` · ${explanationSource.reference.locator}` : ""}` : ""}</span>
                    {/* The page's line is already shown just above, marked word by word: only its place in the notes is new here. */}
                    {run.explainQuote !== run.explainAnswer ? <p className={styles.quote}>“{run.explainQuote}”</p> : null}
                    <EvidenceSourceAction
                      resolution={explanationSource}
                      quote={run.explainQuote}
                      onShowLine={onShowLine}
                      testId="button-show-explanation-source"
                      label={w.seeOnPage}
                    />
                  </div>
                ) : null}
                {!explained.trim() ? (
                  <div className={styles.grades}>
                    <p>No answer to rate yet. This line will come back.</p>
                    <button type="button" onClick={(event) => finish("missed", event.timeStamp)}>Continue <kbd className={styles.gradeKey} aria-hidden="true">3</kbd></button>
                  </div>
                ) : (
                  <fieldset className={styles.grades}>
                    <legend>{w.howClose}</legend>
                    {GRADES.map((grade) => (
                      <button key={grade.value} type="button" className={useful?.suggest === grade.value ? styles.suggested : undefined} onClick={(event) => finish(grade.value, event.timeStamp)}>
                        <span className={styles.gradeMark} data-grade={grade.value} aria-hidden="true">{grade.value === "nailed" ? <Octicon name="check" size={16} /> : grade.value === "missed" ? <Octicon name="x-circle" size={16} /> : <i />}</span>
                        <strong>{w[grade.value]}{useful?.suggest === grade.value ? <em>{w.suggested}</em> : null}</strong>
                        <kbd className={styles.gradeKey} aria-hidden="true">{GRADES.indexOf(grade) + 1}</kbd>
                        <small>{w[`${grade.value}Hint` as const]}</small>
                      </button>
                    ))}
                  </fieldset>
                )}
              </motion.div>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
