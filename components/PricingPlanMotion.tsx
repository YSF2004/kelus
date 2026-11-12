"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { rise } from "@/components/motion/rise";

/** A plan rises into place after the title (delay staggers the two), then grows a little under the pointer. */
export function PricingPlanMotion({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion() === true;

  return (
    <motion.div
      className="pricing-plan-shell k-rise"
      style={rise(delay, { y: 18 })}
      role="listitem"
      initial={false}
      whileHover={reduceMotion ? undefined : { scale: 1.018 }}
      transition={{ type: "spring", bounce: 0, duration: 0.26 }}
    >
      {children}
    </motion.div>
  );
}
