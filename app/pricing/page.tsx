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
        <PackArt name="time-flies" className="pricing-hero-art" size={160} />
        <h1>Start revising. Stay in control.</h1>
        <p className="legal-lede">
          Revise your own course for free. Kelus Plus is planned at $4.99/month.
          {syncReady
            ? " Free sign-in can sync your revision progress; source-file sync is still being tested."
            : " Your progress stays on this device."}
        </p>

        <div className="pricing-booklet-stack pricing-grid" role="list">
          <PricingPlanMotion>
            <article className="pricing-offer is-free pricing-plan">
              <div className="pricing-offer-head">
                <div className="pricing-plan-name"><h2 className="kicker">Free</h2><span className="pricing-availability">Available now</span></div>
                <p className="pricing-price">$0<span>/month</span></p>
              </div>
              <p className="pricing-offer-lede">Everything in Kelus today, with no limits.</p>
              <ul>
                <li>Add your PDFs, slides or notes</li>
                <li>Questions written from your own lines</li>
                <li>A plan that moves with your answers</li>
                <li>Export every question to Anki</li>
                <li>No account required</li>
                {syncReady ? <li>Optional free sign-in to sync revision progress</li> : <li>Saved on this device</li>}
              </ul>
              <Link className="cta" href="/today">
                Start revising
              </Link>
            </article>
          </PricingPlanMotion>

          <PricingPlanMotion>
            <article className={`pricing-offer is-pass pricing-plan is-founding${paymentReady ? "" : " is-upcoming"}`}>
              <div className="pricing-offer-head">
                <div className="pricing-plan-name"><h2 className="kicker">Kelus Plus</h2><span className="pricing-availability">{paymentReady ? "Available now" : "Coming soon"}</span></div>
                <p className="pricing-price">
                  $4.99<span>/month</span>
                </p>
              </div>
              <p className="pricing-offer-lede">Planned, not built yet. What we’re making for it:</p>
              <ul>
                <li>Everything in Free</li>
                <li>Clearer reading of scanned and handwritten pages</li>
                <li>Several courses side by side for exam season</li>
                <li>Email support from a person, within a day</li>
                <li>Monthly; cancel any time</li>
              </ul>
              <FoundingCta source="pricing" form={false} />
            </article>
          </PricingPlanMotion>
        </div>

        {paymentReady ? null : (
          <section className="pricing-notify" aria-labelledby="pricing-notify-title">
            <h2 id="pricing-notify-title">Hear when Plus opens</h2>
            <WaitlistForm source="pricing" compact />
          </section>
        )}

        <section className="pricing-faq" aria-labelledby="pricing-faq-title">
          <h2 id="pricing-faq-title">Good to know</h2>
          <dl>
            <div><dt>Is Free really free?</dt><dd>Yes. No card, no account, and no trial that runs out.</dd></div>
            <div><dt>What changes when Plus opens?</dt><dd>Nothing for Free. You choose whether to switch, and we email the waitlist once.</dd></div>
            <div><dt>Where is my work kept?</dt><dd>Your work starts on this device. Free sign-in can sync revision progress; keep a copy of your source files while file sync is being tested.</dd></div>
          </dl>
        </section>

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
