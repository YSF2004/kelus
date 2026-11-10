"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { parseChallengeSnapshot, trustedChallengeSource, type ChallengeSnapshot } from "@/lib/challenge-share";
import styles from "./ChallengeViewer.module.css";

type LoadState = "loading" | "ready" | "error";
type Feedback = "again" | "partial" | "clear";

export function ChallengeViewer() {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<ChallengeSnapshot | null>(null);
  const challengeLink = useRef("");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    let sourceHash = window.location.hash;
    try {
      sourceHash = window.sessionStorage.getItem("kelus-challenge-fragment") || sourceHash;
      window.sessionStorage.removeItem("kelus-challenge-fragment");
    } catch { /* The URL fragment remains available if session storage is blocked. */ }
    const source = trustedChallengeSource(sourceHash, process.env.NEXT_PUBLIC_SUPABASE_URL);
    challengeLink.current = `${window.location.origin}${window.location.pathname}${window.location.search}${sourceHash}`;
    if (!source) {
      void Promise.resolve().then(() => {
        setMessage("This challenge link is missing or invalid. Ask the person who shared it to send a new link.");
        setLoadState("error");
      });
      return;
    }

    const controller = new AbortController();
    fetch(source, {
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("This challenge link has expired or was revoked. Ask the person who shared it for a new one.");
      const text = await response.text();
      if (text.length > 60_000) throw new Error("This challenge contains too much data to open safely.");
      let parsed: unknown;
      try { parsed = JSON.parse(text); } catch { throw new Error("This challenge link could not be read."); }
      const valid = parseChallengeSnapshot(parsed);
      if (!valid) throw new Error("This challenge link has invalid or incomplete cards.");
      setSnapshot(valid);
      setLoadState("ready");
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      setMessage(error instanceof Error ? error.message : "This challenge could not be opened.");
      setLoadState("error");
    });

    return () => controller.abort();
  }, []);

  const current = snapshot?.cards[index];
  const finished = Boolean(snapshot && feedback.length === snapshot.cards.length);

  function choose(value: Feedback) {
    const next = [...feedback, value];
    setFeedback(next);
    setRevealed(false);
    if (index < (snapshot?.cards.length ?? 0) - 1) setIndex(index + 1);
  }

  async function shareResult() {
    if (!snapshot) return;
    const summary = `I tried the Kelus study challenge: ${feedback.filter((item) => item === "clear").length} felt clear, ${feedback.filter((item) => item === "partial").length} partly there, and ${feedback.filter((item) => item === "again").length} for another pass.`;
    setShareMessage("");
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "My Kelus challenge notes",
          text: `${summary} Want to compare?`,
          url: challengeLink.current,
        });
        setShareMessage("Shared.");
      } else {
        await navigator.clipboard.writeText(`${summary}\n${challengeLink.current}`);
        setShareMessage("Copied your optional summary and challenge link.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setShareMessage("Could not share from this browser. You can tell the person who invited you how each card felt.");
    }
  }

  function restart() {
    setIndex(0);
    setRevealed(false);
    setFeedback([]);
    setShareMessage("");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/today/" className={styles.brand} aria-label="Kelus home">K <span>kelus</span></Link>
        <span className={styles.tag}>A shared study set</span>
      </header>

      {loadState === "loading" ? (
        <section className={styles.panel} aria-live="polite">
          <span className={styles.eyebrow}>Opening challenge</span>
          <div className={styles.skeleton} />
          <p>Loading the selected cards…</p>
        </section>
      ) : loadState === "error" ? (
        <section className={styles.panel} role="alert">
          <span className={styles.eyebrow}>Link unavailable</span>
          <h1>This challenge isn’t available.</h1>
          <p>{message}</p>
          <Link className="k-btn k-btn--paper" href="/today/">Open Kelus</Link>
        </section>
      ) : finished ? (
        <section className={styles.panel} aria-labelledby="finished-title">
          <span className={styles.eyebrow}>That’s the set</span>
          <h1 id="finished-title">You made it through {snapshot?.cards.length} cards.</h1>
          <p className={styles.result}>
            {feedback.filter((item) => item === "clear").length} felt clear · {feedback.filter((item) => item === "partial").length} partly there · {feedback.filter((item) => item === "again").length} for another pass
          </p>
          <p>Your choices stay in this browser. This is a reflection, not a grade or leaderboard.</p>
          <div className={styles.actions}>
            <button type="button" className="k-btn" onClick={() => void shareResult()}>Share my reflection</button>
            <button type="button" className="k-btn k-btn--paper" onClick={restart}>Review the cards</button>
          </div>
          {shareMessage ? <p className={styles.status} role="status">{shareMessage}</p> : null}
        </section>
      ) : current ? (
        <section className={styles.panel} aria-labelledby="challenge-title">
          <span className={styles.eyebrow}>A set shared with you</span>
          <h1 id="challenge-title">Try these questions in your own words.</h1>
          <p className={styles.privacy}>Selected questions and answers are included. The sender’s notes, source files, and personal responses are not.</p>
          <div className={styles.cardMeta}>
            <span>Card {index + 1} of {snapshot?.cards.length}</span>
            <span>Take it at your pace</span>
          </div>
          <div className={styles.progress} aria-hidden="true"><span style={{ width: `${((index + 1) / (snapshot?.cards.length ?? 1)) * 100}%` }} /></div>
          <article className={styles.questionCard}>
            <h2>{current.question}</h2>
            {revealed ? (
              <div className={styles.answer}>
                <span className={styles.answerLabel}>A useful answer</span>
                <p>{current.answer}</p>
                {current.explanation ? <p className={styles.explanation}>{current.explanation}</p> : null}
              </div>
            ) : (
              <button type="button" className="k-btn k-btn--paper" onClick={() => setRevealed(true)}>Show the answer</button>
            )}
          </article>
          {revealed ? (
            <div className={styles.feedback}>
              <p>How did it feel?</p>
              <div className={styles.actions}>
                <button type="button" className={styles.rating} onClick={() => choose("again")}>Not yet</button>
                <button type="button" className={styles.rating} onClick={() => choose("partial")}>Partly there</button>
                <button type="button" className={styles.rating} onClick={() => choose("clear")}>Clear</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className={styles.footer}>Kelus · Learn from your own course material</footer>
    </main>
  );
}
