/**
 * Sounds, off unless the student turns them on: a soft tick for a right answer, a low note for a miss, two notes
 * for a topic done. Made with the browser's own audio, so there are no files to load and nothing to download.
 */

const KEY = "kelus-sounds";
const EVENT = "kelus-sounds";
let context: AudioContext | null = null;

export function soundsOn() {
  try { return localStorage.getItem(KEY) === "on"; } catch { return false; }
}

export function setSounds(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch { /* Not saved: still applies now. */ }
  window.dispatchEvent(new Event(EVENT));
  if (on) play("right");
}

export function subscribeSounds(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

/** Short, quiet, and never more than one at a time. Respects the device's silent mode where the browser does. */
export function play(kind: "right" | "miss" | "done") {
  if (!soundsOn() || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    context ??= new Ctx();
    const ctx = context;
    const notes = kind === "right" ? [[880, 0]] : kind === "miss" ? [[220, 0]] : [[660, 0], [990, 0.12]];
    for (const [frequency, delay] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === "miss" ? 0.05 : 0.07, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === "done" ? 0.32 : 0.18));
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.4);
    }
  } catch { /* No audio: silent, as it was. */ }
}
