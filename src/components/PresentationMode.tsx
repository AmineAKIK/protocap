import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calculator,
  CheckCircle2,
  Clock3,
  FileText,
  Gauge,
  History,
  Library,
  RadioTower,
  Route,
  X,
  Zap
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { ClipboardCheck } from 'lucide-react';

/* ─── DATA ──────────────────────────────────────────────────────────────── */

const summaryRows = [
  {
    module: 'Expiry Check',
    icon: ClipboardCheck,
    flow: 'Traçabilité qualité',
    contribution: 'Appel digital, statut, priorité, temps écoulé'
  },
  {
    module: 'Logistics Call',
    icon: RadioTower,
    flow: 'Appels logistiques',
    contribution: 'Appel digital, statut, priorité, temps écoulé'
  },
  {
    module: 'Knowledge Base',
    icon: Library,
    flow: 'Standards terrain',
    contribution: 'Recherche rapide, fiches structurées, accès par catégorie'
  },
  {
    module: 'Packing Calculator',
    icon: Calculator,
    flow: 'Calcul conditionnement',
    contribution: 'Découpage automatique, écart visible, décision fiabilisée'
  }
];

const openingStatements = [
  { text: `Une information utile mais dispersée devient une charge.`, key: 'a' },
  { text: `Une information critique portée par la mémoire devient un risque.`, key: 'b' },
  { text: `Une action simple répartie entre plusieurs supports devient une friction.`, key: 'c' }
];

const impactBlocks = [
  {
    title: `Réduction des erreurs évitables`,
    icon: CheckCircle2,
    items: [`moins d'oublis`, `moins de doubles vérifications`, `moins d'ambiguïté avant action`]
  },
  {
    title: `Réduction des temps morts`,
    icon: Clock3,
    items: [`réduction du délai logistique`, `réduction des relances`, `réduction du temps de recherche`]
  },
  {
    title: `Traçabilité utile`,
    icon: History,
    items: [`meilleure lecture des actions`, `historique exploitable`, `suivi des échéances`]
  },
  {
    title: `Réduction de la charge cognitive`,
    icon: Brain,
    items: [`moins de changements de contexte`, `moins de mémoire sollicitée`, `plus de présence opérationnelle`]
  }
];

const designQuestions = [
  `Qu'est-ce qui se passe ?`,
  `Qu'est-ce qui est prioritaire ?`,
  `Qu'est-ce qui bloque ?`,
  `Qu'est-ce qui est déjà traité ?`,
  `Qu'est-ce que je dois faire maintenant ?`
];

const prototypes = [
  {
    id: '5.1',
    title: 'Expiry Check',
    icon: ClipboardCheck,
    issueParagraph: `Certains éléments de la ligne sont en contact direct avec le produit. Leur suivi conditionne la conformité du démarrage. Lorsque ces informations reposent sur un support papier, la qualité dépend de la vigilance individuelle.`,
    responseParagraph: `Expiry Check centralise l'état des éléments critiques par ligne. Le conducteur visualise immédiatement le statut, la date limite et l'historique.`,
    valueParagraphs: [`Le contrôle devient immédiat.`, `L'échéance devient visible.`, `L'action nécessaire devient explicite.`, `L'historique devient exploitable.`],
    indicators: [`taux de contrôles réalisés avant démarrage`, `nombre d'alertes avant expiration`, `conformité des remplacements dans les délais`]
  },
  {
    id: '5.2',
    title: 'Logistics Call',
    icon: RadioTower,
    issueParagraph: `Lorsqu'une palette est prête, la logistique doit être informée rapidement. Un signal isolé ne permet pas toujours de suivre si la demande a été vue, prise en charge ou reste en attente.`,
    responseParagraph: `Logistics Call transforme l'appel en flux suivi. La demande apparaît dans un tableau de traitement avec un statut clair, un temps écoulé et un niveau de priorité.`,
    valueParagraphs: [`Le signal devient une demande suivie.`, `La demande devient priorisable.`, `Le délai devient visible.`, `La prise en charge devient traçable.`],
    indicators: [`temps moyen de prise en charge`, `nombre de demandes en attente`, `taux de demandes traitées dans le délai cible`]
  },
  {
    id: '5.3',
    title: 'Knowledge Base',
    icon: Library,
    issueParagraph: `Une documentation utile doit être accessible au moment où elle est nécessaire. Lorsque la base documentaire est lente ou peu intuitive, l'information existe mais perd de sa valeur opérationnelle.`,
    responseParagraph: `Knowledge Base propose une base documentaire structurée autour de l'usage terrain. L'utilisateur accède aux contenus par recherche, catégorie, tags et fiches synthétiques.`,
    valueParagraphs: [`L'information devient plus rapide à trouver.`, `Le standard devient plus facile à appliquer.`, `La réaction aux situations courantes devient plus fluide.`],
    indicators: [`temps moyen de recherche d'une procédure`, `nombre de consultations`, `taux de fiches trouvées via recherche`]
  },
  {
    id: '5.4',
    title: 'Packing Calculator',
    icon: Calculator,
    issueParagraph: `Le conducteur reçoit une quantité totale à produire et doit la convertir en palettes, cartons et unités. Ce calcul simple s'ajoute à la cadence, aux arrêts et aux saisies — une erreur peut créer un dépassement non anticipé.`,
    responseParagraph: `Packing Calculator calcule automatiquement le découpage opérationnel. Le conducteur saisit la quantité et le conditionnement — le système affiche palettes, cartons, unités et l'écart selon la stratégie choisie.`,
    valueParagraphs: [`Le calcul manuel disparaît.`, `L'écart devient visible.`, `La décision devient plus rapide.`, `Le risque d'erreur diminue.`],
    indicators: [`temps moyen de calcul`, `nombre d'erreurs de quantité`, `dépassements évités`]
  }
];

