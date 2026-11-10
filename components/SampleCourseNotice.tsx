import Link from "next/link";
import { ArrowRight } from "@/components/Marks";
import styles from "./SampleCourseNotice.module.css";

export function SampleCourseNotice({ compact = false, showAction = false }: { compact?: boolean; showAction?: boolean }) {
  return (
    <aside className={`${styles.notice}${compact ? ` ${styles.compact}` : ""}`} role="note" aria-label="Sample course notice">
      <strong className={styles.label}>Sample course</strong>
      <p className={styles.copy}>
        Activity and history here belong only to this built-in example; your own course stays separate.
      </p>
      {showAction ? (
        <Link className={styles.action} href="/today?section=materials">
          Use my own notes <ArrowRight />
        </Link>
      ) : null}
    </aside>
  );
}
