/**
 * Where the reading screen's K last sat on screen, so the screen after it can bring the same K into its own place
 * instead of it vanishing. Kept in memory only, for a few seconds.
 */
let last: { rect: { x: number; y: number; width: number; height: number }; at: number } | null = null;

export function rememberReadingMark(element: Element | null) {
  if (!element) return;
  const box = element.getBoundingClientRect();
  if (!box.width) return;
  last = { rect: { x: box.x, y: box.y, width: box.width, height: box.height }, at: Date.now() };
}

/** Whether a K is waiting to be carried on, without using it up. */
export function hasReadingMark(withinMs = 4000) {
  return Boolean(last && Date.now() - last.at <= withinMs);
}

/** The K's last place, if the reading screen was showing a moment ago. Read once. */
export function takeReadingMark(withinMs = 4000) {
  const value = last && Date.now() - last.at <= withinMs ? last.rect : null;
  last = null;
  return value;
}

/** Waits out the rest of a minimum time on screen, so a fast read still shows the K write itself once. */
export function holdAtLeast(startedAt: number, ms: number) {
  const left = ms - (performance.now() - startedAt);
  return left > 0 ? new Promise<void>((resolve) => setTimeout(resolve, left)) : Promise.resolve();
}
