"use client";

import { WaitlistForm } from "@/components/WaitlistForm";
import { authConfigured } from "@/lib/auth-config";
import { foundingPaymentConfigured, foundingPaymentLink } from "@/lib/founding";
import { trackEvent } from "@/lib/analytics";
import { waitlistEndpointConfigured } from "@/lib/waitlist";

/** `form: false` leaves the waitlist form out, for a page that shows it on its own below the plans. */
export function FoundingCta({ source = "pricing", form = true }: { source?: string; form?: boolean }) {
  const paymentReady = foundingPaymentConfigured();
  const paymentLink = foundingPaymentLink();
  const syncReady = authConfigured();
  const waitlistReady = waitlistEndpointConfigured();

  if (paymentReady) {
    return (
      <div className="founding-cta">
        <a
          className="cta"
          href={paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent({ name: "subscription_checkout_clicked", source })}
        >
          Get Kelus Plus · $4.99/month <span aria-hidden="true">→</span>
        </a>
        <p className="founding-cta-note">
          Monthly subscription. Free includes one active course and up to 10 source files.
          {syncReady ? " Free sign-in can sync revision progress; source-file sync is still being tested." : " Study stays on this device until account sync is enabled."}
        </p>
      </div>
    );
  }

  return (
    <div className="founding-cta is-reserve">
      <p className="founding-cta-status">Checkout isn’t live yet</p>
      <p className="founding-cta-note">
        {!form
          ? (
            <>
              No date yet: it opens once sync is built and tested.{" "}
              {/* The way down to the waitlist: it glides there, the form brightens for a moment and the email field is ready. */}
              <a href="#pricing-notify-title" className="founding-cta-jump" onClick={() => window.setTimeout(() => document.querySelector<HTMLInputElement>(".pricing-notify input")?.focus({ preventScroll: true }), 450)}>
                Leave your email below
              </a>{" "}
              for one note when it does.
            </>
          )
          : waitlistReady
            ? "Join the list for one launch update. Free includes one active course and up to 10 source files."
            : "Ask us when Plus opens. Free includes one active course and up to 10 source files."}
      </p>
      {!form ? null : waitlistReady ? <WaitlistForm source={source} compact /> : (
        <a className="text-btn" href="mailto:hello@kelus.me?subject=Kelus%20Plus%20subscription">
          Ask about Kelus Plus <span aria-hidden="true">→</span>
        </a>
      )}
    </div>
  );
}
