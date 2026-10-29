import { RevisionReturn, StudyMoment } from "@/components/home/HomeVisualChapters";
import { RevisionLoopVisuals } from "@/components/home/RevisionLoopVisuals";
import { HomeFinal } from "@/components/home/HomeFinal";
import { HomeBand } from "@/components/home/HomeBand";

/** Keep the homepage focused on the revision story and a direct path into the product. */
export function HomeAfterHero() {
  return (
    <>
      <RevisionLoopVisuals />
      <HomeBand />
      <StudyMoment />
      <RevisionReturn />
      <HomeFinal />
    </>
  );
}
