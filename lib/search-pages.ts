/**
 * The search pages, in one place: the footer lists them and every search page links to the others, so a crawler
 * that lands on one finds them all. A new search page is added here and in app/sitemap.ts.
 */
export const SEARCH_PAGES = [
  { href: "/pdf-to-flashcards/", label: "PDF to flashcards", blurb: "Flashcards written from the sentences in your lecture PDF." },
  { href: "/pdf-to-anki/", label: "PDF to Anki", blurb: "An Anki deck from your own pages, each card with its line." },
  { href: "/lecture-slides-to-flashcards/", label: "Lecture slides to flashcards", blurb: "Your slide deck, saved as PDF, turned into questions." },
  { href: "/pdf-to-practice-questions/", label: "PDF to practice questions", blurb: "Practice questions that quote the page they came from." },
  { href: "/quiz-me-on-my-notes/", label: "Quiz me on my notes", blurb: "Paste your notes and get quizzed on your own lines." },
  { href: "/quizlet-alternative/", label: "A free Quizlet alternative", blurb: "Questions from your notes instead of borrowed sets." },
] as const;
