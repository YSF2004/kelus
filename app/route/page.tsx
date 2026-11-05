import type { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";
import { LateralPage } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Kelus",
  description: "Add a lecture PDF, syllabus, or notes. Kelus helps you recall the material, check your answers, and decide which topic to practice next.",
  alternates: { canonical: "/route" },
  openGraph: {
    title: "How to Revise from Your Notes | Kelus",
    description: "From your own course notes to recall practice and a route that responds to your answers.",
    url: "/route/",
    siteName: "Kelus",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Course notes become recall practice and a revision route in Kelus." }],
  },
};

export default function RoutePage() {
  return (
    <LateralPage>
    <div className="home route-page" data-marketing="editorial">
      <main id="main">
        <HowItWorks />
      </main>
      <SiteFooter />
    </div>
  </LateralPage>
  );
}
