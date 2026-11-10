import assert from "node:assert/strict";
import test from "node:test";
import {
  CHALLENGE_BUCKET,
  MAX_CHALLENGE_CARDS,
  cardsForSession,
  parseChallengeSnapshot,
  trustedChallengeSource,
} from "../lib/challenge-share.ts";

const activity = {
  conceptId: "topic-1",
  retrieve: {
    prompt: "What does diffusion describe?",
    modelAnswer: "The net movement of particles from higher to lower concentration.",
    explanation: "Particles move down a concentration gradient.",
    sourceQuote: "PRIVATE SOURCE QUOTE",
    sourceReference: { label: "private.pdf", locator: "page 8" },
  },
  apply: {
    prompt: "Apply diffusion to a drop of dye in water.",
    modelAnswer: "The dye spreads from its high-concentration region into the water.",
    sourceQuote: "PRIVATE APPLY QUOTE",
  },
};

test("a challenge contains only the selected session questions and answers", () => {
  const cards = cardsForSession([activity], ["topic-1", "unselected-topic"]);
  assert.deepEqual(cards, [
    {
      question: "What does diffusion describe?",
      answer: "The net movement of particles from higher to lower concentration.",
      explanation: "Particles move down a concentration gradient.",
    },
    {
      question: "Apply diffusion to a drop of dye in water.",
      answer: "The dye spreads from its high-concentration region into the water.",
    },
  ]);
  assert.equal(JSON.stringify(cards).includes("PRIVATE"), false);
  assert.equal(JSON.stringify(cards).includes("private.pdf"), false);
});

test("a challenge is bounded to twelve cards and filters duplicate prompts", () => {
  const activities = Array.from({ length: 8 }, (_, index) => ({
    ...activity,
    conceptId: `topic-${index}`,
    retrieve: { ...activity.retrieve, prompt: `${activity.retrieve.prompt} ${index}` },
    apply: { ...activity.apply, prompt: `${activity.apply.prompt} ${index}` },
  }));
  const cards = cardsForSession(activities, activities.map((item) => item.conceptId));
  assert.equal(cards.length, MAX_CHALLENGE_CARDS);
  assert.equal(new Set(cards.map((card) => card.question)).size, cards.length);
});

test("incoming payloads are whitelisted and malformed or oversized cards are rejected", () => {
  assert.deepEqual(
    parseChallengeSnapshot({
      version: 1,
      courseName: "must not be exposed",
      cards: [{ question: "Q", answer: "A", sourceQuote: "private", learnerAnswer: "private" }],
    }),
    { version: 1, cards: [{ question: "Q", answer: "A" }] },
  );
  assert.equal(parseChallengeSnapshot({ version: 1, cards: [] }), null);
  assert.equal(parseChallengeSnapshot({ version: 1, cards: Array(13).fill({ question: "Q", answer: "A" }) }), null);
  assert.equal(parseChallengeSnapshot({ version: 1, cards: [{ question: "Q", answer: "A".repeat(4001) }] }), null);
});

test("only signed links from the configured private storage bucket are accepted", () => {
  const base = "https://kelus-test.supabase.co";
  const signed = `${base}/storage/v1/object/sign/${CHALLENGE_BUCKET}/user/challenges/id.txt?token=signed`;
  const hash = `#${new URLSearchParams({ source: signed })}`;
  assert.equal(trustedChallengeSource(hash, base), signed);
  assert.equal(trustedChallengeSource(`#${new URLSearchParams({ source: signed.replace("kelus-test", "attacker") })}`, base), null);
  assert.equal(trustedChallengeSource(`#${new URLSearchParams({ source: `${base}/storage/v1/object/public/${CHALLENGE_BUCKET}/id.txt` })}`, base), null);
  assert.equal(trustedChallengeSource(`#${new URLSearchParams({ source: `${base}/storage/v1/object/sign/${CHALLENGE_BUCKET}/id.txt` })}`, base), null);
});
