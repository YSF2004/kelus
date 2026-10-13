"use client";

import { useState } from "react";
import { setPilotCohort, trackEvent } from "@/lib/analytics";
import { classCode, inviteLink } from "@/lib/pilot";

/**
 * After a block: send Kelus to your class. The link is kelus.me with a class code, never the notes — each classmate
 * adds their own copy of the slides, so no course material is shared. On a phone it opens the share sheet
 * (WhatsApp, Discord, Messages); elsewhere it copies the link.
 */
export function ClassInvite({ sessionNumber }: { sessionNumber: number }) {
  const [note, setNote] = useState<string | null>(null);

  async function invite() {
    const code = classCode();
    setPilotCohort(code);
    const url = inviteLink(code, window.location.origin.includes("localhost") ? window.location.origin : "https://kelus.me");
    const text = "I’m revising with Kelus: it turns your own slides into quick questions and plans what to revise next. Add your copy of the notes:";
    if (typeof navigator.share === "function" && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: "Kelus", text, url });
        trackEvent({ name: "invite_shared", method: "share", session_number: sessionNumber });
        setNote("Sent. Each classmate adds their own notes.");
      } catch {
        /* The share sheet was closed: nothing was sent. */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      trackEvent({ name: "invite_shared", method: "copy", session_number: sessionNumber });
      setNote("Link copied. Paste it in your class chat.");
    } catch {
      setNote(`Copy this link: ${url}`);
    }
  }

  return (
    <div data-block="class-invite">
      <p>
        Revising with classmates?{" "}
        <button type="button" onClick={() => void invite()}>Send them Kelus</button>
      </p>
      <p role="status">{note}</p>
    </div>
  );
}
