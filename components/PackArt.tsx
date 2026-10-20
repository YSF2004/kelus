/**
 * Line icons and drawings from the Notion-style pack (see public/art/notion-pack/SOURCE.md).
 * They are decorative: the words next to them carry the meaning, so they are hidden from screen readers.
 */
const ART = {
  "list-check": { src: "/art/notion-pack/icon-list-check.svg", width: 24, height: 24 },
  folder: { src: "/art/notion-pack/icon-folder.svg", width: 24, height: 24 },
  "diagram-project": { src: "/art/notion-pack/icon-diagram-project.svg", width: 24, height: 24 },
  award: { src: "/art/notion-pack/icon-award.svg", width: 24, height: 24 },
  check: { src: "/art/notion-pack/icon-check.svg", width: 24, height: 24 },
  info: { src: "/art/notion-pack/icon-info.svg", width: 24, height: 24 },
  "clipboard-check": { src: "/art/notion-pack/icon-clipboard-check.svg", width: 24, height: 24 },
  growing: { src: "/art/notion-pack/art-growing.svg", width: 321, height: 301 },
  "time-flies": { src: "/art/notion-pack/art-time-flies.svg", width: 195, height: 150 },
  target: { src: "/art/notion-pack/art-target.svg", width: 186, height: 150 },
  "on-the-laptop": { src: "/art/notion-pack/art-on-the-laptop.svg", width: 420, height: 250 },
  lighthouse: { src: "/art/notion-pack/art-lighthouse.svg", width: 240, height: 154 },
  "no-answer": { src: "/art/notion-pack/art-no-answer.svg", width: 447, height: 305 },
  "taking-note": { src: "/art/notion-pack/art-taking-note.svg", width: 149, height: 156 },
  reviewing: { src: "/art/notion-pack/art-reviewing.svg", width: 579, height: 305 },
  thinking: { src: "/art/notion-pack/art-thinking.svg", width: 347, height: 255 },
  // Exported 2026-10-20: napping and window-view are the pack's wallpapers, cut out of their paper; hi-five
  // (Office Club) and ranking (Notion Club) are its regular-style drawings.
  napping: { src: "/art/notion-pack/art-napping.png", width: 520, height: 732 },
  "window-view": { src: "/art/notion-pack/art-window-view.png", width: 760, height: 299 },
  "hi-five": { src: "/art/notion-pack/art-hi-five.svg", width: 309, height: 301 },
  ranking: { src: "/art/notion-pack/art-ranking.svg", width: 385, height: 302 },
} as const;

export type PackArtName = keyof typeof ART;

/** `label` makes a drawing meaningful to screen readers where it carries the section; otherwise it is decorative. */
export function PackArt({ name, className, size, label }: { name: PackArtName; className?: string; size?: number; label?: string }) {
  const art = ART[name];
  const scale = size ? size / art.width : 1;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, small decorative SVGs
    <img src={art.src} alt={label ?? ""} aria-hidden={label ? undefined : true} className={className} width={Math.round(art.width * scale)} height={Math.round(art.height * scale)} draggable={false} />
  );
}
