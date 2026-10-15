/** Record the actual first-use flow against a locally served production build.
 * Run: node scripts/record-product-hero.mjs [--mobile]   (KELUS_URL defaults to http://127.0.0.1:3100)
 * A real chapter PDF (tests/fixtures/course-pdfs) is dropped onto the real drop zone through the app's own drop
 * handler; no product state is mocked. The only addition is a drawn cursor and the file it carries, because a
 * headless recording shows neither.
 */
import { chromium } from "playwright";
import { mkdirSync, copyFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const output = join(process.cwd(), "public/hero");
const mobile = process.argv.includes("--mobile");
const suffix = mobile ? "-mobile" : "";
const pdfPath = join(process.cwd(), "tests/fixtures/course-pdfs/biology-ch7-cell-transport.pdf");
const pdf = readFileSync(pdfPath);
mkdirSync(output, { recursive: true });

// The chapter's own text, so the first gap is answered the way a student who read it would.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), disableFontFace: true, verbosity: 0 }).promise;
let chapter = "";
for (let n = 1; n <= doc.numPages; n += 1) chapter += ` ${(await (await doc.getPage(n)).getTextContent()).items.map((item) => item.str).join(" ")}`;
chapter = chapter.replace(/\s+/g, " ").replace(/(\w)- (\w)/g, "$1$2");
const solveGap = (prompt) => {
  const quoted = prompt.match(/“(.+)”/)?.[1] ?? "";
  const [before, after] = quoted.split("_____").map((part) => part.trim().split(" ").slice(-3).join(" "));
  const tail = (after ?? "").split(" ").slice(0, 3).join(" ");
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return chapter.match(new RegExp(`${escape(before)}\\s+([\\w-]+)\\s*${escape(tail.split(" ")[0] ?? "")}`, "i"))?.[1] ?? "membrane";
};

const flat = (value) => value.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
const flatChapter = flat(chapter);
/** Which option the chapter backs: the line it really says, the word that completes its sentence, or the term it defines. */
function pickRight(prompt, options) {
  const index = (test) => options.findIndex(test);
  if (/does NOT match/.test(prompt)) return Math.max(0, index((option) => !flatChapter.includes(flat(option))));
  const quoted = prompt.match(/“(.+?)”/)?.[1] ?? "";
  if (/_____|…/.test(quoted)) {
    const found = index((option) => flatChapter.includes(flat(quoted.replace(/_____|…/, option).replace(/^This idea/, ""))));
    if (found >= 0) return found;
  }
  const topic = prompt.match(/notes on (.+?)\?$/)?.[1];
  if (topic) return Math.max(0, index((option) => flat(option).includes(flat(topic).slice(0, 6))));
  // "Which idea / term does this describe?": the option named in the chapter's sentence that says it.
  const meaning = flat(quoted.replace(/^This idea\s*/i, "")).slice(0, 40);
  const at = flatChapter.indexOf(meaning);
  if (at >= 0) {
    const around = flatChapter.slice(Math.max(0, at - 60), at + 10);
    const found = index((option) => around.includes(flat(option)));
    if (found >= 0) return found;
  }
  return 0;
}

const size = mobile ? { width: 390, height: 844 } : { width: 1024, height: 640 };
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: size,
  deviceScaleFactor: 1,
  recordVideo: { dir: "/private/tmp/kelus-product-capture", size },
  // Real motion: the K writing itself and carrying into the ready screen is part of what the video shows.
  reducedMotion: "no-preference",
});

