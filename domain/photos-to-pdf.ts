/**
 * Photos of notes become one PDF, a page per photo, so they go through the same reader as any scanned PDF: on-device
 * OCR, the page viewer, topics and sync need no special case. Each page is the JPEG as it is (DCTDecode), sized one
 * point per pixel, which keeps the scan sharp when the reader renders it for OCR.
 */
export type JpegPage = { bytes: Uint8Array; width: number; height: number };

export function jpegsToPdf(pages: JpegPage[]): Uint8Array<ArrayBuffer> {
  if (!pages.length) throw new Error("No photos to put in the PDF.");
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: Uint8Array | string) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  // Objects: 1 catalog, 2 page tree, then per page: page, content stream, image.
  const object = (id: number, body: () => void) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body();
    push("\nendobj\n");
  };
  const pageIds = pages.map((_, index) => 3 + index * 3);

  push("%PDF-1.4\n%âãÏÓ\n");
  object(1, () => push("<< /Type /Catalog /Pages 2 0 R >>"));
  object(2, () => push(`<< /Type /Pages /Count ${pages.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`));
  pages.forEach((page, index) => {
    const [pageId, contentId, imageId] = [pageIds[index], pageIds[index] + 1, pageIds[index] + 2];
    const { width: w, height: h } = page;
    object(pageId, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    const draw = `q ${w} 0 0 ${h} 0 0 cm /Im0 Do Q`;
    object(contentId, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
    object(imageId, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`);
      push(page.bytes);
      push("\nendstream");
    });
  });
  const xref = length;
  const count = 3 + pages.length * 3;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id += 1) push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(new ArrayBuffer(length));
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}
