import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kelus",
  robots: { index: false, follow: false },
};

export default function ConceptLayout({ children }: { children: React.ReactNode }) {
  return children;
}
