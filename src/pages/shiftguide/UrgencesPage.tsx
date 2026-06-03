import { ChevronLeft, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const reglesDOr = [
  {
    icon: '🔒',
    title: 'LOTO',
    description:
      'Je respecte les procédures de consignation/déconsignation et carter ouvert',
  },
  {
    icon: '🧤',
    title: 'COUPURE',
    description: 'Je porte mes gants pour manipuler les cartons et verres',
  },
  {
    icon: '🔧',
    title: 'ÉQUIPEMENT VALIDE',
    description: "J'utilise des équipements validés sécurité",
  },
  {
    icon: '🏋️',
    title: 'ERGONOMIE',
    description: 'Je porte une charge près de moi',
  },
  {
    icon: '🔵',
    title: 'CHOC',
    description:
      "J'utilise les éléments bleus pour ne pas me faire mal",
  },
  {
    icon: '👁️',
    title: 'CO-ACTIVITÉ',
    description:
      "J'établis un contact visuel pour traverser sur un passage piéton",
  },
  {
    icon: '🥽',
    title: 'CHIMIQUE',
    description:
      "Je porte mes lunettes de sécurité dans les zones de production",
  },
  {
    icon: '♻️',
    title: 'ENVIRONNEMENT',
    description: 'Je respecte le tri des déchets',
  },
];

export function UrgencesPage() {
  const navigate = useNavigate();

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0f172a] text-[#f1f5f9]">
      {/* Header */}
      <header className="flex-none flex items-center gap-2 border-b border-slate-800 px-3 py-3">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="flex items-center gap-2 text-base font-bold text-red-400">
          <ShieldAlert size={18} />
          Urgences & Règles d'Or
        </span>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6 pb-8">

        {/* Essai sirène */}
        <div className="rounded-2xl border border-yellow-700/40 bg-yellow-900/20 p-4">
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-yellow-400">
            ⚠️ Essai sirène
          </p>
          <p className="text-sm leading-relaxed text-[#94a3b8]">
            Premier mardi de chaque mois à 15h — sirène de quelques secondes.{' '}
            <span className="font-semibold text-yellow-300">Ne pas évacuer.</span>
          </p>
        </div>

        {/* Évacuation */}
        <div className="rounded-2xl border border-red-800/50 bg-red-900/20 p-4">
          <p className="mb-3 text-sm font-bold text-red-400">
            🚨 Sirène longue = Évacuation générale
          </p>
          <ul className="space-y-2 text-sm leading-relaxed text-[#94a3b8]">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500">→</span>
              Utiliser les sorties de secours les plus proches
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500">→</span>
              Rejoindre le point de rassemblement en passant par l'extérieur
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500">→</span>
              Aller toujours en avant
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500">→</span>
              Au point de rassemblement, répondre à l'appel
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-red-500">→</span>
              Reprendre son poste de travail après autorisation
            </li>
          </ul>
        </div>

        {/* En cas d'accident */}
        <div className="rounded-2xl bg-[#1e293b] p-4">
          <p className="mb-3 text-sm font-bold text-[#f1f5f9]">
            🚑 En cas d'accident — 3 étapes
          </p>
          <div className="space-y-3">
            {[
              {
                step: '1',
                label: 'PROTÉGER',
                desc: "Arrêt d'urgence, balisage",
                color: 'bg-orange-700',
              },
              {
                step: '2',
                label: 'ALERTER',
                desc: 'Composer le 15 ou le 18 depuis un poste interne',
                color: 'bg-red-700',
              },
              {
                step: '3',
                label: 'SECOURIR',
                desc: 'Rester à disposition',
                color: 'bg-blue-700',
              },
            ].map((item) => (
              <div key={item.step} className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.color} text-xs font-black text-white`}
                >
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-bold text-[#f1f5f9]">
                    {item.label}
                  </p>
                  <p className="text-xs text-[#94a3b8]">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Règles d'Or */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">
            Règles d'Or
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {reglesDOr.map((regle) => (
              <div
                key={regle.title}
                className="flex items-start gap-3 rounded-xl bg-[#1e293b] p-4"
              >
                <span className="text-2xl leading-none">{regle.icon}</span>
                <div>
                  <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-[#3b82f6]">
                    {regle.title}
                  </p>
                  <p className="text-sm leading-snug text-[#94a3b8]">
                    {regle.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
