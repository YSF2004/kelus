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
