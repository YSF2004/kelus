/** Record the actual first-use flow against a locally served production build.
 * Run: node scripts/record-product-hero.mjs [--mobile]   (KELUS_URL defaults to http://127.0.0.1:3100)
 * The lecture PDF is generated only for this recording; no product state is mocked.
 */
import { chromium } from "playwright";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const output = join(process.cwd(), "public/hero");
const mobile = process.argv.includes("--mobile");
const suffix = mobile ? "-mobile" : "";
mkdirSync(output, { recursive: true });

function lecturePdf() {
  const text = [
    "BT /F1 21 Tf 72 720 Td (Cell Biology - Lecture Notes) Tj ET",
    "BT /F1 18 Tf 72 665 Td (Cell Membranes) Tj ET",
    "BT /F1 11 Tf 72 635 Td (Cell membranes regulate transport between the cell and its environment.) Tj ET",
    "BT /F1 18 Tf 72 580 Td (Osmosis) Tj ET",
    "BT /F1 11 Tf 72 550 Td (Osmosis depends on cell membranes and moves water across a selectively permeable membrane.) Tj ET",
    "BT /F1 18 Tf 72 495 Td (Diffusion) Tj ET",
    "BT /F1 11 Tf 72 465 Td (Diffusion moves particles down a concentration gradient without using cellular energy.) Tj ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(text)} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  recordVideo: { dir: "/private/tmp/kelus-product-capture", size: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 } },
  // Real motion: the K writing itself and carrying into the ready screen is part of what the video shows.
  reducedMotion: "no-preference",
});
const page = await context.newPage();
const show = async (label, ms = 1800) => {
  console.log(label, page.url());
  await page.waitForTimeout(ms);
};

try {
  await page.goto(`${process.env.KELUS_URL ?? "http://127.0.0.1:3100"}/today`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Start with your notes." }).waitFor();
  await show("Start: upload your PDF", 2200);
  await page.locator('input[type="file"]').setInputFiles({
    name: "cell-biology-lecture.pdf",
    mimeType: "application/pdf",
    buffer: lecturePdf(),
  });
  const start = page.getByRole("button", { name: /^Start$/ });
  await start.waitFor({ timeout: 30000 });
  await show("Kelus builds a course from the PDF", 3500);
  await start.click();
  await page.getByLabel(/^Check 1 of \d$/).waitFor({ timeout: 30000 });
  await show("A real question from the uploaded PDF", 3500);

  for (let guard = 0; guard < 6; guard += 1) {
    await page.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])').first().waitFor({ timeout: 10000 });
    if (await page.locator("#run-explain").count()) break;
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) {
      await gap.fill("not sure yet");
      await page.getByRole("button", { name: "Check", exact: true }).click();
    } else {
      await page.getByRole("group", { name: "Choose one" }).getByRole("button", { disabled: false }).first().click();
    }
    await show("Kelus checks the answer", 1400);
    await page.getByRole("button", { name: /^(Next|Now say it yourself)/ }).click();
  }
  await page.locator("#run-explain").fill("I do not remember how this works yet.");
  await show("Explain it in your own words", 1800);
  await page.getByRole("button", { name: /Compare with the page/ }).click();
  await show("Compare with the source", 2300);
  await page.getByRole("button", { name: /Missed it/ }).click();
  await show("The answer changes what needs work", 3200);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.locator("#today-title").waitFor({ timeout: 20000 });
  await show("Today's study plan, after the answer", 4300);
  await page.screenshot({ path: join(output, `kelus-product-poster${suffix}.png`) });
} finally {
  const video = page.video();
  await context.close();
  if (video) copyFileSync(await video.path(), join(output, `kelus-product-walkthrough${suffix}.webm`));
  await browser.close();
}
