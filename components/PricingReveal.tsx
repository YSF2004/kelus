"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { kelusEase } from "@/components/motion";
import { revealTarget, useReveal } from "@/components/motion/entrance";

/** A pricing section further down: it rises as it scrolls into view, in How it works' timing. */
export function Rise({ children, y = 14 }: { children: ReactNode; y?: number }) {
  const { ref, hidden } = useReveal<HTMLDivElement>();
  return (
    <motion.div ref={ref} initial={false} animate={revealTarget(hidden, y)} transition={{ duration: 0.55, ease: kelusEase }}>
      {children}
    </motion.div>
  );
}
