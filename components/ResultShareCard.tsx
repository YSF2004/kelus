"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { trackEvent } from "@/lib/analytics";
import { Octicon } from "@/components/Octicon";
import { drawResultCard, shareHeadline, shareText, shareUrl, whatsappUrl, type ResultStats } from "@/lib/share-result";
import styles from "./ResultShareCard.module.css";

const noSubscribe = () => () => {};

/**
 * The end of a session as a card worth sending to a study group: the lines recalled, what comes back tomorrow and
 * the course's own count, in the book serif on paper. Share opens the phone's share sheet with the same card as a
 * picture where the sheet takes images, else the text and link; on a computer it copies them. Only numbers and the
 * course's chosen name leave the device, never the notes.
 */
export function ResultShareCard({ stats, sessionNumber }: { stats: ResultStats; sessionNumber: number }) {
  const reduce = useReducedMotion() === true;
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const touch = useSyncExternalStore(noSubscribe, () => window.matchMedia("(pointer: coarse)").matches, () => false);
  const url = shareUrl(stats);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    const text = shareText(stats);
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      trackEvent({ name: "result_shared", method: "copy", session_number: sessionNumber });
      setCopied(true);
      setNote("Copied. Paste it in your study group.");
    } catch {
      setNote(`Copy this: ${text} ${url}`);
    }
  }

  async function share() {
    setBusy(true);
    const text = shareText(stats);
    try {
      if (touch && typeof navigator.share === "function") {
        const blob = await drawResultCard(stats);
        const file = blob ? new File([blob], "kelus-result.png", { type: "image/png" }) : null;
        const withImage = file && navigator.canShare?.({ files: [file] });
        try {
          await navigator.share(withImage ? { files: [file], text: `${text} ${url}` } : { title: "Kelus", text, url });
          trackEvent({ name: "result_shared", method: withImage ? "image" : "share", session_number: sessionNumber });
          setNote("Shared. Only your numbers went with it, not your notes.");
        } catch { /* The share sheet was closed: nothing was sent. */ }
        return;
      }
      await copy();
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.section
      className={styles.wrap}
      aria-label="Share this result"
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
    >
      <ResultCardFace stats={stats} />
      <div className={styles.actions}>
        <div className={styles.buttons}>
          {touch ? (
            <button type="button" className={`k-btn ${styles.share}`} onClick={share} disabled={busy} aria-busy={busy || undefined}>
              {busy ? "Making the card…" : "Share this result"}
            </button>
          ) : null}
          <button type="button" className={touch ? styles.secondary : `k-btn ${styles.share}`} onClick={() => void copy()} aria-live="polite">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={copied ? "done" : "copy"} className={styles.copyLabel} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                {copied ? <><Octicon name="check" size={16} /> Copied</> : "Copy summary"}
              </motion.span>
            </AnimatePresence>
          </button>
          <a className={styles.secondary} href={whatsappUrl(stats)} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent({ name: "result_shared", method: "whatsapp", session_number: sessionNumber })}>WhatsApp</a>
        </div>
        <p className={styles.privacy}>{note ?? "Shares your numbers and a link to Kelus. Your notes stay on this device."}</p>
      </div>
    </motion.section>
  );
}

/** The card itself: one big number, three small figures, kelus.me. The same face on the Done screen and on /r. */
export function ResultCardFace({ stats, kicker }: { stats: ResultStats; kicker?: string }) {
  const asked = stats.recalled + stats.missed;
  return (
    <div className={styles.card} data-testid="result-share-card">
      <p className={styles.kicker}>{kicker ?? stats.course ?? "Today’s revision"}</p>
      <h2 className="sr-only">{shareHeadline(stats)}</h2>
      <p className={styles.big} aria-hidden="true">
        {asked ? <>{stats.recalled}<span>/{asked}</span></> : stats.topics}
      </p>
      <p className={styles.what}>{asked ? "lines recalled from my notes" : stats.topics === 1 ? "topic practised" : "topics practised"}</p>
      <dl className={styles.figures}>
        <div><dt>back tomorrow</dt><dd>{stats.missed}</dd></div>
        <div><dt>in the course</dt><dd>{stats.courseRecalled}<span>/{stats.courseTotal}</span></dd></div>
        <div><dt>day streak</dt><dd>{Math.max(1, stats.streak)}</dd></div>
      </dl>
      <p className={styles.foot}><span>Every question came from my own notes.</span><b>kelus.me</b></p>
    </div>
  );
}
