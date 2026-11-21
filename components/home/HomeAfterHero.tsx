import { RevisionReturn, StudyMoment } from "@/components/home/HomeVisualChapters";
import { HomeFinal } from "@/components/home/HomeFinal";
import { ProductStory } from "@/components/home/ProductStory";

/** Keep the homepage focused on the revision story and a direct path into the product. */
export function HomeAfterHero() {
  return (
    <>
      <ProductStory />
      <StudyMoment />
      <RevisionReturn />
      <HomeFinal />
    </>
  );
}
