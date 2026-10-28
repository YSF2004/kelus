"use client";

import { motion, useReducedMotion } from "motion/react";
import { useSyncExternalStore, type ReactNode } from "react";
import { kelusEase } from "@/components/motion";

/** A plan rises into place after the title (delay staggers the two), then grows a little under the pointer. */
export function PricingPlanMotion({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion() === true;
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const still = !hydrated || reduceMotion;

  return (
    <motion.div
      className="pricing-plan-shell"
      role="listitem"
      initial={still ? false : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0, transition: { delay: still ? 0 : delay, duration: 0.6, ease: kelusEase } }}
      whileHover={reduceMotion ? undefined : { scale: 1.018 }}
      transition={{ type: "spring", bounce: 0, duration: 0.26 }}
    >
      {children}
    </motion.div>
  );
}
