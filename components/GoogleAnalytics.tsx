import Script from "next/script";
import { GA_MEASUREMENT_ID } from "@/lib/analytics";
import { GoogleAnalyticsPageViews } from "@/components/GoogleAnalyticsPageViews";

export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

  const measurementId = JSON.stringify(GA_MEASUREMENT_ID);
  // kelus.me/?internal=1 marks this device as the team's own: Google's opt-out switch then keeps every visit from it
  // out of the numbers, so they count students only. ?internal=0 undoes it. A short note says which way it went.
  const bootstrap = `
(function () {
  var key = "kelus-internal";
  var url = new URL(window.location.href);
  var asked = url.searchParams.get("internal");
  try {
    if (asked === "1") window.localStorage.setItem(key, "1");
    if (asked === "0") window.localStorage.removeItem(key);
    if (window.localStorage.getItem(key) === "1") window["ga-disable-" + ${measurementId}] = true;
  } catch (error) {}
  if (asked === "1" || asked === "0") {
    url.searchParams.delete("internal");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    var note = document.createElement("p");
    note.setAttribute("role", "status");
    note.textContent = asked === "1" ? "This device is now internal: Kelus will not count its visits." : "This device counts again in Kelus analytics.";
    note.style.cssText = "position:fixed;left:50%;bottom:24px;z-index:9999;transform:translateX(-50%);margin:0;padding:10px 16px;border-radius:8px;background:#0e1512;color:#fff;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)";
    document.body.appendChild(note);
    setTimeout(function () { note.remove(); }, 5000);
  }
})();
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function gtag(){window.dataLayer.push(arguments);};
window.gtag("consent", "default", {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "granted"
});
window.gtag("js", new Date());
window.gtag("config", ${measurementId}, {
  send_page_view: false,
  allow_google_signals: false,
  allow_ad_personalization_signals: false,
  anonymize_ip: true
});
window.dispatchEvent(new Event("kelus-analytics-ready"));
`;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
      <Script id="kelus-ga-bootstrap" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: bootstrap }} />
      <GoogleAnalyticsPageViews />
    </>
  );
}
