import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { WaitlistForm } from "@/components/WaitlistForm";

export const metadata: Metadata = {
  title: "Waitlist — Kelus",
  description: "Join the Kelus waitlist for early access updates on the local-first revision and exam practice tool.",
  alternates: { canonical: "/waitlist" },
};

export default function WaitlistPage() {
  return (
    <main id="main" className="legal-page waitlist-page">
      <section className="legal-panel">
        <h1>Hear when Kelus Plus opens.</h1>
        <p className="legal-lede">
          Kelus works today, free, on this device. Leave your email if you want one note when Kelus Plus opens.
        </p>
        <WaitlistForm source="waitlist_page" />
        <p className="legal-inline-links">
          Prefer to try now? <Link href="/today">Start revising</Link>
          {" · "}
          <Link href="/privacy">Privacy</Link>
        </p>
      </section>
      <SiteFooter compact />
    </main>
  );
}
