"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type SearchStartLinkProps = {
  action: string;
  landing: string;
  placement: "hero" | "faq" | "close";
  className?: string;
  /** An optional, non-identifying pilot label. It follows the learner through their first route only. */
  pilot?: string;
};

/** Keeps the search promise and the first-upload funnel connected without collecting search terms or note data. */
export function SearchStartLink({ action, landing, placement, className, pilot }: SearchStartLinkProps) {
  const pilotParam = pilot ? `&pilot=${encodeURIComponent(pilot)}` : "";
  return (
    <Link
      href={`/today?source=${encodeURIComponent(landing)}${pilotParam}`}
      className={className}
      onClick={() => trackEvent({ name: "search_landing_cta_clicked", landing, placement })}
    >
      {action}
    </Link>
  );
}
