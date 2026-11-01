import { createDemoLearningActivities } from "@/data/demo-learning-activities";
import { buildQuickRun } from "@/domain/quick-run";

/** A labelled demonstration, never a learner course or a pilot session. */
export function buildFirstStudyExample() {
  const topic = "Elasticity";
  const activity = createDemoLearningActivities().find((item) => item.conceptId === "c-elasticity");
  if (!activity) return null;
  const run = buildQuickRun({
    activity,
    name: topic,
    siblingNames: ["Supply & Demand", "Consumer Choice", "Market Structures"],
    readFirst: true,
  });
  const check = run?.checks.find((item) =>
    item.kind === "choice" && item.choices?.length
    && typeof item.correctIndex === "number"
    && item.correctIndex >= 0 && item.correctIndex < item.choices.length
    && item.explanation?.trim()
    && run.sentences.some((sentence) => sentence.trim() === item.sourceQuote?.trim()),
  );
  if (!run || !check) return null;
  return { topic, title: activity.learn.title, sentences: run.sentences, check };
}
