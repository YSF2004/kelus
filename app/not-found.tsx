import Link from "next/link";
import { PackArt } from "@/components/PackArt";
import { SiteFooter } from "@/components/SiteFooter";

/** A missing page, in Kelus's voice: what happened, that nothing was lost, and the two ways back. */
export default function NotFound() {
  return (
    <main id="main" className="legal-page">
      <section className="legal-panel">
        {/* From the Kelus illustration pack. */}
        <PackArt name="lighthouse" size={200} className="not-found-art" />
        <h1>This page isn’t here.</h1>
        <p className="legal-lede">The link may be old or mistyped. Your notes and your study plan are still saved on this device.</p>
        <p className="legal-inline-links">
          <Link className="cta" href="/today">Back to your study plan <span aria-hidden="true">→</span></Link>
          {" "}
          <Link href="/">Kelus home</Link>
        </p>
      </section>
      <SiteFooter compact />
    </main>
  );
}
