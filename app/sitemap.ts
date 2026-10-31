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
    { url: `${BASE_URL}/pdf-to-flashcards/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/pdf-to-anki/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/lecture-slides-to-flashcards/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/pdf-to-practice-questions/`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE_URL}/quizlet-alternative/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/quiz-me-on-my-notes/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/notes-to-flashcards/`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE_URL}/anki-alternative/`, changeFrequency: "monthly", priority: 0.8 },
  ];
  return staticPages;
}
