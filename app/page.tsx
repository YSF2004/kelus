import type { Metadata } from "next";
import { KelusHero } from "@/components/hero/KelusHero";
import { HomeAfterHero } from "@/components/home/HomeAfterHero";
import { LateralPage } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Kelus",
  description: "Turn your course notes or PDFs into exam revision. Practise recall, check your answers, and see which topic to review next with Kelus.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Revise from Your Course Notes for Exams | Kelus",
    description: "Practise recall from your own notes. Check your answers and see which topic to review next.",
    url: "/",
    type: "website",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns course notes into recall practice and a route for what to review next." }],
  },
};

export default function Home() {
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebSite", name: "Kelus", url: "https://kelus.me/" },
      {
        "@type": "WebApplication",
        name: "Kelus",
        url: "https://kelus.me/",
        description: "A revision and exam practice tool that uses course material and answer evidence to suggest what to study next.",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD", url: "https://kelus.me/pricing/" },
      },
    ],
  };

  return (
    <LateralPage>
      <div className="home is-leitner-home" data-marketing="editorial">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <main id="main">
          <KelusHero />
          <HomeAfterHero />
        </main>
        <SiteFooter />
      </div>
    </LateralPage>
  );
}
