import type { CSSProperties } from "react";

/** Inline custom properties for `.k-rise`: when it starts, how far it travels, and its starting scale. */
export function rise(delay: number, options: { y?: number; scale?: number; duration?: number } = {}): CSSProperties {
  return {
    "--rise-delay": `${delay}s`,
    ...(options.y === undefined ? {} : { "--rise-y": `${options.y}px` }),
    ...(options.scale === undefined ? {} : { "--rise-scale": String(options.scale) }),
    ...(options.duration === undefined ? {} : { "--rise-duration": `${options.duration}s` }),
  } as CSSProperties;
}
