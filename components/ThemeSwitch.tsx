"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Octicon } from "@/components/Octicon";
import { followDevice, setTheme, subscribeTheme } from "@/lib/theme";
import styles from "./ThemeSwitch.module.css";

/** One tap between light and dark. The icon shows the appearance the tap will switch to. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, () => document.documentElement.dataset.theme === "dark", () => false);
  useEffect(() => followDevice(), []);
  return (
    <button
      type="button"
      className={styles.toggle}
      aria-label={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      title={dark ? "Switch to light appearance" : "Switch to dark appearance"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      <Octicon name={dark ? "sun" : "moon"} size={16} />
    </button>
  );
}
