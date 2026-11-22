import Link from "next/link";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import { Octicon } from "@/components/Octicon";
import { SEARCH_PAGES } from "@/lib/search-pages";

const links = [
  { href: "/route", label: "How it works" },
  { href: "/pdf-to-practice-questions", label: "PDF to practice questions" },
  { href: "/questions", label: "Questions" },
  { href: "/waitlist", label: "Waitlist" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

const GITHUB_URL = "https://github.com/YSF2004/kelus";

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? "site-footer is-compact" : "site-footer"}>
      <div className="site-footer-inner">
        <Link href="/" className="mark site-footer-mark">
          <KelusLogoMark />
          <span className="site-wordmark">kelus</span>
        </Link>
        <nav className="site-footer-nav" aria-label="Footer">
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <a href={GITHUB_URL} target="_blank" rel="noreferrer"><Octicon name="github" size={16} /> Open source <span aria-hidden="true">↗</span></a>
        </nav>
      </div>
      {/* The search pages, linked from every page that has the full footer, so each one is a click from anywhere. */}
      {compact ? null : (
        <nav className="site-footer-tools" aria-label="Study your notes">
          {SEARCH_PAGES.map((page) => <Link key={page.href} href={page.href}>{page.label}</Link>)}
        </nav>
      )}
      <p className="site-footer-note">© {new Date().getFullYear()} Kelus · <a href={GITHUB_URL} target="_blank" rel="noreferrer">AGPL-3.0 open source</a></p>
    </footer>
  );
}
