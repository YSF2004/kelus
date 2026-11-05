import { chromium } from "@playwright/test";
const OUT = process.argv[2];
const notes = `Photosynthesis
Photosynthesis is the process by which green plants convert light energy into chemical energy stored in glucose. It takes place in the chloroplasts, which contain the green pigment chlorophyll. Carbon dioxide and water are used, and oxygen is released as a by-product.

Cellular respiration
Cellular respiration releases energy from glucose so that cells can do work. Aerobic respiration uses oxygen and produces carbon dioxide and water. Most of the ATP is made in the mitochondria.

Enzymes
Enzymes are biological catalysts that speed up reactions without being used up. Each enzyme has an active site with a specific shape that fits one substrate. High temperatures denature an enzyme because the active site changes shape.`;
const b = await chromium.launch();
let n = 0;
for (const [tag, viewport] of [["d", { width: 1440, height: 900 }], ["m", { width: 390, height: 844 }]]) {
  const p = await (await b.newContext({ viewport, reducedMotion: "reduce" })).newPage();
  const shot = async (name) => { await p.waitForTimeout(700); n += 1; await p.screenshot({ path: `${OUT}/${tag}-${String(n).padStart(2, "0")}-${name}.png`, fullPage: true }); };
  await p.goto("http://localhost:4310/today/", { waitUntil: "networkidle" }); await shot("start");
  await p.getByText("Or paste your notes").click(); await p.locator("#paste-notes").fill(notes);
  await p.getByRole("button", { name: "Use these notes" }).click();
  await p.getByRole("heading", { name: "Check the topics in your notes." }).waitFor({ timeout: 45000 }); await shot("topics-check");
  await p.getByRole("button", { name: /^(?:Use|Start with) \d+ topics?$/ }).click();
  await p.waitForTimeout(10);
  await p.waitForURL(/session/); await shot("read");
  const cont = p.getByRole("button", { name: /^Continue/ });
  while (await cont.isVisible().catch(() => false)) { await cont.click(); await p.waitForTimeout(300); }
  await shot("read-end");
  const skip = p.getByRole("button", { name: /Skip to the questions|Start the questions|From memory|Now the questions/ });
  if (await skip.first().isVisible().catch(() => false)) await skip.first().click();
  for (let i = 0; i < 4; i++) {
    await p.locator('#run-explain, input[id^="run-gap"]:not([disabled]), [role="group"][aria-label="Choose one"] button:not([disabled])').first().waitFor({ timeout: 15000 });
    if (await p.locator("#run-explain").isVisible().catch(() => false)) break;
    await shot(`check${i + 1}`);
    const gap = p.locator('input[id^="run-gap"]:not([disabled])');
    if (await gap.count()) { await gap.fill("glucose"); await p.getByRole("button", { name: "Check", exact: true }).click(); }
    else await p.getByRole("group", { name: "Choose one" }).getByRole("button").nth(1).click();
    await shot(`check${i + 1}-feedback`);
    await p.getByRole("button", { name: /^(Next idea|Next question|Next(?! section)|Now say it yourself)/ }).click();
  }
  await shot("explain");
  await p.locator("#run-explain").fill("Plants use light to make glucose in the chloroplasts.");
  await p.getByRole("button", { name: /Compare with the page/ }).click(); await shot("compare");
  await p.getByRole("button", { name: /Partly/ }).click(); await shot("result");
  const fin = p.getByRole("button", { name: /Finish session|Next topic|Continue to/ }).first();
  if (await fin.isVisible().catch(() => false)) { await fin.click(); await shot("after-result"); }
  if (/session\/complete/.test(p.url()) === false) { const done = p.getByRole("button", { name: /See how it went|Finish/ }).first(); if (await done.isVisible().catch(() => false)) { await done.click(); await shot("done"); } }
  await p.goto("http://localhost:4310/today/", { waitUntil: "networkidle" }); await shot("today-return");
  await p.goto("http://localhost:4310/today/?section=progress", { waitUntil: "networkidle" }); await shot("progress");
  await p.goto("http://localhost:4310/today/?section=map", { waitUntil: "networkidle" }); await shot("topics");
  await p.goto("http://localhost:4310/today/?section=materials", { waitUntil: "networkidle" }); await shot("materials");
}
await b.close();
