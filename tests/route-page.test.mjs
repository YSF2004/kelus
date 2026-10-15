import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("homepage presents the real product video followed by the illustrated revision story", () => {
  const page = readFileSync("app/page.tsx", "utf8");
  const hero = readFileSync("components/hero/KelusHero.tsx", "utf8");
  const story = readFileSync("components/home/HomeAfterHero.tsx", "utf8");
  assert.match(page, /KelusHero/);
  assert.doesNotMatch(page, /StartHereJourney/);
  assert.match(page, /HomeAfterHero/);
  assert.match(hero, /is-folio|is-poster/);
  assert.match(hero, /Revise your lessons/);
  assert.doesNotMatch(hero, /Try sample \(~1 min\)/);
  assert.doesNotMatch(hero, /today\?sample=1/);
  assert.match(hero, /Add your notes/);
  assert.doesNotMatch(hero, /Set up with your own course material/);
  assert.match(hero, /HeroProductVideo/);
  const video = readFileSync("components/hero/HeroProductVideo.tsx", "utf8");
  assert.match(video, /kelus-product-walkthrough\.webm/);
  assert.match(video, /kelus-product-walkthrough-mobile\.webm/);
  // WebM only: an MP4 could not be re-encoded here, and an old recording is worse than the current poster.
  assert.doesNotMatch(video, /\.mp4/);
  assert.match(video, /WALKTHROUGH_START_SECONDS = 0/); // the drop of the PDF is the opening shot
  assert.doesNotMatch(video, /playbackButton/);
  assert.doesNotMatch(video, /Recorded in Kelus with a demo lecture PDF/);
  assert.doesNotMatch(video, /\bcontrols\b/);
  assert.doesNotMatch(hero, /LEARNING_EXAMPLES/);
  assert.doesNotMatch(hero, /home-brand/);
  assert.doesNotMatch(hero, /hero-window-controls/);
  assert.doesNotMatch(story, /HeroProductDemo/);
  assert.doesNotMatch(story, /BookletRevisionBoard|poster-sample|Interactive sample/);
  assert.match(story, /RevisionLoopVisuals/);
  assert.doesNotMatch(story, /home-close|folio-close|Walk into the exam knowing/);
  assert.doesNotMatch(story, /Try sample \(~1 min\)/);
  assert.doesNotMatch(story, /Set my exam/);
  assert.doesNotMatch(story, /folio-chapter|TodayPlanIllustration|RerouteIllustration|MaterialShelfIllustration/);
  assert.doesNotMatch(story, /Honest methodology|folio-method/);
  assert.doesNotMatch(page, /KnowledgeRouteStory/);
  assert.doesNotMatch(page, /<RouteStory/);
});

test("the start-here route explains the full first-use loop without generic cards", () => {
  const journey = readFileSync("components/home/StartHereJourney.tsx", "utf8");
  assert.match(journey, /Set the destination/);
  assert.match(journey, /Show what you know/);
  assert.match(journey, /Follow today’s route/);
  assert.match(journey, /Answer, then reroute/);
  assert.match(journey, /Kelus starts adapting here/);
  assert.match(journey, /Build my first route/);
  assert.match(journey, /useReducedMotion/);
});

test("route explainer lives on its own page", () => {
  const page = readFileSync("app/route/page.tsx", "utf8");
  const story = readFileSync("components/HowItWorks.tsx", "utf8");
  const examples = readFileSync("data/learning-examples.ts", "utf8");
  assert.match(page, /HowItWorks/);
  // The page describes the product as it is: topics found (not confirmed), three checks then your words, a plan
  // that moves from your own results. Its pictures are the product's own screens, not illustrations of them.
  assert.match(story, /Kelus finds the topics and links each one back to its page/);
  assert.match(story, /three quick checks written from your own lines, then one explanation in your own words/);
  assert.match(story, /The next session starts from what actually happened/);
  assert.doesNotMatch(story, /you confirm|starting estimate|apply the idea/);
  assert.doesNotMatch(story, /StudyScene|Illustration/);
  assert.match(story, /<h1 id="how-title"/);
  assert.doesNotMatch(story, /BlurText/);
  assert.match(story, /SourceVisual/);
  assert.match(story, /RecallVisual/);
  assert.match(story, /RerouteVisual/);
  assert.match(story, /data-tone=\{tone\}/);
  assert.match(examples, /Economics|Microeconomics/);
  assert.match(examples, /Computer science/);
  assert.match(examples, /History/);
  assert.doesNotMatch(story, /Choose an example course|exampleSwitcher|setExampleIndex/);
  assert.match(story, /not a predicted grade/i);
});

test("how-it-works illustrations explain causality without raster assets", () => {
  const illustrations = readFileSync("components/how/HowIllustrations.tsx", "utf8");
  assert.match(illustrations, /Course pages becoming a confirmed concept map/);
  assert.match(illustrations, /One selected study route through several possibilities/);
  assert.match(illustrations, /A learning answer changing the next route/);
  assert.match(illustrations, /useReducedMotion|reduceMotion/);
  assert.doesNotMatch(illustrations, /<img/);
});
