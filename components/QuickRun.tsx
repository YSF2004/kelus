"use client";

import { ArrowRight, Cross, Tick } from "@/components/Marks";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
import { noteLanguage } from "@/domain/note-language";
import { lineMove } from "@/domain/leitner";
import type { MissedLine } from "@/domain/return-visit";
import styles from "./QuickRun.module.css";

/** `missed` holds the page lines behind the checks that were wrong or not sure, so the result can point back to them. */
export type QuickRunResult = { right: number; total: number; unsure: number; self: SelfGrade; explained: string; elapsedMs: number; missed: string[]; /** The lines behind the checks that were right. */ known: string[]; /** Key ideas from the notes the explanation used, when there were enough to compare. */ coverage?: { hits: number; keys: number } | null };

const noSubscribe = () => () => {};
const modKeyNow = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl ");
const touchNow = () => window.matchMedia("(pointer: coarse)").matches;

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

/** The words of a line worth marking for this question: the answer itself when the line holds it. */
function Highlight({ line, words }: { line: string; words: string[] }) {
  const usable = words.filter((word) => word && word.length >= 3 && line.toLocaleLowerCase().includes(word.toLocaleLowerCase()));
  if (!usable.length) return <>{line}</>;
  const pattern = new RegExp(`(${usable.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "giu");
  return <>{line.split(pattern).map((part, index) => (index % 2 ? <mark key={index} className={styles.hl}>{part}</mark> : part))}</>;
}

/** Neighbouring key words the answer used, read as phrases: "hydrophobic core", not two separate words. */
function saidPhrases(parts: Array<{ text: string; key: boolean; hit: boolean }>) {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => { if (run.length) out.push(run.join(" ")); run = []; };
  for (const part of parts) {
    if (/^\s+$/.test(part.text)) continue;
    if (part.key && part.hit) run.push(part.text.replace(/[^\p{L}\p{N}-]+/gu, ""));
    else flush();
  }
  flush();
  // A single short word ("lets", "cell") is not an idea from the notes on its own: only phrases and real terms count.
  return [...new Set(out.map((phrase) => phrase.toLocaleLowerCase()))].filter((phrase) => phrase.includes(" ") || phrase.length >= 6);
}

const listed = (items: string[]) => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;

export function QuickRun({ run, onRevealSource, onShowLine, onFinish, onChecksDone, context, readFirst = false, known, recalled, courseType = "real", knownLines = [], nowIso, onLine }: {
  run: Run;
  /** The lines recalled so far, with their streaks: where each answer moves its line in the five boxes. */
  knownLines?: MissedLine[];
  nowIso?: string;
  /** Saves one answer's lines the moment it is given, so closing mid-topic keeps what was answered. */
  onLine?: (quotes: string[], result: "right" | "missed") => void;
  courseType?: "real" | "sample";
  /** A topic met for the first time: its lines are read, one at a time, before anything is asked. */
  readFirst?: boolean;
  /** The lines already recalled, and how many of the course's lines that is: the counter in the top bar. */
  known?: Set<string>;
  recalled?: number;
  onRevealSource: () => void;
  /** Open the original page with this line circled on it. Only when there is an original page to open. */
  onShowLine?: (quote: string) => void;
  onFinish: (result: QuickRunResult) => void;
  /** A warm-up is checks only: given this, the last Next ends the run instead of opening the explanation. */
  onChecksDone?: (result: { right: number; total: number; missed: string[]; known: string[] }) => void;
  /** Which topic this is, set beside the progress bar as its caption rather than as a label above the question. */
  context?: ReactNode;
}) {
  const reduce = useReducedMotion() === true;
  const modKey = useSyncExternalStore(noSubscribe, modKeyNow, () => "⌘");
  const touch = useSyncExternalStore(noSubscribe, touchNow, () => false);
  const soundOn = useSyncExternalStore(subscribeSounds, soundsOn, () => false);
  // The buttons and feedback speak the notes' language, like the questions do.
  const w = uiWords(noteLanguage(run.sentences.join(" ")));
  // Lines a student hid as not worth reading stay out of the reading for good, on this device.
  const [lines, setLines] = useState(() => (readFirst ? readingLines(run).filter((line) => !hiddenLines().has(line)) : []));
  // -1 once reading is over (or there is nothing to read); otherwise the last line shown so far.
  // Reading the lines first is offered, never imposed: the first question opens at once, with "Read the source first"
  // beside it for anyone who wants the page before answering.
  const [reading, setReading] = useState(-1);
  const [knownNow, setKnownNow] = useState<string[]>([]);
  const [change, setChange] = useState<"+1" | "−1">("+1");
  const [bump, setBump] = useState(0);
  const started = useRef(0);
  const firstResponseTracked = useRef(false);
  const total = run.checks.length;
  // The own-words question opens the run when the notes hold one (step 0); otherwise it closes it (step `total`).
  const explainFirst = Boolean(run.explainFirst) && !onChecksDone;
  const [step, setStep] = useState(0);
  const checkAt = explainFirst ? step - 1 : step;
  // The explanation's self-rating and coverage, kept while the checks after it are answered.
  const [explainDone, setExplainDone] = useState<null | { self: SelfGrade; coverage: { hits: number; keys: number } | null }>(null);
  const now = nowIso ?? new Date().toISOString();
  const move = (quote: string, result: "right" | "missed" | "review") => lineMove({ quote, result, known: knownLines, nowIso: now });
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [answered, setAnswered] = useState<null | { right: boolean; how?: CheckVerdict["how"]; unsure?: boolean; elsewhere?: string | null; given?: string; picked?: boolean; firstEver?: boolean }>(null);
  // A word tapped from four is recognised, not recalled: it earns the check, never a line on the recall count.
  const [tapped, setTapped] = useState<string | null>(null);
  const [drop, setDrop] = useState(0);
  // Flagging a question: closed, choosing a reason, or flagged (and maybe sent to the Kelus team).
  // "Show it in your notes": the line asked about, between the lines around it.
  const [around, setAround] = useState(false);
  const [flag, setFlag] = useState<null | "choosing" | { reason: FlagReason; sent: "no" | "sending" | "yes" | "failed" }>(null);
  const [missed, setMissed] = useState<string[]>([]);
  const [unsure, setUnsure] = useState(0);
  const [right, setRight] = useState(0);
  const [explained, setExplained] = useState("");
  const [compared, setCompared] = useState(false);
  const [nudge, setNudge] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { started.current = performance.now(); }, []);
  useEffect(() => {
    if (!answered) return;
    nextRef.current?.focus();
    nextRef.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [answered, reduce]);

  const onChecks = checkAt >= 0 && checkAt < total;
  const match = compared ? explainMatch(explained, run.explainAnswer, `${run.topic} ${run.explainGiven ?? ""}`.trim()) : null;
  // Below three key words there is too little to compare fairly, so nothing is highlighted or suggested.
  const useful = match && match.keys >= 3 && explained.trim() ? match : null;
  const item = onChecks ? run.checks[checkAt] : null;
  const chips = item ? gapChoices(item, run) : [];

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
    const firstEver = ok && !fromChips && known !== undefined && known.size === 0 && knownNow.length === 0;
    setAnswered({ right: ok, how: verdict.how, given, picked: fromChips, firstEver, elsewhere: ok ? null : whereAnswerBelongs(item, given, run.sentences) });
    // A word tapped from four is recognised, not recalled: it moves no line, up or down.
    if (!(ok && fromChips)) onLine?.([item.sourceQuote], ok ? "right" : "missed");
    if (ok) {
      setRight((count) => count + 1);
      if (!fromChips) { setKnownNow((list) => [...list, item.sourceQuote]); if (!known?.has(item.sourceQuote)) { setBump((count) => count + 1); setChange("+1"); } }
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
    onLine?.([item.sourceQuote], "missed");
    setUnsure((count) => count + 1);
    setMissed((list) => [...list, item.sourceQuote]);
    if (known?.has(item.sourceQuote) && !missed.includes(item.sourceQuote)) { setDrop((count) => count + 1); setChange("−1"); }
  }

  function next() {
    if (onChecksDone && step + 1 >= total) { onChecksDone({ right, total, missed, known: knownNow }); return; }
    // The own-words question came first: the last check ends the run, with the explanation's rating kept.
    if (explainFirst && checkAt + 1 >= total) { finishWith(explainDone?.self ?? "partly", explainDone?.coverage ?? null, performance.now()); return; }
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
    // A weak or unmeasurable answer is saved now, as the comparison shows it: closing before rating it keeps it.
    // Only a rating can raise a line, and only with the comparison's agreement.
    const lines = run.explainLines ?? [];
    const now = explainMatch(explained, run.explainAnswer, `${run.topic} ${run.explainGiven ?? ""}`.trim());
    if (lines.length && !(explained.trim() && now.keys >= 3 && now.suggest === "nailed")) onLine?.(lines, "missed");
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches) onRevealSource();
  }

  function recordFirstResponse(format: "quick_check" | "own_words") {
    if (firstResponseTracked.current) return;
    firstResponseTracked.current = true;
    trackEvent({ name: "study_response_recorded", format, read_first: readFirst, course_type: courseType });
  }

  function finishWith(self: SelfGrade, coverage: { hits: number; keys: number } | null, at: number) {
    onFinish({ right, total, unsure, self, explained, elapsedMs: Math.max(0, Math.round(at - started.current)), missed, known: knownNow, coverage });
  }

  /** The explanation rated: its lines saved by what the comparison showed, then on to the checks or the end. */
  function finish(self: SelfGrade, at: number) {
    const coverage = useful ? { hits: useful.hits, keys: useful.keys } : null;
    const lines = run.explainLines?.length ? run.explainLines : [];
    // Only the comparison can put a line in a higher box, and only when the student agrees; a rating alone never does.
    if (lines.length) onLine?.(lines, useful && useful.suggest === "nailed" && self === "nailed" ? "right" : "missed");
    if (!explainFirst || total === 0) { finishWith(self, coverage, at); return; }
    setExplainDone({ self, coverage });
    setCompared(false);
    setStep(1);
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

      <AnimatePresence mode="wait" initial={false}>
        {readingNow ? (
          <motion.section key="read" className={styles.card} {...motionProps} aria-label="Read it first">
            <h1 className={styles.prompt}>{w.readTitle}</h1>
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
          <motion.section key={`check-${step}`} className={styles.card} {...motionProps} aria-label={`Check ${checkAt + 1} of ${total}`}>
            {step === 0 && run.explainNote ? <p className={styles.thin}>{run.explainNote}</p> : null}
            {/* "Which idea does this describe? “…”": the ask as a small line, the quoted line as the title. */}
            {(() => {
              const at = item.prompt.indexOf("“");
              const ask = at > 0 ? item.prompt.slice(0, at).trim() : "";
              return ask && item.kind === "choice"
                ? <h1 className={styles.prompt}><span className={styles.ask}>{ask}</span>{item.prompt.slice(at)}</h1>
                : <h1 className={styles.prompt}>{item.prompt}</h1>;
            })()}

            {item.kind === "choice" ? (
              <div className={styles.choices} role="group" aria-label="Choose one">
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
                      whileTap={reduce || answered ? undefined : { scale: 0.98 }}
                    >
                      {/* The number becomes the verdict in place, so the eye does not have to travel. */}
                      <kbd aria-hidden="true">{isRight ? <motion.span className={styles.kbdMark} initial={reduce ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.3 }}><Tick size={12} /></motion.span> : isWrong ? <Cross size={12} /> : index + 1}</kbd>
                      <span>{choice}</span>
                    </motion.button>
                  );
                })}
              </div>
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
                  <motion.button key={word} type="button" className={styles.chip} aria-pressed={tapped === word} onClick={() => { setTyped(word); setTapped(word); }} whileTap={reduce ? undefined : { scale: 0.96 }}>{word}</motion.button>
                ))}
              </div>
            ) : null}

            {!answered ? (
              <div className={styles.beforeAnswer}>
                <button type="button" className={styles.unsure} onClick={notSure}>{w.notSure}</button>
                {step === 0 && lines.length >= 2 ? <button type="button" className={styles.unsure} onClick={() => setReading(0)}>{w.readFirst}</button> : null}
              </div>
            ) : null}

            {answered ? (
              <motion.div className={`${styles.feedback} ${answered.right ? styles.ok : answered.unsure ? styles.unsure : styles.no}`} role="status" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>
                <strong>{answered.right ? <PackArt name="check" className={styles.mark} /> : null}{answered.unsure ? (item.kind === "cloze" ? w.itWas(item.modelAnswer) : w.lineFrom) : answered.right ? (answered.picked ? w.picked : answered.firstEver ? w.firstRight : w.right) : item.kind === "cloze" ? w.notQuiteWas(item.modelAnswer) : w.notQuite}</strong>
                {/* The mistaken idea in one sentence, from the notes alone: what this line is about, and what was picked. */}
                {!answered.right && !answered.unsure && item.kind === "choice" && item.modelAnswer.split(/\s+/).length <= 5 ? (
                  <p className={styles.why}>This line is about <b>{item.modelAnswer}</b>{answered.given && answered.given !== item.modelAnswer ? <>, not {answered.given}</> : null}.{answered.elsewhere ? <> {answered.given} is a different line of your notes, shown below.</> : null}</p>
                ) : null}
                {/* The supporting line, with the words that answer the question marked. */}
                {around && linesAround(run, item.sourceQuote) ? (
                  <div className={styles.around} aria-label="This line in your notes">
                    {linesAround(run, item.sourceQuote)!.before ? <p>{linesAround(run, item.sourceQuote)!.before}</p> : null}
                    <p className={styles.aroundLine}><Highlight line={linesAround(run, item.sourceQuote)!.line} words={item.modelAnswer.split(/\s+/).length <= 5 ? [item.modelAnswer] : []} /></p>
                    {linesAround(run, item.sourceQuote)!.after ? <p>{linesAround(run, item.sourceQuote)!.after}</p> : null}
                  </div>
                ) : <p className={styles.quote}>“<Highlight line={item.sourceQuote} words={item.modelAnswer.split(/\s+/).length <= 5 ? [item.modelAnswer] : []} />”</p>}
                {answered.elsewhere ? (
                  <div className={styles.elsewhere}>
                    <span>{answered.given && !/\s/.test(answered.given) ? w.belongsWord(answered.given) : w.belongs}</span>
                    <p>“{answered.elsewhere}”</p>
                  </div>
                ) : null}
                {/* Accepted on purpose, and said so: the student sees the notes' own word, not a silent pass. */}
                {answered.right && item.kind === "cloze" && answered.how && answered.how !== "exact" ? <p className={styles.accepted}>{acceptedNote(answered.how, item.modelAnswer)}</p> : null}
                {/* What Kelus does with this answer, from the same rule the five boxes use. */}
                <p className={styles.consequence} data-result={answered.right ? "right" : "missed"}>
                  {answered.right && answered.picked ? "Tapped from four words, so it counts for this check but doesn’t move the line." : move(item.sourceQuote, answered.right ? "right" : "missed").text}
                </p>
                <div className={styles.lineTools}>
                  <ListenButton key={`listen-q-${step}`} text={item.sourceQuote} className={styles.listen} label={w.listen} stopLabel={w.stop} />
                  {!answered.right && onShowLine ? <button type="button" className={styles.listen} onClick={() => onShowLine(item.sourceQuote)}>{w.seeOnPage}</button> : !answered.right && !around && linesAround(run, item.sourceQuote) ? <button type="button" className={styles.listen} onClick={() => setAround(true)}>{w.showInNotes}</button> : null}
                </div>
                <button ref={nextRef} type="button" className={`k-btn ${styles.primary}`} onClick={next}>{checkAt + 1 >= total ? (onChecksDone || explainFirst ? w.seeHow : w.sayIt) : w.next} <ArrowRight /></button>
                {/* A bad question is the student's to call. One tap counts it and drops it from later runs; its words
                    go to the Kelus team only on a second, explicit tap. */}
                <div className={styles.flag}>
                  {flag === null ? (
                    <button type="button" className={styles.flagLink} onClick={() => setFlag("choosing")}>{w.flag}</button>
                  ) : flag === "choosing" ? (
                    <div className={styles.flagReasons} role="group" aria-label="What is wrong with this question?">
                      {FLAG_REASONS.map((reason) => (
                        <button key={reason.value} type="button" className={styles.flagReason} onClick={() => { flagQuestion(item, reason.value); setFlag({ reason: reason.value, sent: "no" }); }}>{reason.label}</button>
                      ))}
                      <button type="button" className={styles.flagLink} onClick={() => setFlag(null)}>Cancel</button>
                    </div>
                  ) : (
                    <p className={styles.flagDone} role="status">
                      Flagged. Kelus won’t ask it again.{" "}
                      {flag.sent === "yes" ? "Sent to the Kelus team, thank you." : flag.sent === "sending" ? "Sending…" : (
                        <button type="button" className={styles.flagLink} onClick={() => {
                          const reason = flag.reason;
                          setFlag({ reason, sent: "sending" });
                          void sendFlaggedQuestion(item, reason, run.topic || "Warm-up", answered.given).then((ok) => setFlag({ reason, sent: ok ? "yes" : "failed" }));
                        }}>{flag.sent === "failed" ? "Couldn’t send. Try again" : "Send it to the Kelus team"}</button>
                      )}
                    </p>
                  )}
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
                {!explained.trim() || nudge ? <button type="button" className={styles.link} onClick={() => { recordFirstResponse("own_words"); setExplained(""); setNudge(false); setCompared(true); if (run.explainLines?.length) onLine?.(run.explainLines, "missed"); }}>{w.dontRemember}</button> : null}
                {explainFirst && step === 0 && lines.length >= 2 ? <button type="button" className={styles.link} onClick={() => setReading(0)}>{w.readFirst}</button> : null}
              </div>
            ) : (
              <motion.div className={styles.compare} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
                {(() => {
                  const said = useful ? saidPhrases(useful.parts) : [];
                  const lines = run.explainLines?.length ? run.explainLines : [run.explainQuote];
                  const result: "right" | "missed" | "review" = !explained.trim() ? "missed" : !useful ? "review" : useful.suggest === "nailed" ? "right" : "missed";
                  const plural = lines.length > 1;
                  const said2 = (text: string) => (plural ? text.replace(/^This line/, "These lines").replace(/\b(moves|stays|goes|comes)\b/g, (verb) => verb.slice(0, -1)).replace(/the line /, "the lines ") : text);
                  const consequence = said2(move(lines[0], result).text);
                  const at = useful ? run.explainQuote.indexOf(run.explainAnswer) : -1;
                  return (
                    <>
                      <strong className={styles.verdict} data-result={result}>{!explained.trim() ? "Nothing written yet." : !useful ? "Needs review." : useful.suggest === "nailed" ? "Your answer has the key ideas." : useful.suggest === "partly" ? "Partly there." : "Not yet."}</strong>
                      {/* 1. What was right, in the notes' own words. */}
                      {said.length ? <p className={styles.gotRight}>You said {listed(said.slice(0, 4).map((phrase) => `“${phrase}”`))}.</p> : null}
                      {/* 2. What is missing or reversed, in one or two sentences. */}
                      {useful && useful.missed.length ? <p className={styles.why}>Your answer leaves out {listed(useful.missed.slice(0, 3).map((phrase) => `“${phrase}”`))}.</p> : null}
                      {useful?.flipped.length ? <p className={styles.why}>Check the direction: you wrote <b>{useful.flipped[0].said}</b> where your notes say <b>{useful.flipped[0].page}</b>.</p> : null}
                      {!useful && explained.trim() ? <p className={styles.why}>There are too few key words in this part of your notes to compare your answer fairly, so Kelus won’t grade it. Compare it with the passage yourself.</p> : null}
                      <div className={styles.yours}>
                        <span>{w.yourWords}</span>
                        <p>{explained.trim() || "Nothing written."}</p>
                      </div>
                      {/* 3. The passage it is checked against, with the key words marked: used, left out, or reversed. */}
                      <div className={styles.passage}>
                        <span>{w.pageSays}</span>
                        <p>
                          {useful && at >= 0 ? (
                            <>
                              {run.explainQuote.slice(0, at)}
                              {useful.parts.map((part, index) => (part.key ? <mark key={index} className={part.hit ? styles.hit : part.flip ? styles.flip : styles.miss} title={part.flip ? `You wrote “${part.flip}”` : undefined} style={{ animationDelay: `${80 + index * 14}ms` }}>{part.text}</mark> : part.text))}
                              {run.explainQuote.slice(at + run.explainAnswer.length)}
                            </>
                          ) : run.explainQuote}
                        </p>
                      </div>
                      {/* 4. What Kelus does with it. A right answer needs the student's agreement as well as the comparison. */}
                      <p className={styles.consequence} data-result={result}>{result === "right" ? `Mark it “Nailed it” and ${consequence.charAt(0).toLowerCase()}${consequence.slice(1)}` : consequence}</p>
                    </>
                  );
                })()}
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