const globalFrictionItems = [
  `vérifier une échéance critique`,
  `signaler un besoin logistique`,
  `retrouver une information`,
  `calculer une quantité opérationnelle`
];

const prototypeValueItems = [
  `clarifier un besoin`,
  `aligner les acteurs`,
  `faire réagir les utilisateurs`,
  `identifier les règles métier`
];

const visionItems = [
  `ce qui est conforme`,
  `ce qui demande une action`,
  `ce qui est en attente`,
  `ce qui est prioritaire`,
  `ce qui risque de bloquer`,
  `ce qui a déjà été traité`
];

/* ─── SLIDES ─────────────────────────────────────────────────────────────── */

interface Slide {
  label: string;
  title: string;
  body: ReactNode;
}

const slides: Slide[] = [
  {
    label: `Rapport d'observation opérationnelle`,
    title: `Du terrain au prototype`,
    body: (
      <div className="space-y-3 sm:space-y-5">
        <p className="text-base leading-7 text-slate-200 sm:text-xl sm:leading-9">
          Une ligne de conditionnement ne se pilote pas uniquement par la machine.
          Elle se pilote par l'enchaînement continu de décisions humaines.
        </p>
        <p className="text-sm leading-6 text-slate-400 sm:text-lg sm:leading-8">
          La performance d'une ligne dépend autant de la cadence machine que de la qualité
          de l'environnement informationnel autour du conducteur.
        </p>
        <div className="grid gap-2 md:grid-cols-3">
          {openingStatements.map((s, i) => (
            <div key={s.key} className="min-w-0 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 sm:rounded-2xl sm:p-4">
              <span className="mb-1 block text-xs font-black text-teal-400">0{i + 1}</span>
              <p className="break-normal text-xs font-semibold leading-5 text-white sm:text-sm sm:leading-6">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    label: `Synthèse opérationnelle`,
    title: `Quatre modules, un même enjeu`,
    body: (
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {summaryRows.map((row) => (
          <div key={row.module} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <div className="mb-2 flex min-w-0 items-center gap-2 sm:mb-4 sm:gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/20">
                <row.icon size={16} className="text-teal-400" />
              </div>
              <div className="min-w-0">
                <p className="break-normal text-sm font-bold text-white">{row.module}</p>
                <p className="break-normal text-xs text-teal-400">{row.flow}</p>
              </div>
            </div>
            <p className="break-normal text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">{row.contribution}</p>
          </div>
        ))}
      </div>
    )
  },
  {
    label: `Chapitre 01`,
    title: `Conduite de ligne et charge réelle`,
    body: (
      <div className="max-w-3xl space-y-3 sm:space-y-5">
        <p className="text-base leading-7 text-slate-200 sm:text-xl sm:leading-9">
          La conduite de ligne concentre plusieurs responsabilités simultanées.
          Leur superposition crée la difficulté réelle du poste.
        </p>
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 sm:rounded-2xl sm:p-6">
          <Gauge size={20} className="mb-2 text-teal-400" />
          <p className="break-normal text-sm font-bold leading-6 text-white sm:text-lg sm:leading-8">
            La machine · le produit · la matière · la qualité · la quantité · les palettes ·
            les arrêts · les outils · les documents · les priorités · les urgences · les aléas.
          </p>
        </div>
        <p className="text-sm leading-6 text-slate-400 sm:text-base">
          Le conducteur doit souvent reconstruire lui-même la cohérence entre ces éléments.
          Cette reconstruction permanente consomme de l'attention.
        </p>
      </div>
    )
  },
  {
    label: `Chapitre 02`,
    title: `Fragmentation de l'attention`,
    body: (
      <div className="max-w-3xl space-y-3 sm:space-y-5">
        <p className="text-base leading-7 text-slate-200 sm:text-xl sm:leading-9">
          Le point critique n'est pas l'absence d'information — c'est sa dispersion.
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
          {[
            `Une date sur une feuille.`,
            `Une déclaration dans un logiciel.`,
            `Un appel via un signal physique.`,
            `Une procédure dans une base lente.`,
            `Un calcul fait mentalement.`,
            `Un statut non visible par tous.`,
          ].map((t) => (
            <div key={t} className="flex min-w-0 items-start gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <ArrowRight size={12} className="mt-0.5 shrink-0 text-slate-500" />
              <p className="min-w-0 break-normal text-xs leading-5 text-slate-300">{t}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 sm:rounded-2xl sm:p-5">
          <AlertTriangle size={18} className="mb-2 text-teal-400" />
          <p className="break-normal text-sm font-bold leading-6 text-white sm:text-base sm:leading-7">
            Le conducteur ne doit pas compenser le système d'information.
            Le système d'information doit soutenir le conducteur.
          </p>
        </div>
      </div>
    )
  },
  {
    label: `Chapitre 03`,
    title: `Impact opérationnel attendu`,
    body: (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {impactBlocks.map((block) => (
          <div key={block.title} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <div className="mb-2 flex min-w-0 items-center gap-1.5 sm:mb-3 sm:gap-2">
              <block.icon size={15} className="shrink-0 text-teal-400" />
              <p className="min-w-0 break-normal text-xs font-bold leading-4 text-white sm:text-sm">{block.title}</p>
            </div>
            <ul className="space-y-1">
              {block.items.map((item) => (
                <li key={item} className="flex min-w-0 items-start gap-1.5 text-xs leading-4 text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500" />
                  <span className="min-w-0 break-normal">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    )
  },
  {
    label: `Chapitre 04`,
    title: `Principe de conception`,
    body: (
      <div className="max-w-3xl space-y-3 sm:space-y-5">
        <p className="text-base leading-7 text-slate-200 sm:text-xl sm:leading-9">
          Un outil métier efficace ne cherche pas à être visible pour lui-même. Il sert l'action.
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2 lg:grid-cols-3">
          {designQuestions.map((q, i) => (
            <div key={q} className="flex min-w-0 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 sm:rounded-xl">
              <span className="shrink-0 text-xs font-black text-teal-400">{String(i + 1).padStart(2, '0')}</span>
              <span className="min-w-0 break-normal text-xs font-semibold text-white sm:text-sm">{q}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 sm:rounded-2xl sm:p-5">
          <Zap size={18} className="mb-2 text-teal-400" />
          <p className="break-normal text-sm font-bold leading-6 text-white sm:text-base">
            La valeur d'un outil métier se mesure à la quantité de friction retirée du travail réel.
          </p>
        </div>
      </div>
    )
  },
  ...prototypes.map((proto) => ({
    label: `Prototype ${proto.id}`,
    title: `${proto.title}`,
    body: (
      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="min-w-0 space-y-2 sm:space-y-4">
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Enjeu</p>
            <p className="break-normal text-xs leading-5 text-slate-300 sm:text-sm sm:leading-7">{proto.issueParagraph}</p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Réponse</p>
            <p className="break-normal text-xs leading-5 text-slate-300 sm:text-sm sm:leading-7">{proto.responseParagraph}</p>
          </div>
        </div>
        <div className="min-w-0 space-y-2 sm:space-y-4">
          <div className="min-w-0 rounded-xl border border-teal-500/20 bg-teal-500/5 p-3 sm:rounded-2xl sm:p-5">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-teal-500">Valeur</p>
            <ul className="space-y-1.5">
              {proto.valueParagraphs.map((p) => (
                <li key={p} className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-white sm:text-sm">
                  <ArrowRight size={12} className="shrink-0 text-teal-500" />
                  <span className="min-w-0 break-normal">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Indicateurs</p>
            <ul className="space-y-1">
              {proto.indicators.map((ind) => (
                <li key={ind} className="flex min-w-0 items-start gap-1.5 text-xs leading-4 text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                  <span className="min-w-0 break-normal">{ind}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  })),
  {
    label: `Chapitres 06 — 07`,
    title: `Lecture globale & Prototypes`,
    body: (
      <div className="grid max-w-4xl gap-2 sm:grid-cols-2 sm:gap-5">
        <div className="min-w-0 space-y-2 sm:space-y-4">
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <Route size={18} className="mb-2 text-teal-400" />
            <p className="break-normal text-xs font-bold leading-5 text-white sm:text-base sm:leading-7">
              L'outil doit absorber la complexité répétitive pour laisser au conducteur
              la décision, la vigilance et l'arbitrage.
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">4 formes de friction</p>
            <ul className="space-y-1.5">
              {globalFrictionItems.map((item) => (
                <li key={item} className="flex min-w-0 items-start gap-2 text-xs leading-4 text-slate-300 sm:text-sm sm:leading-6">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500" />
                  <span className="min-w-0 break-normal">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="min-w-0 space-y-2 sm:space-y-4">
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <FileText size={18} className="mb-2 text-teal-400" />
            <p className="break-normal text-xs font-bold leading-5 text-white sm:text-base sm:leading-7">
              Un prototype transforme une idée abstraite en objet manipulable
              et accélère le passage entre observation et décision.
            </p>
          </div>
          <div className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3 sm:rounded-2xl sm:p-5">
            <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Sa valeur</p>
            <ul className="space-y-1.5">
              {prototypeValueItems.map((item) => (
                <li key={item} className="flex min-w-0 items-start gap-2 text-xs leading-4 text-slate-300 sm:text-sm sm:leading-6">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal-500" />
                  <span className="min-w-0 break-normal">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  },
  {
    label: `Chapitre 08`,
    title: `Vision`,
    body: (
      <div className="max-w-3xl space-y-3 sm:space-y-5">
        <p className="text-base leading-7 text-slate-200 sm:text-xl sm:leading-9">
          L'objectif est de construire un environnement de conduite plus fluide —
          la bonne information, au bon moment, avec une action claire.
        </p>
        <div className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2 sm:grid-cols-3 sm:gap-2">
          {visionItems.map((item) => (
            <div key={item} className="flex min-w-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 sm:rounded-xl sm:gap-2 sm:px-4 sm:py-3">
              <CheckCircle2 size={12} className="shrink-0 text-teal-500" />
              <span className="min-w-0 break-normal text-xs text-white sm:text-sm">{item}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-3">
          {[
            { text: `L'interface disparaît dans l'exécution.`, accent: true },
            { text: `Elle sécurise, alerte, guide et trace.`, accent: false },
            { text: `Elle s'efface quand le travail avance.`, accent: false },
          ].map((item) => (
            <div key={item.text} className={`min-w-0 rounded-lg p-2.5 sm:rounded-xl sm:p-4 ${item.accent ? 'border border-teal-500/30 bg-teal-500/10' : 'border border-white/10 bg-white/5'}`}>
              <p className={`break-normal text-xs font-semibold leading-4 sm:text-sm sm:leading-6 ${item.accent ? 'text-teal-300' : 'text-slate-400'}`}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    label: `Conclusion`,
    title: `Rendre les flux terrain plus visibles, plus traçables, plus simples.`,
    body: (
      <div className="max-w-3xl space-y-3 sm:space-y-5">
        <p className="text-base leading-7 text-slate-200 sm:text-xl sm:leading-9">
          Une ligne de conditionnement ne se résume pas à sa cadence.
          Elle dépend de la façon dont l'information circule autour de ceux qui la pilotent.
        </p>
        <div className="rounded-xl border border-teal-500/30 bg-teal-500/10 p-4 sm:rounded-2xl sm:p-6">
          <p className="break-normal text-sm font-black leading-6 text-white sm:text-lg sm:leading-8">
            Moins d'erreurs évitables · moins de temps perdu · moins de charge cognitive ·
            plus de traçabilité · meilleure continuité opérationnelle.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 sm:gap-3">
          {[
            { text: `Les meilleurs outils ne s'ajoutent pas au travail.`, accent: false },
            { text: `Ils s'intègrent à son mouvement.`, accent: true },
            { text: `Ils soutiennent l'action sans la ralentir.`, accent: false },
          ].map((item) => (
            <div key={item.text} className={`min-w-0 rounded-lg p-2.5 sm:rounded-xl sm:p-4 ${item.accent ? 'border border-teal-500/40 bg-teal-500/10' : 'border border-white/10 bg-white/5'}`}>
              <p className={`break-normal text-xs font-semibold leading-4 sm:text-sm sm:leading-6 ${item.accent ? 'text-teal-300' : 'text-slate-400'}`}>{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    )
  },
  {
    label: `Disponibilité`,
    title: `Ces prototypes sont disponibles à tester sur ligne.`,
    body: null
  }
];

/* ─── COMPONENT ──────────────────────────────────────────────────────────── */

export function PresentationMode({ onClose }: { onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const total = slides.length;
  const slide = slides[index];

  const prev = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setIndex((i) => Math.min(total - 1, i + 1)), [total]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); next(); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); prev(); }
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  const progress = ((index + 1) / total) * 100;

  return (
    <div
      className="fixed inset-0 z-50 grid h-[100dvh] min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Présentation du rapport opérationnel"
    >
      <div className="h-0.5 w-full bg-white/10">
        <div className="h-0.5 bg-teal-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="contents">
        <div className="flex min-w-0 items-center justify-between px-4 py-2.5 sm:px-10 sm:py-4">
          <span className="min-w-0 break-normal pr-3 text-[10px] font-bold uppercase tracking-widest text-teal-500 sm:text-xs">{slide.label}</span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-400 transition hover:border-white/20 hover:text-white"
            aria-label="Quitter la présentation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-3 sm:px-10 sm:py-4 lg:px-16">
          <div className="mx-auto flex min-h-full w-full max-w-5xl min-w-0 flex-col justify-center py-1 sm:py-3">
            <h2 className="mb-4 break-normal text-[clamp(1.5rem,7vw,3rem)] font-black tracking-tight text-white sm:mb-6 lg:text-5xl">
              {slide.title}
            </h2>
            <div className="min-w-0">{slide.body}</div>
          </div>
        </div>

        <div className="flex min-w-0 items-center justify-between gap-3 border-t border-white/10 px-4 py-2.5 sm:px-10 sm:py-4">
          <button
            type="button"
            onClick={prev}
            disabled={index === 0}
            className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-slate-300 transition hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 sm:px-5 sm:py-2.5"
          >
            ← <span className="hidden sm:inline">Précédent</span>
          </button>

          <div className="hidden min-w-0 items-center justify-center gap-1.5 sm:flex">
            {slides.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 shrink-0 rounded-full transition-all ${i === index ? 'w-6 bg-teal-500' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
                aria-label={`Aller à la slide ${i + 1}`}
              />
            ))}
          </div>

          <span className="shrink-0 text-xs font-bold tabular-nums text-slate-500 sm:hidden">{index + 1} / {total}</span>

          {index === total - 1 ? (
            <button
              type="button"
              onClick={onClose}
              className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 sm:px-5 sm:py-2.5"
            >
              Terminer
            </button>
          ) : (
            <button
              type="button"
              onClick={next}
              className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-500 sm:px-5 sm:py-2.5"
            >
              <span className="hidden sm:inline">Suivant</span> →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
