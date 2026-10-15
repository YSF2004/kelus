"use client";

import { useState } from "react";
import styles from "./ExamDateCard.module.css";

/** Asked after the first run, when the question has a reason: it sets the countdown, the pace and the daily reminder. */
export function ExamDateCard({ onSave }: { onSave: (date: string, targetPercent: number) => void }) {
  const [date, setDate] = useState("");
  // The aim stays at 80%: a student picking a date should not also have to price a percentage they have never seen.
  const aim = 80;
  const [error, setError] = useState("");
  const [tomorrow] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));

  function save() {
    if (!date) return setError("Pick the day of your exam.");
    try {
      onSave(date, aim);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Choose a date in the future.");
    }
  }

  return (
    <section className={styles.card} aria-labelledby="exam-date-title">
      <h2 id="exam-date-title">When is your exam?</h2>
      <p>Kelus spreads your topics over the days you have left, and tells you how many to do each day.</p>
      <div className={styles.row}>
        <label>
          <span>Exam date</span>
          <input type="date" value={date} min={tomorrow} onChange={(event) => { setDate(event.target.value); setError(""); }} />
        </label>
        <button type="button" className="k-btn k-btn--small" onClick={save}>Save date</button>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}
