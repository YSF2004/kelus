import type { Metadata } from "next";
import { ChallengeViewer } from "@/components/ChallengeViewer";

export const metadata: Metadata = {
  title: "Shared study challenge · Kelus",
  robots: { index: false, follow: false },
};

export default function ChallengePage() {
  return <ChallengeViewer />;
}
