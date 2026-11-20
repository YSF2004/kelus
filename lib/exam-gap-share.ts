export function examGapShareText(input: { promptCount: number; unmatchedPromptCount: number }) {
  const prompt = input.promptCount === 1 ? "prompt" : "prompts";
  if (input.unmatchedPromptCount) {
    const unmatched = input.unmatchedPromptCount === 1 ? "prompt has" : "prompts have";
    return `Kelus checked ${input.promptCount} past-paper ${prompt} against my notes. ${input.unmatchedPromptCount} ${unmatched} no confirmed support yet — a useful gap to fix before the exam.`;
  }
  return `Kelus checked ${input.promptCount} past-paper ${prompt} against my notes. Every prompt has a confirmed source-backed study topic.`;
}
