"use client";

import Link, { type LinkProps } from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { useState, type PointerEvent, type ReactNode } from "react";

const MotionLink = motion.create(Link);

type HeroActionLinkProps = Pick<LinkProps, "replace" | "scroll" | "shallow"> & {
  href: string;
  className?: string;
  children: ReactNode;
};

export function HeroActionLink({ children, href, className, replace, scroll, shallow }: HeroActionLinkProps) {
  const reduceMotion = useReducedMotion();
  const [navigating, setNavigating] = useState(false);

  function showPress(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    setNavigating(true);
  }

  return (
    <MotionLink
      href={href}
      className={`${className ?? ""}${navigating && !reduceMotion ? " is-navigating" : ""}`}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      onPointerDown={showPress}
      onPointerUp={() => setNavigating(false)}
      onPointerCancel={() => setNavigating(false)}
      whileTap={reduceMotion ? undefined : { scale: 0.97, opacity: 0.9 }}
      transition={{ type: "spring", bounce: 0, duration: 0.22 }}
    >
      {children}
    </MotionLink>
  );
}
