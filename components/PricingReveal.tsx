"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef, useSyncExternalStore, type ReactNode } from "react";
import { kelusEase } from "@/components/motion";

/** Same rule as How it works: before hydration, and with reduced motion, everything is simply there. */
function useStill() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const reduce = useReducedMotion() === true;
  return !hydrated || reduce;
}

/**
 * The pricing page's entrance, in How it works' timing: a short rise and fade, on load for the top of the page and as
 * each later section scrolls into view.
 */
export function Rise({ children, className, delay = 0, y = 12, scale, inView = false }: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  scale?: number;
  inView?: boolean;
}) {
  const still = useStill();
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-12% 0px -12%" });
  const shown = !inView || seen;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={still ? false : { opacity: 0, y, scale: scale ?? 1 }}
      animate={shown ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={{ delay: still ? 0 : delay, duration: 0.55, ease: kelusEase }}
    >
      {children}
    </motion.div>
  );
}

/** A plan's list, its lines arriving one after another just after the plan itself. */
export function RiseList({ items, delay = 0 }: { items: string[]; delay?: number }) {
  const still = useStill();
  return (
    <ul>
      {items.map((item, index) => (
        <motion.li
          key={item}
          initial={still ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: still ? 0 : delay + index * 0.05, duration: 0.4, ease: kelusEase }}
        >
          {item}
        </motion.li>
      ))}
    </ul>
  );
}
