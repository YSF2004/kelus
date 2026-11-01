import type { ReactNode } from "react";
import type { ExtractedMaterialPage } from "@/domain/types";
import type { QuoteRange } from "@/domain/source-quote";
import styles from "./NotesSection.module.css";

/** Text with the quoted part marked; `offset` is where `text` starts within the block's own text. */
function marked(text: string, offset: number, range: QuoteRange | undefined, first: boolean): ReactNode {
  if (!range) return text;
  const start = Math.max(0, range.start - offset);
  const end = Math.min(text.length, range.end - offset);
  if (end <= start) return text;
  return (
    <>
      {text.slice(0, start)}
      <mark className={styles.mark} data-source-quote={first ? "first" : "rest"}>{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}

/** One section of the learner's notes, as the original text with its headings, not a rewrite. */
export function NotesSection({ page, title, ranges = null }: { page: ExtractedMaterialPage; title: string; ranges?: QuoteRange[] | null }) {
  const blocks = page.blocks ?? [{ text: page.text, x: 0, y: 0, width: 0, height: 12, fontSize: 12 }];
  const firstBlock = ranges?.[0]?.block;
  return (
    <article className={styles.section} aria-label={`Section ${page.pageNumber} of ${title}`}>
      {blocks.map((block, index) => {
        const range = ranges?.find((r) => r.block === index);
        const first = index === firstBlock;
        if (block.fontSize >= 20) return <h2 key={index} className={styles.h1}>{marked(block.text, 0, range, first)}</h2>;
        if (block.fontSize >= 14) return <h3 key={index} className={styles.h2}>{marked(block.text, 0, range, first)}</h3>;
        const bullet = block.text.match(/^(•\s+)(.*)$/);
        return bullet
          ? <p key={index} className={styles.bullet}><span aria-hidden="true">•</span><span className={styles.bulletText}>{marked(bullet[2], bullet[1].length, range, first)}</span></p>
          : <p key={index}>{marked(block.text, 0, range, first)}</p>;
      })}
    </article>
  );
}
