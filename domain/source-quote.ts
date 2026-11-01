/** Where a quoted passage sits in a section's blocks: character ranges in each block's own text. */
export type QuoteRange = { block: number; start: number; end: number };

type Stream = { chars: string; block: number[]; from: number[]; to: number[]; word: number[] };

/**
 * Letters and digits only, lower case, accents folded, with a map back to the original characters. Punctuation,
 * whitespace and block breaks are ignored for matching but still separate words, so a quote never starts or ends in
 * the middle of an unrelated word ("cat" is not found inside "concatenate").
 */
function stream(blocks: string[]): Stream {
  const out: Stream = { chars: "", block: [], from: [], to: [], word: [] };
  let word = 0;
  let gap = true;
  blocks.forEach((text, b) => {
    gap = true;
    for (let i = 0; i < text.length; ) {
      const code = text.codePointAt(i)!;
      const size = code > 0xffff ? 2 : 1;
      const folded = String.fromCodePoint(code).normalize("NFD").replace(/\p{M}+/gu, "").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
      if (!folded) gap = true;
      else {
        if (gap) { word += 1; gap = false; }
        for (const ch of folded) { out.chars += ch; out.block.push(b); out.from.push(i); out.to.push(i + size); out.word.push(word); }
      }
      i += size;
    }
  });
  return out;
}

/** The quote found in the blocks, as ranges per block, or null when it is not there word for word. */
export function findQuote(blocks: string[], quote: string): QuoteRange[] | null {
  const needle = stream([quote]).chars;
  if (needle.length < 2) return null;
  const hay = stream(blocks);
  for (let at = hay.chars.indexOf(needle); at >= 0; at = hay.chars.indexOf(needle, at + 1)) {
    const last = at + needle.length - 1;
    const startsClean = at === 0 || hay.word[at - 1] !== hay.word[at];
    const endsClean = last === hay.chars.length - 1 || hay.word[last + 1] !== hay.word[last];
    if (!startsClean || !endsClean) continue;
    const ranges: QuoteRange[] = [];
    for (let k = at; k <= last; k += 1) {
      const current = ranges[ranges.length - 1];
      if (current && current.block === hay.block[k]) current.end = hay.to[k];
      else ranges.push({ block: hay.block[k], start: hay.from[k], end: hay.to[k] });
    }
    return ranges;
  }
  return null;
}
