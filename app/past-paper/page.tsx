import { Suspense } from "react";
import { PastPaperPractice } from "@/components/PastPaperPractice";

export default function PastPaperPage() {
  return <Suspense fallback={<main id="main"><p>Opening past paper practice…</p></main>}><PastPaperPractice /></Suspense>;
}
