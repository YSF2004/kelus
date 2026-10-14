import { RevisionReturn, StudyMoment } from "@/components/home/HomeVisualChapters";
import { RevisionLoopVisuals } from "@/components/home/RevisionLoopVisuals";
import { HomeFinal } from "@/components/home/HomeFinal";

/** Keep the homepage focused on the revision story and a direct path into the product. */
export function HomeAfterHero() {
  return (
    <>
      <RevisionLoopVisuals />
      <StudyMoment />
      <RevisionReturn />
      <HomeFinal />
    </>
  );
}
