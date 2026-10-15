/**
 * Checkpoints on the course path remember how they went: the latest run of each, kept in the learner state and
 * synced with an account. Four lines out of five right is a pass.
 */

import { getDemoSnapshot, subscribeDemoState, updateCheckpoints, type CheckpointResult } from "@/lib/demo-store";

export type { CheckpointResult };

const EMPTY: CheckpointResult[] = [];
export const PASS_SHARE = 0.8;

/** The same topics make the same checkpoint, in whatever order they were listed. */
export function checkpointKey(conceptIds: string[]) {
  return [...conceptIds].sort().join(",");
}

export function passed(result: CheckpointResult | undefined) {
  return Boolean(result && result.total > 0 && result.right / result.total >= PASS_SHARE);
}

export function getCheckpoints() {
  if (typeof window === "undefined") return EMPTY;
  return getDemoSnapshot().checkpoints ?? EMPTY;
}

export function getServerCheckpoints() {
  return EMPTY;
}

export function subscribeCheckpoints(onChange: () => void) {
  return subscribeDemoState(onChange);
}

export function recordCheckpoint(conceptIds: string[], right: number, total: number, at: string) {
  const key = checkpointKey(conceptIds);
  updateCheckpoints((current) => [...current.filter((result) => result.key !== key), { key, right, total, at }]);
}
