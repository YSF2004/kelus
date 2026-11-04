// A small PowerPoint deck built in code, for the slide reader's unit tests (e2e/pptx-deck.ts is the browser test's copy).
/** A zip with stored (uncompressed) entries: enough for the reader, which does not check CRCs. */
export function storedZip(files) {
  const enc = new TextEncoder();
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = enc.encode(name); const data = enc.encode(text);
    const local = new Uint8Array(30 + nameBytes.length + data.length); const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30); local.set(data, 30 + nameBytes.length);
    const central = new Uint8Array(46 + nameBytes.length); const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nameBytes.length, true); cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    locals.push(local); centrals.push(central); offset += local.length;
  }
  const dirSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centrals.length, true); ev.setUint16(10, centrals.length, true); ev.setUint32(12, dirSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + dirSize + 22); let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}
export const slide = (...paragraphs) => `<p:sld><p:cSld><p:spTree>${paragraphs.map((runs) => `<a:p>${[].concat(runs).map((run) => `<a:r><a:t>${run}</a:t></a:r>`).join("")}</a:p>`).join("")}</p:spTree></p:cSld></p:sld>`;
