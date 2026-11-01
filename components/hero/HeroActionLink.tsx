"use client";

import Link, { type LinkProps } from "next/link";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

const MotionLink = motion(Link);

type HeroActionLinkProps = Pick<LinkProps, "href" | "replace" | "scroll" | "shallow"> & {
  className?: string;
  children: ReactNode;
};

export function HeroActionLink({ children, href, className, replace, scroll, shallow }: HeroActionLinkProps) {
  const reduceMotion = useReducedMotion();

  return (
    <MotionLink
      href={href}
      className={className}
      replace={replace}
      scroll={scroll}
      shallow={shallow}
      whileTap={reduceMotion ? undefined : { scale: 0.97, opacity: 0.9 }}
      transition={{ type: "spring", bounce: 0, duration: 0.22 }}
    >
      {children}
    </MotionLink>
  );
}
