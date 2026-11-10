"use client";

import { useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getSupabaseBrowserClient } from "@/lib/supabase-client";
import {
  CHALLENGE_BUCKET,
  CHALLENGE_TTL_SECONDS,
  type ChallengeCard,
  type ChallengeSnapshot,
} from "@/lib/challenge-share";
import styles from "./ChallengeShare.module.css";

type ShareRecord = { path: string; expiresAt: number };
const CHANGE_EVENT = "kelus:challenge-share-change";
const currentTimestamp = () => Date.now();

function recordKey(userId: string, sessionId: string) {
  return `kelus:challenge:${userId}:${sessionId}`;
}

function readRecord(key: string | null) {
  if (!key || typeof window === "undefined") return "";
  try { return window.localStorage.getItem(key) ?? ""; } catch { return ""; }
}

function subscribeRecord(key: string | null, notify: () => void) {
  if (!key || typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => { if (event.key === key) notify(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, notify);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, notify);
  };
}

function parseRecord(raw: string, userId: string | undefined): ShareRecord | null {
  try {
    const value = JSON.parse(raw) as Partial<ShareRecord>;
    return userId && typeof value.path === "string" && value.path.startsWith(`${userId}/challenges/`) && value.path.endsWith(".txt") && typeof value.expiresAt === "number"
      ? { path: value.path, expiresAt: value.expiresAt }
      : null;
  } catch { return null; }
}

function saveRecord(key: string, record: ShareRecord | null) {
  try {
    if (record) window.localStorage.setItem(key, JSON.stringify(record));
    else window.localStorage.removeItem(key);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    throw new Error("This browser could not save the link controls. Try another browser or clear some local storage.");
  }
}

function challengeUrl(signedUrl: string) {
  const url = new URL("/challenge/", window.location.origin);
  url.hash = new URLSearchParams({ source: signedUrl }).toString();
  return url.toString();
}

