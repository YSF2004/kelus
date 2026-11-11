import { expect, test } from "@playwright/test";

function singlePagePdf(content: string[]) {
  const stream = content.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

function biologyPdf() {
  return singlePagePdf([
    "BT",
    "/F1 20 Tf",
    "1 0 0 1 72 720 Tm",
    "(CELLULAR RESPIRATION) Tj",
    "/F1 11 Tf",
    "1 0 0 1 72 684 Tm",
    "(Cells transfer energy from glucose into ATP.) Tj",
    "1 0 0 1 72 666 Tm",
    "(The process includes glycolysis, the citric acid cycle, and oxidative phosphorylation.) Tj",
    "/F1 18 Tf",
    "1 0 0 1 72 612 Tm",
    "(Electron transport chain) Tj",
    "/F1 11 Tf",
    "1 0 0 1 72 582 Tm",
    "(Electrons move through membrane proteins and create the proton gradient used by ATP synthase.) Tj",
    "ET",
  ]);
}

function computerSciencePdf() {
  return singlePagePdf([
    "BT",
    "/F1 20 Tf",
    "1 0 0 1 72 720 Tm",
    "(HASH TABLES) Tj",
    "/F1 11 Tf",
    "1 0 0 1 72 684 Tm",
    "(A hash table stores key value pairs by converting each key into an array position.) Tj",
    "1 0 0 1 72 666 Tm",
    "(Collisions require a strategy such as chaining or open addressing.) Tj",
    "/F1 18 Tf",
    "1 0 0 1 72 612 Tm",
    "(GRAPH TRAVERSAL) Tj",
    "/F1 11 Tf",
    "1 0 0 1 72 582 Tm",
    "(Breadth first search explores neighbors by level while depth first search follows one path.) Tj",
    "ET",
  ]);
}

test("a new student reaches a cited learning session from one PDF", async ({ page }) => {
  await page.goto("/today");
  await page.getByLabel("Course").fill("Biology");
  await page.getByLabel("Destination").fill("Final exam");
  await page.getByRole("button", { name: "Continue" }).click();

  const examDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').fill(examDate);
  await page.getByRole("button", { name: "Add course material" }).click();
  await expect(page).toHaveURL(/\/materials/);

  await page.locator('input[type="file"]').last().setInputFiles({ name: "biology.pdf", mimeType: "application/pdf", buffer: biologyPdf() });
  await expect(page.getByRole("heading", { name: /Kelus found 2 proposed concepts/ })).toBeVisible();
  await page.getByRole("button", { name: /Build my Knowledge Map/ }).click();
  await expect(page).toHaveURL(/\/map/);
  await page.waitForTimeout(450);
  await page.getByRole("link", { name: /Continue to diagnosis/ }).last().click();
  await page.waitForTimeout(450);

  const weakButtons = page.getByRole("button", { name: "Weak" });
  for (let index = 0; index < await weakButtons.count(); index += 1) await weakButtons.nth(index).click();
  await page.getByRole("button", { name: /Check my recall/ }).click();

  for (let check = 0; check < 3; check += 1) {
    await page.getByLabel("Try without notes.").fill("Energy is transferred from glucose into ATP.");
    await page.getByRole("button", { name: "Compare answer" }).click();
    await page.getByRole("button", { name: "Use this evidence" }).click();
    if (await page.getByRole("button", { name: /Start learning/ }).isVisible().catch(() => false)) break;
  }

  await expect(page.getByRole("heading", { name: "Do this now." })).toBeVisible();
  await page.getByRole("button", { name: /Start learning/ }).click();
  await expect(page).toHaveURL(/\/session/);
  await page.waitForTimeout(450);
  await expect(page.getByText("From your course").last()).toBeVisible();
  await expect(page.getByRole("button", { name: /biology\.pdf|biology/i }).last()).toContainText("Page 1");

  await page.getByRole("button", { name: /Retrieve it/ }).click();
  await page.getByLabel(/Write from memory/).fill("Cells transfer energy from glucose into ATP.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Use the idea in a different situation/).fill("Muscle cells use ATP produced from stored glucose during exercise.");
  await page.getByRole("button", { name: /Check my thinking/ }).click();
  await page.getByRole("button", { name: "Update my route" }).click();
  await expect(page.getByText("Learner model updated")).toBeVisible();
});

test("a computer-science student completes the same grounded route without demo content", async ({ page }) => {
  await page.goto("/today");
  await page.getByLabel("Course").fill("Computer Science");
  await page.getByLabel("Destination").fill("Algorithms exam");
  await page.getByRole("button", { name: "Continue" }).click();
  const examDate = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('input[type="date"]').fill(examDate);
  await page.getByRole("button", { name: "Add course material" }).click();

  await page.locator('input[type="file"]').last().setInputFiles({ name: "algorithms.pdf", mimeType: "application/pdf", buffer: computerSciencePdf() });
  await expect(page.getByRole("heading", { name: /Kelus found 2 proposed concepts/ })).toBeVisible();
  await page.getByRole("button", { name: /Build my Knowledge Map/ }).click();
  await page.waitForTimeout(450);
  await page.getByRole("link", { name: /Continue to diagnosis/ }).last().click();
  await page.waitForTimeout(450);

  const weakButtons = page.getByRole("button", { name: "Weak" });
  for (let index = 0; index < await weakButtons.count(); index += 1) await weakButtons.nth(index).click();
  await page.getByRole("button", { name: /Check my recall/ }).click();
  for (let check = 0; check < 3; check += 1) {
    await page.getByLabel("Try without notes.").fill("A hash table stores key value pairs by converting each key into an array position.");
    await page.getByRole("button", { name: "Compare answer" }).click();
    await page.getByRole("button", { name: "Use this evidence" }).click();
    if (await page.getByRole("button", { name: /Start learning/ }).isVisible().catch(() => false)) break;
  }

  await page.getByRole("button", { name: /Start learning/ }).click();
  await expect(page).toHaveURL(/\/session/);
  await page.waitForTimeout(450);
  await expect(page.getByRole("button", { name: /algorithms\.pdf|algorithms/i }).last()).toContainText("Page 1");
  await page.getByRole("button", { name: /Retrieve it/ }).click();
  await page.getByLabel(/Write from memory/).fill("A hash table stores key value pairs by turning each key into an array position.");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel(/Use the idea in a different situation/).fill("For a cache, I would hash each request key into a position and handle collisions with chaining.");
  await page.getByRole("button", { name: /Check my thinking/ }).click();
  await page.getByRole("button", { name: "Update my route" }).click();
  await expect(page.getByText("Learner model updated")).toBeVisible();
});
