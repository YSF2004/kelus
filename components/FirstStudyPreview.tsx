"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { buildFirstStudyExample } from "@/lib/first-study-preview";
import styles from "./FirstStudyPreview.module.css";

/**
 * An optional, self-contained sample for first use: one real question built by the same quick-run logic from the
 * built-in Microeconomics example, its answer, why, and the exact line it comes from. Nothing here is saved, synced
 * or sent to analytics: state lives in this component only and is gone when it closes.
 */
type Answer = { kind: "picked"; index: number } | { kind: "unsure" } | null;

export function FirstStudyPreview() {
  const data = useMemo(() => buildFirstStudyExample(), []);
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState<Answer>(null);
  const [showSource, setShowSource] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const id = useId();
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open]);
  if (!data) return <p className={styles.note}>The sample is unavailable. You can still add your own notes below.</p>;
  const { check, sentences, title, topic } = data;
  const choices = check.choices ?? [];
  const right = answer?.kind === "picked" && answer.index === check.correctIndex;
  const evidenceId = `${id}-evidence`;
  const isQuote = (sentence: string) => sentence.trim() === check.sourceQuote.trim();

  return (
    <section className={styles.preview} aria-labelledby={`${id}-title`}>
      {!open ? (
        <div className={styles.invite}>
          <p id={`${id}-title`} className={styles.inviteText}>
            See a question, its explanation and the exact source evidence.
          </p>
          <button ref={trigger} type="button" className={styles.textButton} aria-expanded={false} aria-controls={`${id}-panel`} onClick={() => setOpen(true)}>
            Try a sample question
          </button>
        </div>
      ) : (
        <div id={`${id}-panel`} className={styles.panel}>
          <div className={styles.head}>
            <span className={styles.badge}>Sample</span>
            <h2 ref={heading} tabIndex={-1} id={`${id}-title`} className={styles.title}>From the built-in Microeconomics example</h2>
            <button type="button" className={styles.close} onClick={() => {
              setOpen(false);
              setAnswer(null);
              setShowSource(false);
              requestAnimationFrame(() => trigger.current?.focus());
            }}>
              Close sample
            </button>
          </div>
          <p className={styles.note}>Not your notes, and nothing here is saved. This example shows how an answer connects back to a source.</p>

          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={`${styles.label} ${styles.source}`}>Source</span>
              <p className={styles.sourceLine}><span className={styles.topic}>{topic}</span> · {title}</p>
            </li>
            <li className={styles.step}>
              <span className={`${styles.label} ${styles.recall}`}>Question</span>
              <fieldset className={styles.question} disabled={right}>
                <legend className={styles.prompt}>{check.prompt}</legend>
                <div className={styles.choices}>
                  {choices.map((choice, index) => {
                    const picked = answer?.kind === "picked" && answer.index === index;
                    return (
                      <button
                        key={choice}
                        type="button"
                        aria-pressed={picked}
                        className={`${styles.choice}${picked ? (right ? ` ${styles.isRight}` : ` ${styles.isWrong}`) : ""}`}
                        onClick={() => setAnswer({ kind: "picked", index })}
                      >
                        {choice}
                      </button>
                    );
                  })}
                  <button type="button" aria-pressed={answer?.kind === "unsure"} className={`${styles.choice} ${styles.unsure}${answer?.kind === "unsure" ? ` ${styles.isPicked}` : ""}`} onClick={() => setAnswer({ kind: "unsure" })}>
                    Not sure
                  </button>
                </div>
              </fieldset>
            </li>

            <li className={styles.step} aria-live="polite">
              {answer ? (
                <div className={styles.feedback}>
                  <span className={`${styles.label} ${styles.route}`}>{right ? "That matches the source" : answer.kind === "unsure" ? "Let’s check the source" : "Compare with the source"}</span>
                  {right ? (
                    <p>Your answer: <strong>{choices[answer.index]}</strong>.</p>
                  ) : answer.kind === "unsure" ? (
                    <p>You chose “Not sure”. You can use the explanation and highlighted line to understand the answer.</p>
                  ) : (
                    <p>Your answer: <strong>{choices[answer.index]}</strong>. The supported answer is <strong>{check.modelAnswer}</strong>. Your choice stays visible while you compare it with the source.</p>
                  )}
                  {answer.kind === "unsure" ? <p>Supported answer: <strong>{check.modelAnswer}</strong>.</p> : null}
                  <span className={`${styles.label} ${styles.route}`}>Why</span>
                  <p>{check.explanation}</p>
                </div>
              ) : (
                <p className={styles.waiting}>Answer to see the explanation and the line it comes from.</p>
              )}
            </li>

            <li className={styles.step}>
              <span className={`${styles.label} ${styles.source}`}>Exact evidence</span>
              <button type="button" className={styles.textButton} aria-expanded={showSource || Boolean(answer)} aria-controls={evidenceId} onClick={() => setShowSource((value) => !value)} disabled={Boolean(answer)}>
                {showSource || answer ? "Sample passage" : "Show the sample passage"}
              </button>
              {showSource || answer ? (
                <blockquote id={evidenceId} className={styles.passage} aria-label="Sample source passage, built-in example">
                  {sentences.map((sentence) => isQuote(sentence) ? (
                    <mark key={sentence} className={styles.mark}>{sentence}<span className={styles.srOnly}> (the line this question comes from)</span></mark>
                  ) : (
                    <span key={sentence}>{sentence} </span>
                  ))}
                  <footer className={styles.cite}>Built-in example, {topic}. Not a real course file.</footer>
                </blockquote>
              ) : null}
            </li>
          </ol>
          <p className={styles.next}>When you are ready, close the sample and add your own notes below.</p>
        </div>
      )}
    </section>
  );
}
