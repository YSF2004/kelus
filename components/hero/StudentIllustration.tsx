"use client";

import { motion, useReducedMotion } from "motion/react";

type Props = {
  className?: string;
};

export function StudentIllustration({ className }: Props) {
  const reduce = useReducedMotion() === true;

  return (
    <figure className={className} aria-hidden="true">
      <motion.img
        src="/hero/student.png"
        alt=""
        width={610}
        height={538}
        initial={reduce ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? { duration: 0.01 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      />
    </figure>
  );
}
