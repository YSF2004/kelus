import { noteLanguage } from "@/domain/note-language";
/**
 * Listen: a line read aloud by the device's own voice (the Web Speech API). Free, offline once the voice is on the
 * device, and nothing leaves it. Notes in French are read by a French voice.
 */

export function speakSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** The language of a line, so a French line is read by a French voice. The same guess decides the questions' wording. */
export function guessLanguage(text: string) {
  return noteLanguage(text);
}

let current: SpeechSynthesisUtterance | null = null;

/** Reads the text, stopping anything already being read. `onEnd` runs when it finishes or is stopped. */
export function speak(text: string, onEnd?: () => void) {
  if (!speakSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = guessLanguage(text);
  const voice = synth.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith(lang));
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? (lang === "fr" ? "fr-FR" : "en-GB");
  utterance.rate = 0.98;
  utterance.onend = () => { if (current === utterance) current = null; onEnd?.(); };
  utterance.onerror = () => { if (current === utterance) current = null; onEnd?.(); };
  current = utterance;
  synth.speak(utterance);
}

export function stopSpeaking() {
  if (!speakSupported()) return;
  current = null;
  window.speechSynthesis.cancel();
}
