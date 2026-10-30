type GoogleAnalyticsParameter = string | number | boolean | undefined;

interface Window {
  dataLayer: unknown[];
  kelusAnalyticsReady?: boolean;
  gtag?: (
    command: "js" | "config" | "event" | "consent" | "set",
    targetOrDateOrEvent: Date | string,
    parameters?: Record<string, GoogleAnalyticsParameter>,
  ) => void;
}
