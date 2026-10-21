import assert from "node:assert/strict";
import test from "node:test";
import { sourceKind } from "../domain/source-kind.ts";

test("a CV, a letter and an invoice are told apart from notes; notes about the same words stay notes", () => {
  const cv = "Youssef Example\nyoussef@example.com · +212 600 000 000 · linkedin.com/in/example\n\nEducation\nBachelor of Business Administration, 2020 – 2023\n\nExperience\nAccounting Intern, Example SA, 2022 – Present\nPrepared monthly reports.\n\nSkills\nExcel, Digital Marketing, Commercial strategy\n\nLanguages\nEnglish, French";
  assert.equal(sourceKind(cv), "cv");
  assert.equal(sourceKind("Dear Hiring Manager,\nI am writing to apply for the role.\nYours sincerely,\nSam\nsam@example.com"), "letter");
  assert.equal(sourceKind("INVOICE 042\nBill to: Example Ltd\nQty 2 · Unit price 40\nSubtotal 80\nVAT 16\nAmount due 96"), "invoice");
  const notes = "Osmosis\nOsmosis is the movement of water across a partially permeable membrane from a dilute solution to a more concentrated solution. In a hypotonic solution a plant cell gains water because the cell wall pushes back.\n\nEnzymes\nEnzymes are biological catalysts that speed up reactions without being used up.";
  assert.equal(sourceKind(notes), "notes");
  const lecture = "Writing a CV\nA CV is a short document that summarises your education and experience. Recruiters read it quickly because they receive many applications. The skills section is where most students lose marks, since it lists tools without evidence.";
  assert.equal(sourceKind(lecture), "notes", "a lesson about CVs is still a lesson");
});
