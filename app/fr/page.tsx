import type { Metadata } from "next";
import Link from "next/link";
import { LateralPage } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import styles from "./examen-national/page.module.css";

const TITLE = "Fiches de révision et flashcards à partir de vos cours | Kelus";
const DESCRIPTION = "Ajoutez votre cours ou un PDF : Kelus en tire des questions qui citent vos lignes, corrige vos réponses depuis vos notes, et vous laisse une fiche de révision écrite avec vos mots. Gratuit, sans compte.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/fr/", languages: { fr: "/fr/", en: "/", "x-default": "/" } },
  openGraph: {
    title: TITLE,
    description: "Vos cours deviennent des questions, une fiche de révision et des flashcards.",
    url: "/fr/",
    siteName: "Kelus",
    locale: "fr_FR",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Des notes de cours deviennent des questions de révision dans Kelus." }],
  },
};

/** Each answer is true of Kelus today; given to search engines as an FAQ as well. */
const FAQ: Array<{ q: string; a: string }> = [
  { q: "Kelus fait-il des fiches de révision ?", a: "Oui, mais c’est vous qui l’écrivez : chaque fois que vous expliquez un chapitre avec vos mots, Kelus le range dans votre fiche, à côté de la ligne du cours avec laquelle il a été comparé, avec ce qui manquait en marge. Elle s’imprime ou s’enregistre en PDF pour la veille de l’examen." },
  { q: "Et les flashcards ?", a: "Kelus vous interroge sur chaque ligne de votre cours et fait revenir en premier celles que vous ratez. Si vous préférez Anki, vous pouvez exporter vos questions dans un fichier qu’Anki importe." },
  { q: "Est-ce gratuit ?", a: "Oui. Vous pouvez réviser votre propre cours gratuitement, sans créer de compte et sans essai qui expire." },
  { q: "Mes cours restent-ils privés ?", a: "Sans compte, vos PDF et votre progression restent sur cet appareil. Ils ne quittent l’appareil que si vous vous connectez pour synchroniser." },
  { q: "En quelle langue ?", a: "Kelus lit les cours écrits en français ou en anglais, et ses boutons suivent la langue de vos notes. Les cours en arabe ne sont pas encore pris en charge." },
];

const STEPS: Array<{ title: string; body: string }> = [
  { title: "Ajoutez votre cours", body: "Un PDF, une fiche, ou du texte collé. Kelus trouve les chapitres et vous les montre avant de commencer." },
  { title: "Répondez de mémoire", body: "Quelques questions rapides tirées de vos lignes, puis une explication avec vos propres mots, sans regarder le cours." },
  { title: "Gardez ce qui compte", body: "Ce que vous ratez revient en premier à la prochaine révision, et vos explications forment votre fiche de révision." },
];

export default function FrenchHomePage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "fr",
    mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })),
  };
  return (
    <LateralPage>
      <div className={`home ${styles.page}`} data-marketing="editorial" lang="fr">
        <main id="main" className={styles.main}>
          <header className={styles.hero}>
            <p className={styles.kicker}>Fiches de révision et flashcards</p>
            <h1>Transformez vos cours en questions, et gardez la fiche que vous avez écrite.</h1>
            <p className={styles.lead}>
              Ajoutez votre cours ou un PDF. Kelus en tire des questions qui citent vos lignes, corrige vos réponses à partir de vos
              notes, et fait revenir en premier ce que vous avez raté.
            </p>
            <div className={styles.actions}>
              <Link className="k-btn" href="/today/">Commencer avec mes cours</Link>
              <Link className={styles.secondary} href="/today/?sample=1">Essayer avec un cours d’exemple</Link>
            </div>
            <p className={styles.note}>Gratuit, sans compte. Vos cours restent sur votre appareil.</p>
          </header>

          <section className={styles.section} aria-labelledby="fr-home-steps">
            <h2 id="fr-home-steps">Comment ça marche</h2>
            <ol className={styles.steps}>
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className={styles.num} aria-hidden="true">{index + 1}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className={styles.section} aria-labelledby="fr-home-exam">
            <h2 id="fr-home-exam">Vous préparez le bac au Maroc ?</h2>
            <p>
              Kelus vous fait réviser l’examen national à partir de vos propres cours de SVT, de physique-chimie, d’histoire-géographie
              ou de philosophie. <Link className={styles.secondary} href="/fr/examen-national/">Voir comment réviser l’examen national</Link>
            </p>
          </section>

          <section className={styles.section} aria-labelledby="fr-home-faq">
            <h2 id="fr-home-faq">Questions fréquentes</h2>
            <dl className={styles.faq}>
              {FAQ.map((item) => (
                <div key={item.q}>
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={`${styles.section} ${styles.closing}`}>
            <h2>Commencez avec votre prochain chapitre.</h2>
            <Link className="k-btn" href="/today/">Ajouter mon cours</Link>
          </section>
        </main>
        <SiteFooter />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </div>
    </LateralPage>
  );
}
