import assert from "node:assert/strict";
import test from "node:test";
import { rejectPastPaperMatch, restorePastPaperMatch, withoutRejectedPastPaperMatches } from "../lib/past-paper-corrections.ts";

const questionMaps = [{
  id: "past-1-1",
  pageNumber: 1,
  text: "Explain osmosis across a selectively permeable membrane.",
  matches: [
    { conceptId: "osmosis", conceptName: "Osmosis", mastery: .3, score: 4, sources: [] },
    { conceptId: "membrane", conceptName: "Cell membrane", mastery: .7, score: 2, sources: [] },
  ],
}];

test("a rejected past-paper link stays out of the student’s revision map until restored", () => {
  const corrections = rejectPastPaperMatch([], questionMaps[0].text, "membrane");
  const filtered = withoutRejectedPastPaperMatches(questionMaps, corrections);
  assert.deepEqual(filtered[0].matches.map((match) => match.conceptId), ["osmosis"]);
  const restored = restorePastPaperMatch(corrections, questionMaps[0].text, "membrane");
  assert.equal(restored.length, 0);
  assert.equal(withoutRejectedPastPaperMatches(questionMaps, restored)[0].matches.length, 2);
});
