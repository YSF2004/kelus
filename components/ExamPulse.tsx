import styles from "./ExamPulse.module.css";

/**
 * The same three facts on every core page: where you are, where you're aiming, how long you have.
 * Readiness is an estimate from your answers, so it says so.
 */
export function ExamPulse({ readiness, targetPercent, daysToExam, datePending = false, answered = 1 }: { readiness: number; targetPercent: number; daysToExam: number; datePending?: boolean; /** Answers given so far: with none, there is nothing to estimate from, so no number is shown. */ answered?: number }) {
  const ready = answered ? Math.round(Math.max(0, Math.min(1, readiness)) * 100) : 0;
  const target = Math.round(Math.max(0, Math.min(100, targetPercent)));
  // No estimate yet and no exam date: the row would be three dashes, so it is left out.
  if (answered < 6 && datePending) return null;
  return (
    <div className={styles.pulse} role="group" aria-label="Exam readiness">
      <div className={styles.fact}>
        <strong>{answered >= 6 ? `${ready}%` : "—"}</strong>
        {/* A handful of answers moves the estimate a lot, so it says it is early until there are enough to trust. */}
        <span>{answered >= 6 ? "Estimated ready" : `Readiness after 6 answers (${answered} so far)`}</span>
      </div>
      <div className={styles.track} aria-hidden="true">
        <span className={styles.fill} style={{ width: `${answered >= 6 ? ready : 0}%` }} />
        {datePending ? null : <i className={styles.target} style={{ left: `${target}%` }} />}
      </div>
      {/* The target is chosen with the exam date; before that nobody has set one, so none is shown. */}
      {datePending ? null : (
        <div className={styles.fact}>
          <strong>{target}%</strong>
          <span>Your target</span>
        </div>
      )}
      <div className={styles.fact}>
        {/* Without a real exam date there is no countdown to show, only a placeholder. */}
        <strong>{datePending ? "—" : daysToExam}</strong>
        <span>{datePending ? "No exam date" : daysToExam === 1 ? "day left" : "days left"}</span>
      </div>
    </div>
  );
}
