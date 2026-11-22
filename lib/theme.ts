/**
 * Light, Dark or Auto for the product. The choice lives on this device; the resolved theme is set on <html> as
 * data-theme, by a small script in the head before the first paint (THEME_BOOT) so a page never flashes the wrong
 * paper, and then by setTheme when the student switches.
 */
export type ThemeChoice = "light" | "dark" | "auto";

const KEY = "kelus-theme";
const EVENT = "kelus-theme";

/** Runs before React, inline in <head>: resolve the choice and set it, nothing else. */
export const THEME_BOOT = `(function(){try{var c=localStorage.getItem("${KEY}")||"auto";var d=c==="dark"||(c!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function themeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

export const serverThemeChoice = (): ThemeChoice => "auto";

export function subscribeTheme(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function resolved(choice: ThemeChoice) {
  return choice === "dark" || (choice === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
}

function apply(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  // The browser's own bars follow the page, not only the device.
  document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => meta.setAttribute("content", theme === "dark" ? "#161715" : "#fbfaf7"));
}

/** A brief whole-page crossfade preserves context without a spotlight sweeping over the student's work. */
export function setTheme(choice: ThemeChoice) {
  try { localStorage.setItem(KEY, choice); } catch { /* not saved: still applies now */ }
  const next = resolved(choice);
  if (document.documentElement.dataset.theme === next) { window.dispatchEvent(new Event(EVENT)); return; }
  // Tell listeners once the new paper is on, so a toggle's own mark flips with the page.
  const done = () => window.dispatchEvent(new Event(EVENT));
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  if (reduce) { apply(next); done(); return; }
  if (!doc.startViewTransition) { apply(next); done(); return; }
  // The route shell also uses View Transitions. Mark only this transition so its
  // gentle theme crossfade cannot add a fade to ordinary page navigation.
  document.documentElement.dataset.themeTransition = "true";
  const transition = doc.startViewTransition(() => { apply(next); done(); });
  void transition.finished.finally(() => { delete document.documentElement.dataset.themeTransition; });
}

/** On Auto, follow the device when it changes (evening, a shortcut), without a reload. */
export function followDevice() {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => { if (themeChoice() === "auto") { apply(resolved("auto")); window.dispatchEvent(new Event(EVENT)); } };
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
