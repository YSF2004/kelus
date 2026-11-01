"use client";

import Link, { type LinkProps } from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";

const MotionLink = motion.create(Link);

type HeroActionLinkProps = Pick<LinkProps, "replace" | "scroll" | "shallow"> & {
  href: string;
  className?: string;
  children: ReactNode;
};

export function HeroActionLink({ children, href, className, replace, scroll, shallow }: HeroActionLinkProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [navigating, setNavigating] = useState(false);

  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setNavigating(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (replace) router.replace(href, { scroll: scroll !== false });
        else router.push(href, { scroll: scroll !== false });
      });
    });
  }

  return (
    <MotionLink
      href={href}
      className={`${className ?? ""}${navigating && !reduceMotion ? " is-navigating" : ""}`}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      onClick={navigate}
      whileTap={reduceMotion ? undefined : { scale: 0.97, opacity: 0.9 }}
      transition={{ type: "spring", bounce: 0, duration: 0.22 }}
    >
      {children}
    </MotionLink>
  );
}
