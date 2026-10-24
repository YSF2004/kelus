"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { takeReadingMark } from "@/lib/reading-mark";
import styles from "./AutoStart.module.css";

const FLAG = "kelus-start-first-run";

function flagged() {
  try { return window.sessionStorage.getItem(FLAG) === "1"; } catch { return false; }
}

function clearFlag() {
  try { window.sessionStorage.removeItem(FLAG); } catch { /* Harmless. */ }
}

export type BuiltPlan = { course: string; topics: number; questions: number; minutes: number; firstName: string; /** Topic names, the first one first. */ names?: string[] };

/**
 * Right after new notes are read, the first question opens: first use is one journey from the topic check to an
 * answer, with nothing to learn on the way. The plan it built waits on Study for anyone who wants it afterwards.
 * Until the question opens, a plain cover keeps Study from flashing.
 */
export function AutoStart({ ready, onStart }: { ready: boolean; plan?: BuiltPlan; showPlan?: boolean; onStart: () => void }) {
  const [open] = useState(() => typeof window !== "undefined" && flagged());
  const fired = useRef(false);
  useEffect(() => {
    if (!open || !ready || fired.current) return;
    fired.current = true;
    takeReadingMark();
    clearFlag();
    onStart();
    // Once, when Study is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);
  if (!open || !ready) return null;
  return createPortal(<div className={styles.cover} />, document.body);
}
