"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SEARCH_PAGES } from "@/lib/search-pages";
import styles from "./SearchLanding.module.css";

/** The other search pages, so a student (and a crawler) who lands on one can find the rest. */
export function RelatedSearchPages() {
  const here = usePathname()?.replace(/\/?$/, "/");
  const others = SEARCH_PAGES.filter((page) => page.href !== here);
  return (
    <section className={styles.related} aria-labelledby="search-related">
      <h2 id="search-related">More ways to study your notes</h2>
      <ul>
        {others.map((page) => (
          <li key={page.href}>
            <Link href={page.href}><b>{page.label}</b><span>{page.blurb}</span></Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
