/** Lines of the notes a student marked as not worth reading: left out of "Read it first" on this device. */
const KEY = "kelus:hidden-reading-lines:v1";

export function hiddenLines(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const value = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    return new Set(Array.isArray(value) ? value.filter((entry) => typeof entry === "string") : []);
  } catch {
    return new Set();
  }
}

export function hideLine(line: string) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...hiddenLines(), line].slice(-500)));
  } catch { /* Not saved: hidden for this run only. */ }
}
