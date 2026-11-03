import { jpegsToPdf, type JpegPage } from "@/domain/photos-to-pdf";

/** Long edge of a page photo: enough for OCR to read printed notes, small enough to stay a few hundred KB. */
const MAX_EDGE = 1600;

/** One photo, turned the right way up (its EXIF orientation), scaled down and re-encoded as a JPEG page. */
async function pageFromPhoto(file: File): Promise<JpegPage> {
  // Tiny files are commonly renamed text or a truncated upload. Some browsers leave image decoding pending
  // for those instead of rejecting, so fail early with a useful recovery message.
  if (file.size < 32) throw new Error("This photo looks incomplete. Choose another photo of your notes.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can’t read photos. Try a PDF instead.");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob) throw new Error("Kelus couldn’t read that photo. Try taking it again.");
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width, height };
}

/** Photos of notes, in the order taken, as one PDF the usual reader opens (scanned pages are read on this device). */
export async function photosToPdfFile(photos: File[], name = "Photos of your notes"): Promise<File> {
  const pages: JpegPage[] = [];
  for (const photo of photos) pages.push(await pageFromPhoto(photo));
  return new File([jpegsToPdf(pages)], `${name}.pdf`, { type: "application/pdf" });
}
