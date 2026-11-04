/** A two-slide PowerPoint deck built in code: a zip with stored entries, which is all the slide reader needs. */
function storedZip(files: Record<string, string>) {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = []; const centrals: Uint8Array[] = []; let offset = 0;
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
  const dirSize = centrals.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, centrals.length, true); ev.setUint16(10, centrals.length, true); ev.setUint32(12, dirSize, true); ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + dirSize + 22); let at = 0;
  for (const part of [...locals, ...centrals, end]) { out.set(part, at); at += part.length; }
  return out;
}
const slide = (...paragraphs: string[]) => `<p:sld><p:cSld><p:spTree>${paragraphs.map((text) => `<a:p><a:r><a:t>${text}</a:t></a:r></a:p>`).join("")}</p:spTree></p:cSld></p:sld>`;

export const deck = storedZip({
  "[Content_Types].xml": "<Types/>",
  "ppt/slides/slide1.xml": slide("Photosynthesis", "Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose.", "It takes place in the chloroplasts, which contain the green pigment chlorophyll.", "Carbon dioxide and water are used, and oxygen is released as a by-product."),
  "ppt/slides/slide2.xml": slide("Enzymes", "Enzymes are biological catalysts that speed up reactions without being used up.", "Each enzyme has an active site with a specific shape that fits one substrate.", "High temperatures denature an enzyme because the active site changes shape."),
});
