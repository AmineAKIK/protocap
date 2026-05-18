import { ArrowRight, ClipboardCheck, Library, RadioTower, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';

const prototypes = [
  {
    title: 'Expiry Check',
    description: 'Suivi de validité des tuyaux produit et de la tête de remplissage avant démarrage.',
    to: '/expiry-check',
    icon: ClipboardCheck
  },
  {
    title: 'Logistics Call',
    description: 'Signalement digital des palettes prêtes à évacuer, visible immédiatement côté logistique.',
    to: '/logistics-call',
    icon: RadioTower
  },
  {
    title: 'Knowledge Base',
    description: 'Base documentaire fictive avec recherche, catégories, fiches structurées et favoris.',
    to: '/knowledge-base',
    icon: Library
  }
];

export function HomePage() {
  return (
    <div>
      <section className="industrial-grid border-b border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-3 py-8 sm:px-6 sm:py-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-16">
          <div className="flex min-w-0 flex-col justify-center">
            <div className="mb-5 inline-flex max-w-full items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-sm font-semibold text-teal-800">
              <ShieldCheck size={16} />
              <span>Démonstration générique, données fictives</span>
            </div>
            <h1 className="text-3xl font-bold tracking-normal text-slate-950 sm:text-5xl">LineOps Toolkit</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
              Prototypes génériques pour fluidifier certains usages terrain en environnement de production :
              suivi de validité d’éléments critiques, appels logistiques et accès simplifié à la documentation.
            </p>
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
              Merci pour votre accueil. J’ai préparé ces maquettes génériques comme exercice de conception et de développement autour de situations terrain que je trouve intéressantes.
            </div>
          </div>
          <div className="grid min-w-0 content-end gap-3">
            <div className="panel p-4 sm:p-5">
              <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Contexte</p>
              <p className="mt-2 text-base leading-7 text-slate-700">
                Cette page présente des maquettes fictives conçues comme démonstration d’idées d’amélioration. Les données affichées sont uniquement des exemples.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
              {['Validité', 'Appels', 'Docs'].map((item) => (
                <div key={item} className="rounded-lg bg-slate-900 p-3 text-center text-sm font-semibold text-white sm:p-4">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-3 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {prototypes.map((prototype) => (
            <article key={prototype.title} className="panel flex flex-col p-4 transition hover:-translate-y-0.5 hover:shadow-soft sm:p-5">
              <div className="mb-5 grid h-12 w-12 place-items-center rounded-lg bg-teal-50 text-teal-700">
                <prototype.icon size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-950">{prototype.title}</h2>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{prototype.description}</p>
              <Link to={prototype.to} className="mt-5 block">
                <Button className="w-full" icon={<ArrowRight size={17} />}>
                  Voir le prototype
                </Button>
              </Link>
            </article>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center text-sm font-semibold text-slate-500">
        Prototype personnel - données fictives - aucune information réelle ou confidentielle -{' '}
        <a className="text-teal-700 transition hover:text-teal-900" href="https://www.akiksystems.com" target="_blank" rel="noreferrer">
          www.akiksystems.com
        </a>
      </footer>
    </div>
  );
}
