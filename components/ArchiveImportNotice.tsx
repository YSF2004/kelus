"use client";

import type { ArchiveImportReport } from "@/domain/notion-zip";
import styles from "./ArchiveImportNotice.module.css";

type Props = {
  report: ArchiveImportReport;
  onContinue?: () => void;
  onChooseAnother?: () => void;
};

export function ArchiveImportNotice({ report, onContinue, onChooseAnother }: Props) {
  const visibleOmissions = report.omissions.slice(0, 6);
  const remainingOmissions = Math.max(0, report.omittedCount - visibleOmissions.length);
  return (
    <section className={styles.notice} role="status" aria-label="Archive import report">
      <div className={styles.heading}>
        <strong>{report.includedFiles === 0 ? "No readable notes were included" : "Some archive notes weren’t included"}</strong>
        <span>
          {report.includedFiles} note {report.includedFiles === 1 ? "file" : "files"} included · {report.omittedCount} item{report.omittedCount === 1 ? "" : "s"} left out
        </span>
      </div>
      <p>
        {report.includedFiles === 0
          ? "Kelus couldn’t find readable notes to study from this archive. Choose another source or export a smaller set of notes."
          : "Kelus can build topics and source evidence only from the included notes. Re-export or split the archive to include missing files; continue only if the imported notes cover what you need to study."}
      </p>
      {visibleOmissions.length ? (
        <ul aria-label="Items left out">
          {visibleOmissions.map((omission, index) => (
            <li key={`${omission.path}-${index}`}>
              <strong>{omission.path}</strong>
              <span>{omission.reason}</span>
            </li>
          ))}
          {remainingOmissions > 0 ? (
            <li className={styles.more}>{remainingOmissions} more item{remainingOmissions === 1 ? "" : "s"} left out.</li>
          ) : null}
        </ul>
      ) : null}
      {onContinue ? (
        <div className={styles.actions}>
          {report.includedFiles > 0 ? (
            <button type="button" className={styles.primary} onClick={onContinue}>
              Use {report.includedFiles} imported note{report.includedFiles === 1 ? "" : "s"}
            </button>
          ) : null}
          {onChooseAnother ? (
            <button type="button" className={report.includedFiles === 0 ? styles.primary : styles.secondary} onClick={onChooseAnother}>
              Choose another source
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
