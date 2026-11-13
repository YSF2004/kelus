"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { ArrowRight } from "@/components/Marks";
import { ResultCardFace } from "@/components/ResultShareCard";
import { trackEvent } from "@/lib/analytics";
import { statsFromQuery } from "@/lib/share-result";
import styles from "./r.module.css";

/**
 * Where a shared result lands: the classmate's card, exactly as it was sent, then one way in. Nothing here is a
 * challenge or a score to beat; it says what Kelus did for them and offers the same with your own notes.
 */
export function SharedResult() {
  const reduce = useReducedMotion() === true;
  const stats = statsFromQuery(useSearchParams());
  const valid = Boolean(stats);
  useEffect(() => { trackEvent({ name: "shared_result_opened", valid }); }, [valid]);
  const rise = (delay: number) => (reduce ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <main id="main" className={styles.page} data-shared-result="">
      <motion.p className={styles.kicker} {...rise(0)}>{stats ? "A classmate sent you this" : "Kelus"}</motion.p>
      <motion.h1 className={styles.title} {...rise(0.05)}>{stats ? "They turned a study pass into a plan for tomorrow." : "Revise from your own notes."}</motion.h1>
      {stats ? <motion.div {...rise(0.12)}><ResultCardFace stats={stats} kicker="Their revision" /></motion.div> : null}
      <motion.div className={styles.next} {...rise(0.2)}>
        <p>Start with one lecture. Kelus reads your PDF, slides or pasted notes, asks from your own lines, and brings back what needs another attempt tomorrow.</p>
        <div className={styles.actions}>
          <Link href="/today?source=shared-result" className="k-btn" onClick={() => trackEvent({ name: "shared_result_cta", target: "own_notes" })}>Start with your notes <ArrowRight /></Link>
          <Link href="/today?sample=1" className={styles.secondary} onClick={() => trackEvent({ name: "shared_result_cta", target: "sample" })}>Try the example course</Link>
        </div>
      </motion.div>
    </main>
  );
}
