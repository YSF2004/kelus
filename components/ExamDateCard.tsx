"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRef, useState, useSyncExternalStore } from "react";
import { Octicon } from "@/components/Octicon";
import { trackEvent } from "@/lib/analytics";
import { buildExamIcs, googleExamUrl } from "@/lib/study-reminder";
import styles from "./ExamDateCard.module.css";

const DAY_MS = 86_400_000;
const noSubscribe = () => () => {};
// iPadOS reports itself as a Mac; touch tells the two apart, and both use Apple Calendar.
const isApple = () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

function spoken(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function daysUntil(date: string, nowMs: number) {
  const today = new Date(nowMs);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((new Date(`${date}T00:00:00`).getTime() - start) / DAY_MS);
}

/**
 * Asked after the first run, when the question has a reason: it sets the countdown, the pace and the reminders.
 * The date comes from the device's own picker (the wheel on an iPhone, the calendar on Android and desktop), shown
 * back in words with the days left. Saving can also put the exam in the student's own calendar, the one their device
 * uses, with alerts a week and a day before.
 */
export function ExamDateCard({ onSave, courseName }: { onSave: (date: string, targetPercent: number) => void; courseName?: string }) {
  const reduce = useReducedMotion() === true;
  const input = useRef<HTMLInputElement>(null);
  const [date, setDate] = useState("");
  // The aim stays at 80%: a student picking a date should not also have to price a percentage they have never seen.
  const aim = 80;
  const [error, setError] = useState("");
  const [nowMs] = useState(() => Date.now());
  const tomorrow = new Date(nowMs + DAY_MS).toISOString().slice(0, 10);
  const days = date ? daysUntil(date, nowMs) : null;
  const course = courseName && courseName !== "My course" ? courseName : "my course";
  const apple = useSyncExternalStore(noSubscribe, isApple, () => false);

  function save(via: "kelus" | "google" | "file") {
    if (!date) { setError("Pick the day of your exam."); input.current?.focus(); return false; }
    try {
      onSave(date, aim);
      if (via !== "kelus") trackEvent({ name: "exam_added_to_calendar", calendar: via });
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Choose a date in the future.");
      return false;
    }
  }

  // Desktop browsers open their calendar only from the small icon; the whole field opens it here.
  function openPicker() {
    try { input.current?.showPicker?.(); } catch { /* Older browsers: the focused field still takes typing. */ }
  }

  return (
    <section className={styles.card} aria-labelledby="exam-date-title">
      <h2 id="exam-date-title">When is your exam?</h2>
      <p>Your topics are spread over the days you have left, with how many to do each day.</p>
      <div className={styles.field} data-empty={date ? undefined : ""} onClick={openPicker}>
        <label htmlFor="exam-date-input" className="sr-only">Exam date</label>
        <input
          ref={input}
          id="exam-date-input"
          className={styles.native}
          type="date"
          value={date}
          min={tomorrow}
          onChange={(event) => { setDate(event.target.value); setError(""); }}
        />
        <Octicon name="calendar" size={20} className={styles.icon} />
        <span className={styles.face} aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={date || "empty"} className={styles.faceText} initial={reduce ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
              {date ? <><b>{spoken(date)}</b>{days !== null && days > 0 ? <small>in {days} {days === 1 ? "day" : "days"}</small> : null}</> : <span>Choose the day</span>}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.actions}>
        <button type="button" className="k-btn k-btn--small" onClick={() => save("kelus")}>Save date</button>
        {/* One calendar, the device's own: Apple Calendar on an iPhone, iPad or Mac (the calendar file, which it adds at
            once), Google Calendar everywhere else (its add-event page, filled in). The student never picks an app. */}
        <a
          className={styles.calendar}
          href={date ? (apple ? `data:text/calendar;charset=utf-8,${encodeURIComponent(buildExamIcs({ courseName: course, examDate: date }) ?? "")}` : googleExamUrl({ courseName: course, examDate: date })) : undefined}
          {...(apple ? { download: "kelus-exam.ics" } : { target: "_blank", rel: "noopener noreferrer" })}
          aria-disabled={!date || undefined}
          onClick={(event) => { if (!save(apple ? "file" : "google")) event.preventDefault(); }}
        >
          <Octicon name="calendar" size={16} /> Also add to my calendar
        </a>
      </div>
    </section>
  );
}
