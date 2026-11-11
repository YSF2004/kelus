export type GoogleAnalyticsValue = string | number | boolean | null;
export type GoogleAnalyticsParameters = Record<string, GoogleAnalyticsValue>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function queueGoogleAnalyticsEvent(
  eventName: string,
  parameters: GoogleAnalyticsParameters = {},
) {
  if (typeof window === "undefined") return;
  window.dataLayer ??= [];
  window.gtag ??= (...args: unknown[]) => window.dataLayer?.push(args);
  window.gtag("event", eventName, parameters);
}

