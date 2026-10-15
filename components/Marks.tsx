/**
 * The few marks Kelus draws itself: a tick, a cross, an open ring. One 1.75 stroke, round caps, currentColor, so they
 * sit with the type instead of standing in for an icon library (no ✓ × ○ glyphs).
 */
type MarkProps = { size?: number; className?: string };

export function Tick({ size = 14, className }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3.2 8.6 6.4 11.6 12.8 4.6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Cross({ size = 14, className }: MarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M4.5 4.5 11.5 11.5M11.5 4.5 4.5 11.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

const line = { stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

/** An arrow in a button or link: the same stroke as the marks, sitting on the text's baseline. */
export function ArrowRight({ size = 14, className }: MarkProps) {
  return (
    <svg className={className ?? "k-mark"} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M3 8h9.5M8.5 4l4 4-4 4" {...line} />
    </svg>
  );
}

export function ArrowLeft({ size = 14, className }: MarkProps) {
  return (
    <svg className={className ?? "k-mark"} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M13 8H3.5M7.5 4l-4 4 4 4" {...line} />
    </svg>
  );
}

/** Opens somewhere else: the source page, the original file. */
export function ArrowOut({ size = 13, className }: MarkProps) {
  return (
    <svg className={className ?? "k-mark"} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M5 11 11 5M6 5h5v5" {...line} />
    </svg>
  );
}

export function Plus({ size = 14, className }: MarkProps) {
  return (
    <svg className={className ?? "k-mark"} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M8 3.5v9M3.5 8h9" {...line} />
    </svg>
  );
}

/** A page of notes, for a source in the sidebar. */
export function Page({ size = 14, className }: MarkProps) {
  return (
    <svg className={className ?? "k-mark"} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M4 2.5h5l3 3v8H4z M9 2.5v3h3 M6 8.5h4M6 11h4" {...line} strokeWidth={1.4} />
    </svg>
  );
}

/** Comes back: a line or topic returns for another try. */
export function Return({ size = 14, className }: MarkProps) {
  return (
    <svg className={className ?? "k-mark"} width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M12.5 6A5 5 0 1 0 13 10" {...line} />
      <path d="M13 2.5V6H9.5" {...line} />
    </svg>
  );
}
