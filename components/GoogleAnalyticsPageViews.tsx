"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { GA_MEASUREMENT_ID, analyticsEnabled, setPilotCohort, trackEvent } from "@/lib/analytics";
import { captureCohort } from "@/lib/pilot";

export function GoogleAnalyticsPageViews() {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    if (!analyticsEnabled()) return;
    const query = search ? `?${search}` : "";
    // kelus.me/?pilot=group tags this browser, so a pilot group's numbers can be read on their own.
    setPilotCohort(captureCohort(query));
    // Arrived from a classmate's invite: counted once, on the page the link opened.
    if (new URLSearchParams(search).get("via") === "invite") trackEvent({ name: "invite_opened" });
    trackEvent({
      name: "page_view",
      // Query strings can contain auth codes or other private values. Cohort
      // and invite markers are handled separately without sending the URL.
      page_path: pathname,
      page_location: `${window.location.origin}${pathname}`,
      page_title: document.title,
      send_to: GA_MEASUREMENT_ID,
    });
  }, [pathname, search]);

  return null;
}
