import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your revision sheet — Kelus",
  robots: { index: false, follow: false },
};

export default function SheetLayout({ children }: { children: React.ReactNode }) {
  return children;
}
