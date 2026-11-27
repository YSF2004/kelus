"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import {
  analyticsOptedOut,
  connectPostHog,
  disconnectPostHog,
  kelusPageCategory,
  POSTHOG_API_HOST,
  POSTHOG_PROJECT_KEY,
  trackPostHogPageViewed,
} from "@/lib/analytics";

let postHogModule: Promise<typeof import("posthog-js")> | null = null;
let initializedKey: string | null = null;

export function PostHogAnalytics() {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!POSTHOG_PROJECT_KEY || analyticsOptedOut()) return;

    let active = true;
    postHogModule ??= import("posthog-js");

    void postHogModule
      .then(({ default: posthog }) => {
        if (!active || analyticsOptedOut()) return;

        if (initializedKey !== POSTHOG_PROJECT_KEY) {
          posthog.init(POSTHOG_PROJECT_KEY, {
            api_host: POSTHOG_API_HOST,
            autocapture: false,
            capture_exceptions: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
            disable_capture_url_hashes: true,
            save_referrer: false,
            save_campaign_params: false,
            person_profiles: "never",
            persistence: "localStorage",
            before_send: (event) => {
              if (!event) return null;

              const properties = Object.fromEntries(
                Object.entries(event.properties ?? {}).filter(
                  ([key]) => !/(url|pathname|referrer|host)/i.test(key),
                ),
              );
              return { ...event, properties };
            },
          });
          initializedKey = POSTHOG_PROJECT_KEY;
        }

        connectPostHog((name, properties) => {
          posthog.capture(name, properties);
        });
      })
      .catch((error: unknown) => {
        console.warn("PostHog could not be initialized; Kelus analytics remain optional.", error);
      });

    return () => {
      active = false;
      disconnectPostHog();
    };
  }, []);

  useEffect(() => {
    if (!POSTHOG_PROJECT_KEY || analyticsOptedOut()) return;

    // Deduplicate React re-renders, while still recording real navigation. The
    // raw path never leaves the browser; only its fixed category is captured.
    const path = pathname.replace(/\/+$/, "") || "/";
    if (lastTrackedPath.current === path) return;
    lastTrackedPath.current = path;
    trackPostHogPageViewed(kelusPageCategory(path));
  }, [pathname]);

  return null;
}
