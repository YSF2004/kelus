import { CommandPalette } from "@/components/CommandPalette";
import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Fraunces, Inter, IBM_Plex_Sans, Literata } from "next/font/google";
import "./globals.css";
import "./revision-studio.css";
import "./home-folio.css";
import "./booklet-product.css";
import "./booklet-paper.css";
import "./paper-loop.css";
import "./hero-poster.css";
import "./exam-booklet.css";
import "./workbench.css";
import "./marketing-typography.css";
import "./view-transitions.css";
import "./course-studio.css";
import "./course-studio-light.css";
import "./material-first.css";
import "./study-session.css";
import "./monthly-pricing.css";
import "./core-workspace.css";
import "./today-page.css";
import "./topic-cards.css";
import "./material-cards.css";
import "./first-run.css";
import "./a11y.css";
import "./kelus-buttons.css";
import "./quiet.css";
import { LearnerProvider } from "@/components/LearnerProvider";
import { RouteTransition } from "@/components/RouteTransition";
import { SiteHeader } from "@/components/SiteHeader";
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GoogleAnalytics } from "@/components/GoogleAnalytics";
import { NudgeKeeper } from "@/components/NudgeKeeper";
import { AppRuntime } from "@/components/AppRuntime";
import { UpdateWatcher } from "@/components/UpdateWatcher";

/* Marked-script system: Literata (reading / display) + IBM Plex Sans (UI).
   Keep --font-inter / --font-source-serif variable names for existing CSS. */
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const literata = Literata({
  subsets: ["latin"],
  variable: "--font-source-serif",
  axes: ["opsz"],
  display: "swap",
});

// Opt-in marketing families. No global replacement or app-route preload.
const marketingSerif = Fraunces({ subsets: ["latin"], axes: ["opsz"], variable: "--font-fraunces", display: "swap", preload: false });
// Inter is the product's one typeface (titles, text, buttons), so it loads up front; the homepage opts in as before.
const marketingSans = Inter({ subsets: ["latin"], variable: "--font-marketing-inter", display: "swap", axes: ["opsz"] });

// The status bar takes the page's paper colour, so an installed Kelus has no browser-coloured strip on top; the
// layout reaches into the notch area and pads itself with the safe-area insets instead.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf7",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://kelus.me"),
  // Installing Kelus as an app is what lets nudges arrive while it is closed (Chrome).
  manifest: "/manifest.webmanifest",
  // Added to an iPhone home screen, Kelus opens full screen like an app, under its own name.
  appleWebApp: { capable: true, title: "Kelus", statusBarStyle: "default" },
  title: "Revise from Your Course Notes for Exams | Kelus",
  description: "Turn your course notes or PDFs into exam revision. Practise recall, check your answers, and see which topic to review next with Kelus.",
  openGraph: {
    type: "website",
    url: "https://kelus.me/",
    siteName: "Kelus",
    title: "Revise from Your Course Notes for Exams | Kelus",
    description: "Practise recall from your own notes. Check your answers and see which topic to review next.",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Kelus turns course notes into recall practice and a route for what to review next." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Revise from Your Course Notes for Exams | Kelus",
    description: "Practise recall from your own notes. Check your answers and see what to review next.",
    images: ["/og/kelus-social.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plex.variable} ${literata.variable} ${marketingSerif.variable} ${marketingSans.variable}`} data-scroll-behavior="smooth">
      <body className={`${plex.variable} ${literata.variable} is-booklet-system`}>
        <GoogleAnalytics />
        <a className="skip" href="#main">Skip to content</a>
        <AuthProvider>
          <LearnerProvider>
            <TooltipProvider>
              <Suspense fallback={null}>
                <SiteHeader />
              </Suspense>
              <RouteTransition>{children}</RouteTransition>
              <Toaster />
              <NudgeKeeper />
              <AppRuntime />
              <UpdateWatcher />
              <Suspense fallback={null}>
                <CommandPalette />
              </Suspense>
            </TooltipProvider>
          </LearnerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
