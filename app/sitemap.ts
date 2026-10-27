import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE_URL = "https://kelus.me";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/route/`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE_URL}/privacy/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/terms/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/waitlist/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/questions/`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE_URL}/pricing/`, changeFrequency: "monthly", priority: 0.6 },
    // The French homepage, and the page for Morocco's national bac exam: most visitors are there.
    { url: `${BASE_URL}/fr/`, changeFrequency: "monthly", priority: 0.9, alternates: { languages: { fr: `${BASE_URL}/fr/`, en: `${BASE_URL}/` } } },
    { url: `${BASE_URL}/fr/examen-national/`, changeFrequency: "monthly", priority: 0.8, alternates: { languages: { fr: `${BASE_URL}/fr/examen-national/`, en: `${BASE_URL}/` } } },
  ];
  return staticPages;
}
