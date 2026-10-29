"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The hero demonstration plays once and holds. It waits, paused, until half of it is on screen (on a phone it sits
 * below the first screen), so the pass is seen rather than finished unseen. "Play it again" lets the finished state
 * settle out for 150 ms, then remounts it so its CSS animations run from the start. Without JavaScript it just plays.
 */
export function HeroReplay({ children, className, waitClass, leaveClass }: { children: ReactNode; className: string; waitClass: string; leaveClass: string }) {
  const [run, setRun] = useState(0);
  const [waiting, setWaiting] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = root.current?.firstElementChild;
    if (!target || typeof IntersectionObserver === "undefined") { setWaiting(false); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) { setWaiting(false); observer.disconnect(); }
    }, { threshold: 0.5 });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function replay() {
    setLeaving(true);
    window.setTimeout(() => { setLeaving(false); setRun((n) => n + 1); }, 150);
  }

  return (
    <>
      <div ref={root} key={run} className={`${waiting ? waitClass : ""} ${leaving ? leaveClass : ""}`} style={{ display: "contents" }}>{children}</div>
      <button type="button" className={className} onClick={replay}><i aria-hidden="true">↻</i>Play it again</button>
    </>
  );
}
