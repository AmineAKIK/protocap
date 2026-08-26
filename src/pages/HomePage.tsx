import { ArrowRight, Calculator, ClipboardCheck, FileText, Library, ListChecks, Maximize2, RadioTower, Wifi } from 'lucide-react';
import { useState } from 'react';
import { ButtonLink } from '../components/Button';
import { PresentationMode } from '../components/PresentationMode';

const modules = [
  {
    title: 'ShiftGuide',
    description: "Céline, l'assistante IA opérationnelle : elle guide le conducteur au fil de la situation déclarée — prise de poste, changement d'OC, cuve, fin de poste.",
    to: '/shiftguide',
    icon: ListChecks,
    tag: 'IA · Guidage terrain',
    highlight: "Céline guide, l'opérateur décide",
    aiDisclosure: "Céline combine des règles déterministes et, selon la demande, un service IA distant. L’historique est conservé localement dans ce navigateur : ne pas saisir de donnée sensible."
  },
  {
    title: 'Expiry Check',
    description: 'Suivi de la validité du bloc de remplissage par ligne, board tournée laveur et traçabilité locale des recharges de cuves.',
    to: '/expiry-check',
    icon: ClipboardCheck,
    tag: 'Traçabilité · Démonstrateur',
    highlight: 'Démarrage sécurisé, échéances visibles'
  },
  {
    title: 'Logistics Call',
    description: "Création d'appel horodaté, priorisation et cycle de statuts dans un board de démonstration persisté localement dans le navigateur.",
    to: '/logistics-call',
    icon: RadioTower,
    tag: 'Flux logistique · Démonstrateur',
    highlight: 'Workflow visible, sans fausse synchronisation'
  },
  {
    title: 'Knowledge Base',
    description: 'Accès rapide aux modes opératoires, check-lists et fiches réaction des lignes de conditionnement.',
    to: '/knowledge-base',
    icon: Library,
    tag: 'Documentation · Standards',
    highlight: 'Information utile accessible rapidement'
  },
  {
    title: 'Packing Calculator',
    description: "Conversion d'une quantité demandée en palettes, cartons et unités selon la référence.",
    to: '/packing-calculator',
    icon: Calculator,
    tag: 'Calcul conditionnement',
    highlight: 'Calcul rapide, écart visible'
  }
];

export function HomePage() {
  const [presenting, setPresenting] = useState(false);

  return (
    <div>
      {presenting && <PresentationMode onClose={() => setPresenting(false)} />}
      <section className="industrial-grid border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">
            <div className="min-w-0 flex-1">
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                Proto<span className="text-teal-700">Cap</span>
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
                Démonstrateur interactif d’ingénierie des opérations industrielles, conçu pour rendre visibles des flux, décisions et contraintes terrain.
              </p>
              <div className="mt-6 rounded-r-xl border-l-4 border-teal-600 bg-teal-50 px-4 py-4 sm:px-5">
                <p className="text-sm leading-6 text-slate-700">
                  Trois jours en tant que conducteur de ligne de conditionnement dans une usine de produits de soins ont orienté les prototypes présentés ici et le rapport qui les accompagne. Les frictions observées en production sont réelles — les données affichées, elles, sont entièrement fictives. Aucun élément confidentiel propre à l’entreprise n’y figure.
                </p>
              </div>
            </div>

            <div className="w-full shrink-0 lg:w-72 xl:w-80">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Périmètre</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">1</span>
                    Cinq outils complémentaires, chacun centré sur un flux ou une décision terrain.
                  </li>
                  <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">2</span>
                    Données publiques fictives ; configuration ShiftGuide protégée côté serveur.
                  </li>
                  <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">3</span>
                    Les prototypes locaux ne simulent pas une synchronisation multi-utilisateur inexistante.
                  </li>
                </ul>
                <div className="border-t border-slate-100 px-5 py-3">
                  <button
                    type="button"
                    onClick={() => setPresenting(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500 active:scale-95 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20"
                  >
                    <Maximize2 size={15} aria-hidden="true" />
                    Lancer la présentation
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-center text-xs text-slate-400">
                  <Wifi size={13} className="shrink-0" aria-hidden="true" />
                  PWA — assets statiques mis en cache ; fonctions serveur en ligne uniquement
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <p className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">Rapport</p>
        <article className="panel group mb-10 grid gap-5 p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <FileText size={22} aria-hidden="true" />
            </div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Synthèse opérationnelle</p>
            <h3 className="text-xl font-bold text-slate-950 transition group-hover:text-teal-700">Du terrain au prototype</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Une lecture terrain de la charge invisible autour du conducteur : informations dispersées, décisions à reconstruire et flux critiques à rendre plus lisibles.
            </p>
            <div className="mt-4 inline-flex max-w-full rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
              Observation terrain, hypothèses, impacts et indicateurs d’évaluation proposés
            </div>
          </div>
          <ButtonLink to="/rapport" className="w-full lg:self-end" icon={<ArrowRight size={16} />}>
            Ouvrir le rapport
          </ButtonLink>
        </article>

        <p className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">Modules</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((module) => (
            <article
              key={module.title}
              className="panel group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <module.icon size={22} aria-hidden="true" />
              </div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">{module.tag}</p>
              <h3 className="text-xl font-bold text-slate-950 transition group-hover:text-teal-700">{module.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{module.description}</p>
              <div className="mt-4 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                {module.highlight}
              </div>
              {'aiDisclosure' in module && module.aiDisclosure && (
                <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-5 text-slate-500">
                  {module.aiDisclosure}
                </p>
              )}
              <ButtonLink to={module.to} className="mt-4 w-full" icon={<ArrowRight size={16} />}>
                Ouvrir le module
              </ButtonLink>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Données publiques de démonstration fictives.</p>
          <a
            className="font-semibold text-teal-700 transition hover:text-teal-900 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/20"
            href="https://www.akiksystems.com"
            target="_blank"
            rel="noreferrer"
          >
            www.akiksystems.com
          </a>
        </div>
      </footer>
    </div>
  );
}
