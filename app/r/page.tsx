import type { Metadata } from "next";
import { Suspense } from "react";
import { SharedResult } from "./SharedResult";

export const metadata: Metadata = {
  title: "A study result from Kelus",
  description: "Lines recalled from their own notes, with Kelus. Turn your notes into practice questions.",
  // Each link carries its own numbers: thin pages that search should not index.
  robots: { index: false, follow: true },
};

export default function SharedResultPage() {
  return (
    <Suspense fallback={null}>
      <SharedResult />
    </Suspense>
  );
}
