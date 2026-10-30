"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { GA_MEASUREMENT_ID, analyticsEnabled, setPilotCohort, trackEvent } from "@/lib/analytics";
import { captureCohort } from "@/lib/pilot";

export function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const lastTrackedUrl = useRef<string | null>(null);

  useEffect(() => {
    if (!analyticsEnabled()) return;

    const sendPageView = () => {
      if (typeof window.gtag !== "function") return;
      const url = window.location.href;
      if (lastTrackedUrl.current === url) return;
      lastTrackedUrl.current = url;
      // Tag this browser before its first view, including a visit from a classmate's invite.
      setPilotCohort(captureCohort(window.location.search));
      if (new URLSearchParams(window.location.search).get("via") === "invite") trackEvent({ name: "invite_opened" });
      window.gtag("event", "page_view", {
        page_path: `${pathname}${window.location.search}`,
        page_location: url,
        page_title: document.title,
        send_to: GA_MEASUREMENT_ID,
      });
    };

    // The first effect may run before next/script executes. The ready event is fired after gtag config.
    if (window.kelusAnalyticsReady) sendPageView();
    else window.addEventListener("kelus-analytics-ready", sendPageView, { once: true });
    return () => window.removeEventListener("kelus-analytics-ready", sendPageView);
  }, [pathname]);

  return null;
}
