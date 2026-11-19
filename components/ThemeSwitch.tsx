"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";
import { Octicon } from "@/components/Octicon";
import { followDevice, setTheme, subscribeTheme } from "@/lib/theme";
import styles from "./ThemeSwitch.module.css";

/** One tap between light and dark. The icon shows the appearance the tap will switch to. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  const reduce = useReducedMotion() === true;
  useEffect(() => followDevice(), []);
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      title={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={dark ? "sun" : "moon"}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -18, scale: 0.82 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 18, scale: 0.82 }}
          transition={reduce ? { duration: 0.1 } : { type: "spring", bounce: 0, duration: 0.24 }}
        >
          <Octicon name={dark ? "sun" : "moon"} size={16} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
