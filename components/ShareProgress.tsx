"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { Octicon } from "@/components/Octicon";
import { ResultShareCard } from "@/components/ResultShareCard";
import { getDemoSnapshot, getServerDemoSnapshot, subscribeDemoState } from "@/lib/demo-store";
import { todayShareStats } from "@/lib/progress-share";
import styles from "./ShareProgress.module.css";

/**
 * Today's progress, shareable from anywhere: in the sidebar as one quiet row ("Share today's progress"), on Progress as a
 * quiet button. Both open the same card the Done screen shows, with today's numbers. Shown only once there is
 * something from today to share; only numbers and the course's chosen name ever leave the device.
 */
export function ShareProgress({ variant }: { variant: "rail" | "inline" }) {
  const state = useSyncExternalStore(subscribeDemoState, getDemoSnapshot, getServerDemoSnapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const stats = todayShareStats(state);
  const sessions = state.snapshot.sessions.length;

  // A click on the backdrop (outside the sheet) closes it, as Escape does.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    const onClick = (event: MouseEvent) => { if (event.target === node) node.close(); };
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  }, [stats]);

  if (!stats) return null;
  const asked = stats.recalled + stats.missed;
  const open = () => dialog.current?.showModal();

  return (
    <>
      {variant === "rail" ? (
        // A row like the sidebar's own links, not a card: it is there when there is news, and never shouts.
        <button type="button" className={styles.row} onClick={open} title={asked ? `${stats.recalled} of ${asked} ${asked === 1 ? "line" : "lines"} recalled today` : undefined}>
          <Octicon name="paper-airplane" size={15} /> Share today’s progress
        </button>
      ) : (
        <button type="button" className={`k-btn k-btn--paper ${styles.inline}`} onClick={open}>
          <Octicon name="paper-airplane" size={16} /> Share today’s progress
        </button>
      )}
      <dialog ref={dialog} className={styles.sheet} aria-label="Share your progress">
        <div className={styles.sheetHead}>
          {/* A heading by role, not an <h2>: the app's older heading rules would set it in the serif on a phone. */}
          <p className={styles.title} role="heading" aria-level={2}>Share your progress</p>
          <button type="button" className={styles.close} onClick={() => dialog.current?.close()} aria-label="Close"><Octicon name="x" size={16} /></button>
        </div>
        <ResultShareCard stats={stats} sessionNumber={sessions} />
      </dialog>
    </>
  );
}
