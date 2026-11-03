import assert from "node:assert/strict";
import test from "node:test";
import { lineLife } from "../domain/line-life.ts";

const quote = "Demand falls as price rises, because buyers switch to substitutes or buy less.";
const nextLine = "Supply rises as price rises, because producers can cover higher costs.";
const activity = {
  conceptId: "c1",
  learn: { title: "", explanation: `${quote} ${nextLine}`, keyPoints: [] },
  sourceReferences: [{ materialId: "m", label: "Economics notes", locator: "Section 1" }],
  practice: [
    { id: "g", kind: "cloze", origin: "offline", prompt: `Fill the gap: “${quote.replace("price", "_____")}”`, modelAnswer: "price", sourceQuote: quote, hint: "", explanation: "" },
    { id: "t", kind: "choice", variant: "truefalse", origin: "offline", prompt: `True or false, from your notes: “${quote.replace("falls", "rises")}”`, choices: ["True", "False"], correctIndex: 1, modelAnswer: "False", sourceQuote: quote, hint: "", explanation: "" },
  ],
};
const line = { quote, conceptId: "c1", topic: "Supply and Demand", box: 3, state: "recalled", movedToday: false };

test("a line's story: where it is, what follows it, how it is asked, every answer, and when it is back", () => {
  const life = lineLife({
    line, activity,
    known: [{ conceptId: "c1", name: "Supply and Demand", quote, at: "2026-11-03T10:00:00.000Z", streak: 2 }],
    history: [
      { quote, at: "2026-11-01T10:00:00.000Z", right: false },
      { quote, at: "2026-11-02T10:00:00.000Z", right: true },
      { quote: "Another line.", at: "2026-11-02T10:00:00.000Z", right: true },
      { quote, at: "2026-11-03T10:00:00.000Z", right: true },
    ],
  });
  assert.equal(life.source, "Economics notes · Section 1");
  assert.equal(life.next, nextLine);
  assert.equal(life.asked.length, 2);
  assert.deepEqual(life.answers.map((answer) => answer.right), [false, true, true]);
  assert.equal(life.backOn, "2026-11-07", "Box 3 waits four days after the last recall");
  assert.match(life.reason ?? "", /“rises”.*“falls”/, "the true/false contrast explains the line; a gap's template does not");
});

test("a missed or new line has no date to be back on, and a line with no questions says nothing invented", () => {
  const missed = lineLife({ line: { ...line, box: 1, state: "missed" }, activity, known: [], history: [] });
  assert.equal(missed.backOn, null);
  const bare = lineLife({ line: { ...line, quote: "A line no question quotes.", box: 1, state: "new" }, activity, known: [], history: [] });
  assert.deepEqual(bare.asked, []);
  assert.equal(bare.reason, null);
  assert.equal(bare.next, null);
});
