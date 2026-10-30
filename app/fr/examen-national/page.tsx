import type { Metadata } from "next";
import Link from "next/link";
import { LateralPage } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import styles from "./page.module.css";

const TITLE = "Réviser l’examen national avec vos propres cours | Kelus";
const DESCRIPTION = "Préparez l’examen national du bac au Maroc à partir de vos cours ou d’un PDF : des questions qui citent vos lignes, la correction depuis vos notes, et ce que vous ratez revient en premier. Gratuit, sans compte.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/fr/examen-national/" },
  openGraph: {
    title: TITLE,
    description: "Vos cours deviennent des questions, corrigées à partir de vos propres notes.",
    url: "/fr/examen-national/",
    siteName: "Kelus",
    locale: "fr_MA",
    images: [{ url: "/og/kelus-social.png", width: 1200, height: 630, alt: "Des notes de cours deviennent des questions de révision dans Kelus." }],
  },
};

/** Answers a student asks before starting, each true of Kelus today. Also given to search engines as an FAQ. */
const FAQ: Array<{ q: string; a: string }> = [
  { q: "Est-ce gratuit ?", a: "Oui. Vous pouvez réviser votre propre cours gratuitement, sans créer de compte et sans essai qui expire." },
  { q: "Mes cours restent-ils privés ?", a: "Sans compte, vos fichiers et votre progression sont enregistrés sur cet appareil. Si la rédaction hébergée des questions est disponible, le texte du thème étudié peut être envoyé au modèle. Vous pouvez la désactiver dans les options du cours." },
  { q: "Pour quelles matières ?", a: "Pour tout cours écrit : SVT, physique-chimie, histoire-géographie, philosophie, économie… Kelus pose ses questions à partir de vos propres lignes, pas d’une banque de questions." },
  { q: "En quelle langue ?", a: "Kelus peut lire des cours en français ou en anglais. L’interface est principalement en anglais ; les cours en arabe ne sont pas encore pris en charge." },
  { q: "Est-ce que Kelus connaît les sujets de l’examen national ?", a: "Non. Kelus ne contient pas les annales officielles : il vous fait réviser ce qui est dans vos cours, et vous montre ce qu’il faut revoir avant l’examen." },
];

const STEPS: Array<{ title: string; body: string }> = [
  { title: "Ajoutez votre cours", body: "Un PDF, une fiche, ou du texte collé. Kelus trouve les chapitres et vous les montre avant de commencer." },
  { title: "Répondez de mémoire", body: "Quelques questions rapides tirées de vos lignes, puis une explication avec vos propres mots, sans regarder le cours." },
  { title: "Voyez ce qui manque", body: "Kelus compare votre réponse à la ligne exacte de vos notes, montre ce qui manque, et la ligne ratée revient en premier à la prochaine révision." },
];

export default function ExamenNationalPage() {
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
            <p className={styles.kicker}>Bac au Maroc, examen national</p>
            <h1>Révisez l’examen national à partir de vos propres cours.</h1>
            <p className={styles.lead}>
              Ajoutez votre cours ou un PDF. Kelus en tire des questions qui citent vos lignes, corrige vos réponses à partir de vos
              notes, et fait revenir en premier ce que vous avez raté.
            </p>
            <div className={styles.actions}>
              <Link className="k-btn" href="/today/">Commencer avec mes cours</Link>
            </div>
            <p className={styles.note}>Gratuit, sans compte. Vos fichiers sont enregistrés sur cet appareil ; la rédaction hébergée des questions peut traiter le texte du thème étudié. <Link href="/privacy#ai-questions">En savoir plus</Link>.</p>
          </header>

          <section className={styles.section} aria-labelledby="fr-steps">
            <h2 id="fr-steps">Comment ça marche</h2>
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

          <section className={styles.section} aria-labelledby="fr-why">
            <h2 id="fr-why">Pourquoi réviser comme ça</h2>
            <p>
              Relire une fiche donne l’impression de savoir. Se forcer à retrouver l’idée, puis la comparer au cours, montre ce que vous
              savez vraiment. Kelus crée des questions à partir des passages lisibles et garde la trace de ce qui revient : ce que vous
              ratez aujourd’hui ouvre la révision de demain.
            </p>
          </section>

          <section className={styles.section} aria-labelledby="fr-faq">
            <h2 id="fr-faq">Questions fréquentes</h2>
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
            <h2>Commencez avec le chapitre de demain.</h2>
            <Link className="k-btn" href="/today/">Ajouter mon cours</Link>
          </section>
        </main>
        <SiteFooter />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      </div>
    </LateralPage>
  );
}
