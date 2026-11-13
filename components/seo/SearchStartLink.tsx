"use client";

import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

type SearchStartLinkProps = {
  action: string;
  landing: string;
  placement: "hero" | "faq" | "close";
  className?: string;
};

/** Keeps the search promise and the first-upload funnel connected without collecting search terms or note data. */
export function SearchStartLink({ action, landing, placement, className }: SearchStartLinkProps) {
  return (
    <Link
      href={`/today?source=${encodeURIComponent(landing)}`}
      className={className}
      onClick={() => trackEvent({ name: "search_landing_cta_clicked", landing, placement })}
    >
      {action}
    </Link>
  );
}
