"use client";

import Link, { type LinkProps } from "next/link";
import { useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";

type HeroActionLinkProps = Pick<LinkProps, "replace" | "scroll" | "shallow"> & {
  href: string;
  className?: string;
  children: ReactNode;
};

export function HeroActionLink({ children, href, className, replace, scroll, shallow }: HeroActionLinkProps) {
  const [navigating, setNavigating] = useState(false);

  function showPress(event: MouseEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setNavigating(true);
  }

  return (
    <Link
      href={href}
      className={`${className ?? ""}${navigating ? " is-navigating" : ""}`}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      onPointerDown={showPress}
      onPointerCancel={() => setNavigating(false)}
      onClick={showPress}
    >
      {children}
    </Link>
  );
}
