import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { QuestionsForm } from "@/components/QuestionsForm";

export const metadata: Metadata = {
  title: "Ask a question — Kelus",
  description: "Send a question about Kelus, today’s route, materials, or Kelus Plus. We’ll reply by email.",
  alternates: { canonical: "/questions" },
};

export default function QuestionsPage() {
  return (
    <main id="main" className="legal-page questions-page">
      <section className="legal-panel">
        <p className="kicker">Questions</p>
        <h1>Ask us anything about Kelus.</h1>
        <p className="legal-lede">
          Stuck on your study plan, your notes or Kelus Plus? Ask here and a person replies by email. You can also write to{" "}
          <a href="mailto:hello@kelus.me">hello@kelus.me</a>.
        </p>
        <QuestionsForm source="questions_page" />
        <p className="legal-inline-links">
          <Link href="/today">Start revising</Link>
          {" · "}
          <Link href="/privacy">Privacy</Link>
        </p>
      </section>
      <SiteFooter compact />
    </main>
  );
}
