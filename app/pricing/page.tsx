import type { Metadata } from "next";
import Link from "next/link";
import { PackArt } from "@/components/PackArt";
import { SiteFooter } from "@/components/SiteFooter";
import { FoundingCta } from "@/components/FoundingCta";
import { WaitlistForm } from "@/components/WaitlistForm";
import { PricingViewTracker } from "@/components/PricingViewTracker";
import { authConfigured } from "@/lib/auth-config";
import { foundingPaymentConfigured } from "@/lib/founding";
import { LateralPage } from "@/components/PageTransition";
import { PricingPlanMotion } from "@/components/PricingPlanMotion";
import { Rise } from "@/components/PricingReveal";
import { rise } from "@/components/motion/rise";

export const metadata: Metadata = {
  title: "Kelus Pricing | Free Exam Revision & Planned Plus",
  description: "Start revising your own course for free, with no account required. Kelus Plus is planned at $4.99 per month; availability is shown on this page.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Kelus Pricing | Free Exam Revision & Planned Plus",
    description: "Start revising your own course for free. See what is included and whether Kelus Plus is available.",
    url: "/pricing/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus helps you revise from your course notes." }],
  },
};

export default function PricingPage() {
  const syncReady = authConfigured();
  const paymentReady = foundingPaymentConfigured();

  return (
    <LateralPage>
    <div data-marketing="editorial" className="legal-page pricing-page is-booklet-product is-booklet-pricing is-monthly-pricing">
    <main id="main">
      <PricingViewTracker />
      <section className="legal-panel pricing-booklet">
        {/* From the Kelus illustration pack: monthly, cancel any time, no trial that runs out. */}
        <PackArt name="time-flies" className="pricing-hero-art k-rise" size={190} />
        <h1 className="k-rise" style={rise(0.06, { y: 16, scale: 0.98 })}>Start revising. Stay in control.</h1>
        <p className="legal-lede k-rise" style={rise(0.14)}>
          Revise your own course for free. Kelus Plus is planned at $4.99/month.
          {syncReady
            ? " Free sign-in can sync your revision progress; source-file sync is still being tested."
            : " Your progress stays on this device."}
        </p>

        <div className="pricing-booklet-stack pricing-grid" role="list">
          <PricingPlanMotion delay={0.18}>
            <article className="pricing-offer is-free pricing-plan">
              <div className="pricing-offer-head">
                <div className="pricing-plan-name"><h2 className="kicker">Free</h2><span className="pricing-availability">Available now</span></div>
                <p className="pricing-price">$0<span>/month</span></p>
              </div>
              <p className="pricing-offer-lede">Everything in Kelus today, with no limits.</p>
              <ul>
                <li className="k-rise" style={rise(0.3, { y: 6, duration: 0.32 })}>Add your PDFs, slides or notes</li>
                <li className="k-rise" style={rise(0.33, { y: 6, duration: 0.32 })}>Questions written from your own lines</li>
                <li className="k-rise" style={rise(0.36, { y: 6, duration: 0.32 })}>A plan that moves with your answers</li>
                <li className="k-rise" style={rise(0.39, { y: 6, duration: 0.32 })}>Export every question to Anki</li>
                <li className="k-rise" style={rise(0.42, { y: 6, duration: 0.32 })}>No account required</li>
                <li className="k-rise" style={rise(0.45, { y: 6, duration: 0.32 })}>{syncReady ? "Optional free sign-in to sync revision progress" : "Saved on this device"}</li>
              </ul>
              <Link className="cta" href="/today">
                Start revising <span aria-hidden="true">→</span>
              </Link>
            </article>
          </PricingPlanMotion>

          <PricingPlanMotion delay={0.26}>
            <article className={`pricing-offer is-pass pricing-plan is-founding${paymentReady ? "" : " is-upcoming"}`}>
              <div className="pricing-offer-head">
                <div className="pricing-plan-name"><h2 className="kicker">Kelus Plus</h2><span className="pricing-availability">{paymentReady ? "Available now" : "Coming soon"}</span></div>
                <p className="pricing-price">
                  $4.99<span>/month</span>
                </p>
              </div>
              <p className="pricing-offer-lede">Planned, not built yet. What we’re making for it:</p>
              <ul>
                <li className="k-rise" style={rise(0.36, { y: 6, duration: 0.32 })}>Everything in Free</li>
                <li className="k-rise" style={rise(0.39, { y: 6, duration: 0.32 })}>Clearer reading of scanned and handwritten pages</li>
                <li className="k-rise" style={rise(0.42, { y: 6, duration: 0.32 })}>Several courses side by side for exam season</li>
                <li className="k-rise" style={rise(0.45, { y: 6, duration: 0.32 })}>Email support from a person, within a day</li>
                <li className="k-rise" style={rise(0.48, { y: 6, duration: 0.32 })}>Monthly; cancel any time</li>
              </ul>
              <FoundingCta source="pricing" form={false} />
            </article>
          </PricingPlanMotion>
        </div>

        {paymentReady ? null : (
          <Rise>
            <section className="pricing-notify" aria-labelledby="pricing-notify-title">
              <h2 id="pricing-notify-title">Hear when Plus opens</h2>
              <WaitlistForm source="pricing" compact />
            </section>
          </Rise>
        )}

        <Rise>
        <section className="pricing-faq" aria-labelledby="pricing-faq-title">
          <h2 id="pricing-faq-title">Good to know</h2>
          <dl>
            <div><dt>Is Free really free?</dt><dd>Yes. No card, no account, and no trial that runs out.</dd></div>
            <div><dt>What changes when Plus opens?</dt><dd>Nothing for Free. You choose whether to switch, and we email the waitlist once.</dd></div>
            <div><dt>Where is my work kept?</dt><dd>Your work starts on this device. Free sign-in can sync revision progress; keep a copy of your source files while file sync is being tested.</dd></div>
          </dl>
        </section>
        </Rise>

        <p className="legal-inline-links">
          Questions? Write to <a href="mailto:hello@kelus.me">hello@kelus.me</a>, <Link href="/questions">ask one here</Link>, or read the <Link href="/privacy">privacy note</Link>.
        </p>
      </section>
    </main>
      <SiteFooter compact />
    </div>
  </LateralPage>
  );
}
