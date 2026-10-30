"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The hero demonstration plays once and holds. It waits, paused, until half of it is on screen (on a phone it sits
 * below the first screen), so the pass is seen rather than finished unseen. Without JavaScript it just plays.
 */
export function HeroReplay({ children, waitClass }: { children: ReactNode; waitClass: string }) {
  const [waiting, setWaiting] = useState(true);
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

  return <div ref={root} className={waiting ? waitClass : undefined} style={{ display: "contents" }}>{children}</div>;
}
