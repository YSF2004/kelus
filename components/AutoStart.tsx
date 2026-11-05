"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./AutoStart.module.css";

const FLAG = "kelus-start-first-run";

function flagged() {
  try { return window.sessionStorage.getItem(FLAG) === "1"; } catch { return false; }
}

function clearFlag() {
  try { window.sessionStorage.removeItem(FLAG); } catch { /* Harmless. */ }
}

/**
 * Right after new notes are read (or a warm-up's Continue), Today opens the first question straight away. Until it
 * does, a plain cover hides Today so it never flashes.
 */
export function AutoStart({ ready, onStart }: { ready: boolean; onStart: () => void }) {
  // Mounted only after the notes are read (never in the server HTML), so reading storage here is safe.
  const [open] = useState(() => typeof window !== "undefined" && flagged());
  const fired = useRef(false);
  useEffect(() => {
    if (!open || !ready || fired.current) return;
    fired.current = true;
    clearFlag();
    onStart();
    // Once, when Today is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready]);
  if (!open || !ready) return null;
  return createPortal(<div className={styles.cover} />, document.body);
}