// A pointer a viewer can follow, kept across page changes. It glides to each target, then the real click happens.
await context.addInitScript(() => {
  const mount = () => {
    if (document.getElementById("rec-cursor")) return;
    const cursor = document.createElement("div");
    cursor.id = "rec-cursor";
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M5 3l14 8-6.2 1.6L9.6 19z" fill="#12160f" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(cursor.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: `translate(${innerWidth * 0.82}px, ${innerHeight * 0.86}px)`, transition: "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)" });
    document.body.appendChild(cursor);
    const last = sessionStorage.getItem("rec-cursor-at");
    if (last) cursor.style.transform = last;
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
});

const page = await context.newPage();
const show = async (label, ms = 1800) => {
  console.log(label, page.url());
  await page.waitForTimeout(ms);
};

/** Glide the drawn cursor to an element, a beat, then click it for real. */
async function point(locator, { click = true, ms = 750 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) return;
  const x = box.x + Math.min(box.width / 2, 120);
  const y = box.y + box.height / 2;
  await page.evaluate(([px, py]) => {
    const cursor = document.getElementById("rec-cursor");
    if (!cursor) return;
    cursor.style.transform = `translate(${px - 4}px, ${py - 3}px)`;
    sessionStorage.setItem("rec-cursor-at", cursor.style.transform);
  }, [x, y]);
  await page.waitForTimeout(ms);
  if (click) await locator.click();
}

/** Drag the chapter PDF in from the corner and drop it on the real drop zone, through the app's own drop handler. */
async function dropPdf() {
  const zone = page.locator(".setup-first-upload");
  await zone.waitFor();
  const box = await zone.boundingBox();
  await page.evaluate(async ({ base64, target }) => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const chip = document.createElement("div");
    chip.innerHTML = '<span style="display:inline-grid;place-items:center;width:26px;height:32px;border-radius:4px;background:#c2513e;color:#fff;font:700 9px system-ui">PDF</span><span>biology-ch7-cell-transport.pdf</span>';
    Object.assign(chip.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483646", display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", border: "1px solid #e3e6df", borderRadius: "8px", background: "#fff", boxShadow: "0 12px 30px -12px rgba(18,22,15,.35)", font: "500 13px system-ui", color: "#12160f", pointerEvents: "none", whiteSpace: "nowrap", transform: `translate(${innerWidth * 0.82 + 14}px, ${innerHeight * 0.86 + 16}px)`, transition: "transform 1300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms" });
    document.body.appendChild(chip);
    const cursor = document.getElementById("rec-cursor");
    if (cursor) cursor.style.transition = "transform 1300ms cubic-bezier(0.22, 1, 0.36, 1)";
    await wait(400);
    const x = target.x + target.width / 2;
    const y = target.y + target.height / 2;
    chip.style.transform = `translate(${Math.max(8, x - 120)}px, ${y - 4}px)`;
    if (cursor) cursor.style.transform = `translate(${Math.max(8, x - 134)}px, ${y - 10}px)`;
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "biology-ch7-cell-transport.pdf", { type: "application/pdf" }));
    const zoneEl = document.querySelector(".setup-first-upload");
    await wait(700);
    zoneEl.dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: data }));
    zoneEl.dispatchEvent(new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }));
    await wait(900);
    chip.style.opacity = "0";
    zoneEl.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
    if (cursor) cursor.style.transition = "transform 700ms cubic-bezier(0.22, 1, 0.36, 1)";
    setTimeout(() => chip.remove(), 400);
  }, { base64: pdf.toString("base64"), target: box });
}

try {
  await page.goto(`${process.env.KELUS_URL ?? "http://127.0.0.1:3100"}/today`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Start with your notes." }).waitFor();
  await show("Start: a student brings their chapter", 1200);
  await dropPdf();
  const start = page.getByRole("button", { name: /^Start$/ });
  await start.waitFor({ timeout: 30000 });
  await show("Kelus reads the chapter and picks the first topic", 2600);
  await point(start);
  await page.getByLabel(/^Check 1 of \d$/).waitFor({ timeout: 30000 });
  await show("A real question from the dropped PDF", 2000);

  let gaps = 0;
  let checks = 0;
  for (let guard = 0; guard < 6; guard += 1) {
    await page.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])').first().waitFor({ timeout: 10000 });
    if (await page.locator("#run-explain").count()) break;
    const gap = page.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) {
      // The first gap is remembered, a later one slips: the video shows both kinds of feedback.
      const prompt = await page.locator("h1").first().innerText();
      await point(gap);
      await gap.pressSequentially(checks === 1 ? "energy" : solveGap(prompt), { delay: 110 });
      gaps += 1;
      await page.waitForTimeout(400);
      await point(page.getByRole("button", { name: "Check", exact: true }));
    } else {
      // A student who read the chapter: the option the page backs, except one slip on the second question.
      const prompt = await page.locator("h1").first().innerText();
      const options = page.getByRole("group", { name: "Choose one" }).getByRole("button", { disabled: false });
      const texts = (await options.allInnerTexts()).map((text) => text.replace(/^\d+\s*/, "").trim());
      const right = pickRight(prompt, texts);
      const pick = checks === 1 ? (right + 1) % texts.length : right;
      await point(options.nth(pick));
    }
    checks += 1;
    await show("Kelus checks the answer against the line", 1900);
    await point(page.getByRole("button", { name: /^(Next|Now say it yourself)/ }));
  }
  const explain = page.locator("#run-explain");
  await point(explain);
  // The first topic is the chapter's first section; the explanation is about whichever it is.
  const topicName = (await page.locator('[class*="QuickRun"] [class*="topic"], [aria-current="step"]').first().innerText().catch(() => "")).trim();
  const own = /osmosis/i.test(topicName)
    ? "Water moves across the membrane from the dilute side towards the more concentrated side."
    : /active/i.test(topicName)
      ? "It moves substances against the gradient, and it needs energy from respiration."
      : "Particles spread from where there are more of them to where there are fewer, down the gradient, with no energy needed.";
  await explain.pressSequentially(own, { delay: 40 });
  await show("Explain it in your own words", 900);
  await point(page.getByRole("button", { name: /Compare with the page/ }));
  await show("Your words beside the page", 3200);
  // The rating Kelus suggests from the words used: the student takes it.
  const suggested = page.locator("button", { hasText: "Suggested" });
  await point((await suggested.count()) ? suggested.first() : page.getByRole("button", { name: /Partly/ }));
  await show("The result, from what you showed", 3400);
  await point(page.getByRole("button", { name: "Close", exact: true }));
  await page.locator("#today-title").waitFor({ timeout: 20000 });
  await show("The plan, moved by the answer", 4200);
  await page.screenshot({ path: join(output, `kelus-product-poster${suffix}.png`) });
} finally {
  const video = page.video();
  await context.close();
  if (video) copyFileSync(await video.path(), join(output, `kelus-product-walkthrough${suffix}.webm`));
  await browser.close();
}
