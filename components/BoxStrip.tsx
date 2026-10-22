import type { LeitnerLine } from "@/domain/leitner";
import styles from "./BoxStrip.module.css";

/**
 * A topic's lines across the five Leitner boxes, in one line of five small wells: the count in each, the wells filling
 * greener the further right a box is, and Box 1 outlined in coral while it holds a missed line.
 */
export function BoxStrip({ lines, label }: { lines: LeitnerLine[]; label: string }) {
  const counts = [1, 2, 3, 4, 5].map((box) => lines.filter((line) => line.box === box).length);
  const missed = lines.some((line) => line.state === "missed");
  const words = counts.map((count, index) => `${count} in Box ${index + 1}`).join(", ");
  return (
    <span className={styles.strip} role="img" aria-label={`${label}: ${words}`}>
      {counts.map((count, index) => (
        <i key={index} data-box={index + 1} data-has={count ? "" : undefined} data-missed={index === 0 && missed ? "" : undefined}>{count || ""}</i>
      ))}
    </span>
  );
}