export function ChallengeShare({
  cards,
  sessionId,
}: {
  cards: ChallengeCard[];
  sessionId: string;
}) {
  const auth = useAuth();
  const client = getSupabaseBrowserClient();
  const key = auth.user ? recordKey(auth.user.id, sessionId) : null;
  const rawRecord = useSyncExternalStore(
    (notify) => subscribeRecord(key, notify),
    () => readRecord(key),
    () => "",
  );
  const record = parseRecord(rawRecord, auth.user?.id);
  const activeRecord = record;
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");

  async function createLink() {
    if (!auth.user || !client || !key || !consent || !cards.length) return;
    setBusy(true);
    setNote("");
    setLink("");
    let path = "";
    try {
      if (record) await client.storage.from(CHALLENGE_BUCKET).remove([record.path]);
      const snapshot: ChallengeSnapshot = { version: 1, cards };
      const id = crypto.randomUUID();
      path = `${auth.user.id}/challenges/${id}.txt`;
      const file = new Blob([JSON.stringify(snapshot)], { type: "text/plain;charset=utf-8" });
      const { error: uploadError } = await client.storage.from(CHALLENGE_BUCKET).upload(path, file, {
        contentType: "text/plain",
        cacheControl: "0",
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const expiresAt = currentTimestamp() + CHALLENGE_TTL_SECONDS * 1000;
      const { data, error } = await client.storage.from(CHALLENGE_BUCKET).createSignedUrl(path, CHALLENGE_TTL_SECONDS);
      if (error || !data?.signedUrl) throw error ?? new Error("Could not create the signed link.");

      saveRecord(key, { path, expiresAt });
      setLink(challengeUrl(data.signedUrl));
      setNote("Link ready. It expires in 7 days, and you can revoke it here.");
    } catch (error) {
      if (path) await client.storage.from(CHALLENGE_BUCKET).remove([path]).catch(() => undefined);
      setNote("Could not create the link. Check your sign-in and try again; your notes are unchanged.");
    } finally {
      setBusy(false);
    }
  }

  async function linkForRecord() {
    if (!client || !activeRecord) throw new Error("This challenge link has expired. Create a new one to share again.");
    const remaining = Math.floor((activeRecord.expiresAt - currentTimestamp()) / 1000);
    if (remaining < 60) throw new Error("This challenge link has expired. Create a new one to share again.");
    const { data, error } = await client.storage.from(CHALLENGE_BUCKET).createSignedUrl(activeRecord.path, remaining);
    if (error || !data?.signedUrl) throw error ?? new Error("Could not refresh the signed link.");
    const nextLink = challengeUrl(data.signedUrl);
    setLink(nextLink);
    return nextLink;
  }

  async function copyLink() {
    setBusy(true);
    setNote("");
    try {
      const nextLink = link || await linkForRecord();
      await navigator.clipboard.writeText(nextLink);
      setNote("Copied. Anyone with this link can open the selected cards for 7 days.");
    } catch (error) {
      setNote("Could not copy the link. If it expired, revoke it and create a fresh one.");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    setBusy(true);
    setNote("");
    try {
      const nextLink = link || await linkForRecord();
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: "A Kelus study challenge",
          text: "Try these questions from my study session. The original notes and my answers stay private.",
          url: nextLink,
        });
        setNote("Shared. The link expires in 7 days.");
      } else {
        await navigator.clipboard.writeText(nextLink);
        setNote("Copied. Paste the challenge link in your study chat.");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      setNote("Could not share the link. Try copying it instead.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!auth.user || !client || !key || !record) return;
    setBusy(true);
    setNote("");
    try {
      const { error } = await client.storage.from(CHALLENGE_BUCKET).remove([record.path]);
      if (error) throw error;
      saveRecord(key, null);
      setLink("");
      setConsent(false);
      setNote("Challenge link revoked. It can no longer be opened.");
    } catch (error) {
      setNote("Could not revoke this link right now. It will still expire automatically in 7 days.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.card} aria-labelledby="challenge-share-title">
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Optional · private by default</span>
        <h2 id="challenge-share-title">Share a few questions with a classmate</h2>
        <p>Only these question-and-answer cards are shared. Your notes, source files, course name, and personal answers stay private.</p>
      </div>

      <details className={styles.preview}>
        <summary>Preview the {cards.length} cards that would be shared</summary>
        <ol>
          {cards.map((card, index) => (
            <li key={`${card.question}-${index}`}>
              <strong>{card.question}</strong>
              <span>{card.answer}</span>
              {card.explanation ? <small>{card.explanation}</small> : null}
            </li>
          ))}
        </ol>
      </details>

      {!auth.user ? (
        <div className={styles.action}>
          <p>{auth.configured ? "Sign in is required to create a private, expiring link." : "Challenge links need a signed-in account. Study still works on this device."}</p>
          {auth.configured ? <button type="button" className="k-btn k-btn--paper" onClick={auth.openDialog}>Sign in to create a link</button> : null}
        </div>
      ) : activeRecord ? (
        <div className={styles.action}>
          <p className={styles.ready}>Link stored until {new Date(activeRecord.expiresAt).toLocaleDateString("en", { month: "short", day: "numeric" })}. If expired, revoke it to create a fresh one.</p>
          <div className={styles.buttons}>
            <button type="button" className="k-btn" onClick={() => void shareLink()} disabled={busy}>{busy ? "Preparing…" : "Share challenge"}</button>
            <button type="button" className="k-btn k-btn--paper" onClick={() => void copyLink()} disabled={busy}>Copy link</button>
            <button type="button" className={styles.revoke} onClick={() => void revoke()} disabled={busy}>Revoke link</button>
          </div>
        </div>
      ) : (
        <div className={styles.action}>
          <label className={styles.consent}>
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
            <span>I’m okay sharing these selected questions and answers with anyone who has the link.</span>
          </label>
          <button type="button" className="k-btn" onClick={() => void createLink()} disabled={!consent || busy || !cards.length}>
            {busy ? "Creating private link…" : "Create 7-day challenge link"}
          </button>
          {record ? <button type="button" className={styles.revoke} onClick={() => void revoke()} disabled={busy}>Remove expired link</button> : null}
        </div>
      )}

      {link ? (
        <label className={styles.shareField}>
          Challenge link
          <input type="url" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
        </label>
      ) : null}
      {note ? <p className={styles.status} role="status">{note}</p> : null}
      <p className={styles.foot}>The link uses private storage, expires after 7 days, and can be revoked here. Challenge answers are not saved to your course or Kelus progress.</p>
    </section>
  );
}
