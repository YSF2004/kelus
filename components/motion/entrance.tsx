"use client";

import { useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Page entrances for the marketing pages (How it works, pricing), one rule for both.
 *
 * The top of a page rises with CSS (`.k-rise` in app/quiet.css, timed with `rise()` from ./rise): it plays from the first frame, on a fresh load as
 * well as a client-side visit, and always ends visible, even if JavaScript never runs.
 *
 * Lower sections use `useReveal`. They render visible; once the page is running, a section still below the fold is
 * hidden at once (off screen, so nobody sees it go) and rises when it scrolls into view. A section that is already on
 * screen, reduced motion, or a page that never hydrates, simply stays in place.
 */

/** For a motion element below the fold: `hidden` is true only while it waits off screen to be revealed. */
export function useReveal<T extends Element>() {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion() === true;
  const seen = useInView(ref, { once: true, margin: "-12% 0px -12%" });
  const [waiting, setWaiting] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (reduce || !element) return;
    // Matches the -12% bottom margin above: below that line, the section has not been seen yet.
    if (element.getBoundingClientRect().top > window.innerHeight * 0.88) setWaiting(true);
  }, [reduce]);
  return { ref, hidden: waiting && !seen };
}

/** Motion targets for a revealed element: gone in no time while waiting, then the Kelus rise. */
export function revealTarget(hidden: boolean, y: number) {
  return hidden ? { opacity: 0, y, transition: { duration: 0 } } : { opacity: 1, y: 0 };
}
