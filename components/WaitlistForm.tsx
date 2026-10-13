"use client";

import { useState, type FormEvent } from "react";
import { trackEvent } from "@/lib/analytics";
import { isValidWaitlistEmail, submitWaitlistSignup } from "@/lib/waitlist";

export function WaitlistForm({ source = "waitlist", compact = false }: { source?: string; compact?: boolean }) {
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "duplicate" | "local" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!isValidWaitlistEmail(email)) {
      setStatus("error");
      setMessage("Enter a valid email address.");
      return;
    }

    setStatus("saving");
    setMessage("");
    const result = await submitWaitlistSignup({ email, note, source });
    if (!result.ok) {
      setStatus("error");
      setMessage(result.error);
      return;
    }

    trackEvent({ name: "waitlist_joined", source });
    if (result.delivery === "local") {
      // It did not reach us this time; it is kept here, and the student has a sure way to reach a person.
      setStatus("local");
      setMessage("Saved here, but it didn’t reach us just now. Email hello@kelus.me and we’ll add you by hand.");
    } else {
      setStatus(result.duplicate ? "duplicate" : "saved");
      setMessage(
        result.duplicate
          ? "You’re already on the list with this email."
          : "You’re on the list. We’ll email you when Kelus Plus opens, and that’s all.",
      );
    }
    if (!result.duplicate) {
      setEmail("");
      setNote("");
    }
  }

  return (
    <form className={compact ? "waitlist-form is-compact" : "waitlist-form"} onSubmit={onSubmit} noValidate>
      <div className="waitlist-fields">
        <div>
          <label htmlFor={`waitlist-email-${source}`}>Email</label>
          <input
            id={`waitlist-email-${source}`}
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (status !== "idle" && status !== "saving") {
                setStatus("idle");
                setMessage("");
              }
            }}
            placeholder="you@university.edu"
            disabled={status === "saving"}
          />
        </div>
        {compact ? null : (
          <div>
            <label htmlFor={`waitlist-note-${source}`}>
              What are you studying? <span>optional</span>
            </label>
            <input
              id={`waitlist-note-${source}`}
              name="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Organic chemistry · midterm in three weeks"
              disabled={status === "saving"}
            />
          </div>
        )}
      </div>
      <button className="cta" type="submit" disabled={status === "saving" || !email.trim()}>
        {status === "saving" ? "Joining…" : "Join the waitlist"}
        <span aria-hidden="true">→</span>
      </button>
      <p
        className={
          status === "error"
            ? "waitlist-message is-error"
            : status === "local"
              ? "waitlist-message is-local"
              : "waitlist-message"
        }
        role={status === "error" ? "alert" : status === "saved" || status === "duplicate" || status === "local" ? "status" : undefined}
        aria-live="polite"
      >
        {message || "One email when Kelus Plus opens. No newsletter."}
      </p>
    </form>
  );
}
