import { ArrowRight, Calculator, ClipboardCheck, FileText, Library, ListChecks, Maximize2, RadioTower, Wifi } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { PresentationMode } from '../components/PresentationMode';

const modules = [
  {
    title: 'ShiftGuide',
    description: "Céline, l'assistante IA opérationnelle : elle guide le conducteur en temps réel selon sa situation — prise de poste, changement d'OC, cuve, fin de poste.",
    to: '/shiftguide',
    icon: ListChecks,
    tag: 'IA · Guidage terrain',
    highlight: "Céline guide, l'opérateur décide"
  },
  {
    title: 'Expiry Check',
    description: 'Suivi de la validité du bloc de remplissage par ligne, board tournée laveur et traçabilité des recharges de cuves.',
    to: '/expiry-check',
    icon: ClipboardCheck,
    tag: 'Traçabilité · Qualité',
    highlight: 'Démarrage sécurisé, échéances visibles'
  },
  {
    title: 'Logistics Call',
    description: "Création d'appel horodaté depuis la ligne, priorisation et board logistique synchronisé en temps réel.",
    to: '/logistics-call',
    icon: RadioTower,
    tag: 'Flux logistique · Temps réel',
    highlight: 'Demandes visibles, suivies, priorisées'
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
      {/* Hero */}
      <section className="industrial-grid border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-16 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-16">

            {/* Left */}
            <div className="flex-1 min-w-0">
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
                LineOps<br />
                <span className="text-teal-700">Toolkit</span>
              </h1>
              <p className="mt-4 text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
                Quatre modules terrain pour ligne de conditionnement.
              </p>

              {/* Message */}
              <div className="mt-6 rounded-r-xl border-l-4 border-teal-600 bg-teal-50 px-4 py-4 sm:px-5">
                <p className="text-sm leading-6 text-slate-700">
                  Trois jours en tant que conducteur de ligne de conditionnement dans une usine de produits de soins ont orienté ces quatre maquettes et le rapport qui les accompagne. Les frictions observées en production sont réelles — les données affichées, elles, sont entièrement fictives. Aucun élément propre à l’entreprise n’y figure.
                </p>
              </div>
            </div>

            {/* Right — Périmètre card */}
            <div className="w-full lg:w-72 xl:w-80 shrink-0">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Périmètre</p>
                </div>
                <ul className="divide-y divide-slate-100">
                  <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">1</span>
                    Quatre modules indépendants, chacun centré sur un flux terrain précis.
                  </li>
                  <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">2</span>
                    Aucune donnée réelle ou confidentielle.
                  </li>
                  <li className="flex items-start gap-3 px-5 py-3.5 text-sm text-slate-700">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">3</span>
                    Les interactions sont conservées localement dans le navigateur.
                  </li>
                </ul>
                <div className="border-t border-slate-100 px-5 py-3">
                  <button
                    onClick={() => setPresenting(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-teal-500 active:scale-95"
                  >
                    <Maximize2 size={15} />
                    Lancer la présentation
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs text-slate-400">
                  <Wifi size={13} />
                  PWA — fonctionne aussi hors-ligne une fois chargée
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Module cards */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <p className="mb-6 text-xs font-bold uppercase tracking-widest text-slate-400">Rapport</p>
        <article className="panel group mb-10 grid gap-5 p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-center">
          <div className="min-w-0">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <FileText size={22} />
            </div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Synthèse opérationnelle</p>
            <h3 className="text-xl font-bold text-slate-950 transition group-hover:text-teal-700">Du terrain au prototype</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Une lecture terrain de la charge invisible autour du conducteur : informations dispersées, décisions à reconstruire et flux critiques à rendre plus lisibles.
            </p>
            <div className="mt-4 inline-flex max-w-full rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
              Observation terrain, hypothèses, impacts et indicateurs possibles
            </div>
          </div>
          <Link to="/rapport" className="block lg:self-end">
            <Button className="w-full" icon={<ArrowRight size={16} />}>
              Ouvrir le rapport
            </Button>
          </Link>
        </article>

        <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6">Modules</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {modules.map((module) => (
            <article
              key={module.title}
              className="panel group flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-md sm:p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                <module.icon size={22} />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{module.tag}</p>
              <h3 className="text-xl font-bold text-slate-950 group-hover:text-teal-700 transition">{module.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{module.description}</p>
              <div className="mt-4 rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                {module.highlight}
              </div>
              <Link to={module.to} className="mt-4 block">
                <Button className="w-full" icon={<ArrowRight size={16} />}>
                  Ouvrir le module
                </Button>
              </Link>
            </article>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>Aucune donnée réelle ou confidentielle.</p>
          <a
            className="font-semibold text-teal-700 transition hover:text-teal-900 hover:underline"
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
