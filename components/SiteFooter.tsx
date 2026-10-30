import Link from "next/link";
import { KelusLogoMark } from "@/components/KelusLogoMark";
import { SEARCH_PAGES } from "@/lib/search-pages";

const links = [
  { href: "/route", label: "How it works" },
  { href: "/pricing", label: "Pricing" },
  { href: "/questions", label: "Questions" },
  { href: "/waitlist", label: "Waitlist" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

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
        </nav>
      </div>
      {/* The search pages, linked from every page that has the full footer, so each one is a click from anywhere. */}
      {compact ? null : (
        <nav className="site-footer-tools" aria-label="Study your notes">
          {SEARCH_PAGES.map((page) => <Link key={page.href} href={page.href}>{page.label}</Link>)}
        </nav>
      )}
      <p className="site-footer-note">© {new Date().getFullYear()} Kelus</p>
    </footer>
  );
}
