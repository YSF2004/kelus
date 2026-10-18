"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useSyncExternalStore } from "react";
import { Octicon, type OcticonName } from "@/components/Octicon";
import { followDevice, serverThemeChoice, setTheme, subscribeTheme, themeChoice, type ThemeChoice } from "@/lib/theme";
import styles from "./ThemeSwitch.module.css";

const OPTIONS: Array<{ value: ThemeChoice; label: string; icon: OcticonName }> = [
  { value: "light", label: "Light", icon: "sun" },
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "auto", label: "Auto", icon: "device-desktop" },
];

/** Light, Dark or Auto: three marks in one pill, the chosen one under a sliding highlight. */
export function ThemeSwitch({ compact = false }: { compact?: boolean }) {
  const reduce = useReducedMotion() === true;
  const choice = useSyncExternalStore(subscribeTheme, themeChoice, serverThemeChoice);
  useEffect(() => followDevice(), []);
  // Each switch slides its own highlight: two on one page (sidebar and top bar) must not trade it between them.
  const highlight = useId();
  return (
    <div className={`${styles.switch}${compact ? ` ${styles.compact}` : ""}`} role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((option) => {
        const on = choice === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={option.label}
            title={option.value === "auto" ? "Auto: follow this device" : option.label}
            className={styles.option}
            onClick={() => setTheme(option.value)}
          >
            {on ? <motion.span layoutId={highlight} className={styles.on} transition={reduce ? { duration: 0 } : { type: "spring", bounce: 0, duration: 0.35 }} /> : null}
            <span className={styles.mark}><Octicon name={option.icon} size={14} />{compact ? null : <span>{option.label}</span>}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One tap between paper and night, for a crowded top bar: the mark shows where a tap takes you. */
export function ThemeToggle() {
  const choice = useSyncExternalStore(subscribeTheme, themeChoice, serverThemeChoice);
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  useEffect(() => followDevice(), []);
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={dark ? "Switch to light" : "Switch to dark"}
      title={`${dark ? "Switch to light" : "Switch to dark"}${choice === "auto" ? " (now following this device)" : ""}`}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Octicon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}
