/**
 * Listen: a line read aloud by the device's own voice (the Web Speech API). Free, offline once the voice is on the
 * device, and nothing leaves it. Notes in French are read by a French voice.
 */

export function speakSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** French notes get a French voice; everything else the device's English one. */
export function guessLanguage(text: string) {
  const french = (text.match(/\b(?:le|la|les|des|est|une|du|et|dans|pour|qui|que)\b/gi) ?? []).length + (text.match(/[éèêàçùâîô]/g) ?? []).length;
  const english = (text.match(/\b(?:the|is|are|of|and|in|to|a|an|that|which)\b/gi) ?? []).length;
  return french > english ? "fr" : "en";
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
