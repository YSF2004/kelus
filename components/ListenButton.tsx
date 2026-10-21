"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Speaker } from "@/components/Marks";
import { speak, speakSupported, stopSpeaking } from "@/lib/speak";

const noSubscribe = () => () => {};

/** "Listen": reads a line from the notes aloud; tapped again, stops. Hidden where the device has no voice. */
export function ListenButton({ text, className, label = "Listen", stopLabel = "Stop" }: { text: string; className?: string; label?: string; stopLabel?: string }) {
  const supported = useSyncExternalStore(noSubscribe, speakSupported, () => false);
  const [playing, setPlaying] = useState(false);
  // Leaving the line (next check, closing) stops the voice.
  useEffect(() => () => { if (playing) stopSpeaking(); }, [playing, text]);
  if (!supported) return null;
  return (
    <button
      type="button"
      className={className}
      aria-pressed={playing}
      onClick={() => {
        if (playing) { stopSpeaking(); setPlaying(false); return; }
        setPlaying(true);
        speak(text, () => setPlaying(false));
      }}
    >
      <Speaker /> {playing ? stopLabel : label}
    </button>
  );
}
