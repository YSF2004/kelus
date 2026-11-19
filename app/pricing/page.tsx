import { KelusLogoMark } from "@/components/KelusLogoMark";
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

export const metadata: Metadata = {
  title: "Kelus Pricing | Free Course Revision & Planned Plus",
  description: "Study one course with up to 10 files for free. Kelus Plus is planned at $4.99 per month for larger, ongoing study workspaces.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Kelus Pricing | Free Course Revision & Planned Plus",
    description: "Study one course with up to 10 files for free. See what is included and whether Kelus Plus is available.",
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
        <h1>Start revising. Stay in control.</h1>
        <p className="legal-lede">
          One real course, with up to 10 files, is free. Kelus Plus is planned at $4.99/month for larger study workspaces.
          {syncReady
            ? " Free sign-in can sync your revision progress; source-file sync is still being tested."
            : " Your progress stays on this device."}
        </p>

        <div className="pricing-booklet-stack pricing-grid" role="list">
          <PricingPlanMotion delay={0.1}>
            <article className="pricing-offer is-free pricing-plan">
              <div className="pricing-offer-head">
                <div className="pricing-plan-name">
                  <h2 className="kicker pricing-plus-name"><KelusLogoMark /><span className="pricing-plus-word">kelus</span> <span className="pricing-plus-tier is-free">Free</span></h2>
                  <span className="pricing-availability">Available now</span>
                </div>
                <p className="pricing-price">$0<span>/month</span></p>
              </div>
              <p className="pricing-offer-lede">One active course and up to 10 course files—enough to study for one exam.</p>
              <ul>
                <li>One active course, with up to 10 PDFs, slides or notes</li>
                <li>Questions written from your own lines</li>
                <li>A plan that moves with your answers</li>
                <li>Export every question to Anki</li>
                <li>No account required</li>
                <li>{syncReady ? "Optional free sign-in to sync revision progress" : "Saved on this device"}</li>
              </ul>
              <Link className="cta" href="/today">
                Start revising <span aria-hidden="true">→</span>
              </Link>
            </article>
          </PricingPlanMotion>

          <PricingPlanMotion delay={0.18}>
            <article className={`pricing-offer is-pass pricing-plan is-founding${paymentReady ? "" : " is-upcoming"}`}>
              <div className="pricing-offer-head">
                <div className="pricing-plan-name">
                  {/* Both plans are named with the brand's own lockup, the K mark and the "kelus" wordmark as in the
                      header, and the plan beside it: Free in ink, Plus in Kelus green. */}
                  <h2 className="kicker pricing-plus-name"><KelusLogoMark /><span className="pricing-plus-word">kelus</span> <span className="pricing-plus-tier">Plus</span></h2>
                  <span className="pricing-availability">{paymentReady ? "Available now" : "Coming soon"}</span>
                </div>
                <p className="pricing-price">
                  $4.99<span>/month</span>
                </p>
              </div>
              <p className="pricing-offer-lede">Planned, not built yet. What we’re making for longer exam seasons:</p>
              <ul>
                <li>Everything in Free</li>
                <li>More than one active course and more than 10 source files</li>
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
            <div><dt>Is Free really free?</dt><dd>Yes. One active course and up to 10 source files, with no card, account, or trial that runs out.</dd></div>
            <div><dt>What changes when Plus opens?</dt><dd>Free stays the same. Plus will be the option for several active courses and larger source collections.</dd></div>
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
