"use client";

import { useState, type ReactNode } from "react";

/** The hero demonstration plays once and holds; this remounts it, so its CSS animations run again from the start. */
export function HeroReplay({ children, className }: { children: ReactNode; className: string }) {
  const [run, setRun] = useState(0);
  return (
    <>
      <div key={run} style={{ display: "contents" }}>{children}</div>
      <button type="button" className={className} onClick={() => setRun((n) => n + 1)}>Play it again</button>
    </>
  );
}
