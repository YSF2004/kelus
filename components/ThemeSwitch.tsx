"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useSyncExternalStore } from "react";
import { Octicon, type OcticonName } from "@/components/Octicon";
import { followDevice, setTheme, subscribeTheme } from "@/lib/theme";
import styles from "./ThemeSwitch.module.css";

const OPTIONS: Array<{ value: "light" | "dark"; label: string; icon: OcticonName }> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
];

/** A direct light/dark switch: two large marks in one physical control. System-following remains the default until a choice is made. */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion() === true;
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  useEffect(() => followDevice(), []);
  // Each switch slides its own face: two on one page must not trade it between them.
  const highlight = useId();
  return (
    <div className={`${styles.switch}${compact ? ` ${styles.compact}` : ""}`} role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((option) => {
        const on = option.value === "dark" ? dark : !dark;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.label}
            title={`Use ${option.label.toLowerCase()} appearance`}
            className={styles.option}
            onClick={() => setTheme(option.value)}
          >
            {on ? <motion.span layoutId={highlight} className={styles.on} transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.35 }} /> : null}
            <span className={styles.mark}><Octicon name={option.icon} size={18} /></span>
          </button>
        );
      })}
    </div>
  );
}

/** One tap between light and dark, for a crowded top bar: the mark shows the mode you are in, as a switch does. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  useEffect(() => followDevice(), []);
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={dark ? "Switch to light" : "Switch to dark"}
      title={dark ? "Switch to light" : "Switch to dark"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Octicon name={dark ? "moon" : "sun"} size={16} />
    </button>
  );
}
