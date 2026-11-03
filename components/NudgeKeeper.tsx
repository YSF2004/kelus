"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useLearner } from "@/components/LearnerProvider";
import { getMissedLines, getServerMissedLines, subscribeMissedLines } from "@/lib/missed-lines";
import { getNudgeSettings, getServerNudgeSettings, maybeNudgeNow, readyCount, showReadyBadge, subscribeNudgeSettings, writeNudgeSummary, type NudgeSummary } from "@/lib/nudge";

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Runs quietly on every page. It keeps the background worker's summary up to date, checks the once-a-day nudge
 * while a tab is open, and, when you are in another tab, puts the number of lines ready for a warm-up in this tab's
 * title, like an unread count. On an installed app the same count sits on its icon.
 */
export function NudgeKeeper() {
  const { state } = useLearner();
  const missed = useSyncExternalStore(subscribeMissedLines, getMissedLines, getServerMissedLines);
  const settings = useSyncExternalStore(subscribeNudgeSettings, getNudgeSettings, getServerNudgeSettings);
  const lastAnswerAt = useMemo(() => state.snapshot.events.filter((event) => event.kind === "retrieval").reduce<string | null>((latest, event) => (!latest || event.createdAt > latest ? event.createdAt : latest), null), [state.snapshot.events]);
  const summary: NudgeSummary = useMemo(() => {
    const dated = missed.filter((line) => Number.isFinite(Date.parse(line.at)));
    return { ...settings, lines: dated.map((line) => Date.parse(line.at)), topics: dated.map((line) => line.name), lastAnswerAt };
  }, [settings, missed, lastAnswerAt]);

  useEffect(() => { writeNudgeSummary(summary); }, [summary]);

  useEffect(() => {
    if (!summary.on) return;
    const check = () => { void maybeNudgeNow(summary); };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, [summary]);

  useEffect(() => {
    const badge = () => showReadyBadge(readyCount(summary.lines, Date.now()));
    badge();
    const timer = window.setInterval(badge, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", badge);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", badge); };
  }, [summary.lines]);

  useEffect(() => {
    if (!summary.lines.length) return;
    let original: string | null = null;
    const update = () => {
      const ready = readyCount(summary.lines, Date.now());
      if (document.hidden && ready > 0) {
        original ??= document.title;
        document.title = `(${ready}) Warm-up ready · Kelus`;
      } else if (original !== null) {
        document.title = original;
        original = null;
      }
    };
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      if (original !== null) document.title = original;
    };
  }, [summary.lines]);

  return null;
}
