import {
  AlertTriangle,
  ArrowRight,
  Brain,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  Gauge,
  History,
  Library,
  RadioTower,
  Route,
  Zap
} from 'lucide-react';
import { type ReactNode } from 'react';

/* ─── DATA ──────────────────────────────────────────────────────────────── */

const summaryRows = [
  {
    module: 'Expiry Check',
    icon: ClipboardCheck,
    flow: 'Traçabilité qualité',
    problem: 'Dates critiques à vérifier avant démarrage',
    contribution: 'Statut immédiat, échéance visible, historique',
    indicators: 'conformité avant démarrage, alertes, oublis évités'
  },
  {
    module: 'Logistics Call',
    icon: RadioTower,
    flow: 'Appels logistiques',
    problem: 'Demandes palettes peu suivies',
    contribution: 'Appel digital, statut, priorité, temps écoulé',
    indicators: 'délai de prise en charge, demandes en attente, déplacements inutiles'
  },
  {
    module: 'Knowledge Base',
    icon: Library,
    flow: 'Standards terrain',
    problem: 'Accès documentaire lent ou peu intuitif',
    contribution: 'Recherche rapide, fiches structurées, accès par catégorie',
    indicators: 'temps de recherche, autonomie, temps de réaction'
  },
  {
    module: 'Packing Calculator',
    icon: Calculator,
    flow: 'Calcul conditionnement',
    problem: 'Calcul manuel palettes / cartons / unités',
    contribution: 'Découpage automatique, écart visible, décision fiabilisée',
    indicators: 'erreurs de quantité, temps de calcul, dépassements maîtrisés'
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
    color: 'teal',
    paragraphs: [
      `Une erreur terrain ne vient pas toujours d'un manque de compétence. Elle peut venir d'une information critique mal présentée, d'un statut invisible, d'une vérification oubliée ou d'un calcul réalisé dans un contexte déjà chargé.`,
      `Les prototypes visent à réduire ces erreurs évitables en rendant l'information décisive immédiatement lisible.`
    ],
    items: [
      `moins d'oublis`,
      `moins de doubles vérifications`,
      `moins d'ambiguïté avant action`,
      `meilleure anticipation des échéances`,
      `meilleure visibilité sur les statuts critiques`
    ]
  },
  {
    title: `Réduction des temps morts`,
    icon: Clock3,
    color: 'blue',
    paragraphs: [
      `Un flux mal suivi produit de l'attente.`,
      `Une palette prête mais non récupérée, une demande logistique non vue, une procédure difficile à trouver ou un calcul à refaire ralentissent la ligne sans forcément apparaître comme un arrêt machine.`,
      `Les prototypes rendent ces pertes visibles.`
    ],
    items: [
      `réduction du délai de prise en charge logistique`,
      `réduction des relances`,
      `réduction du temps de recherche documentaire`,
      `réduction du temps passé sur les calculs`,
      `meilleure priorisation des actions`
    ]
  },
  {
    title: `Traçabilité utile`,
    icon: History,
    color: 'violet',
    paragraphs: [
      `La traçabilité ne doit pas être une charge ajoutée au travail. Elle doit naître naturellement de l'action.`,
      `Lorsqu'un changement est déclaré, lorsqu'un appel est envoyé, lorsqu'un statut est modifié ou lorsqu'un calcul est effectué, l'historique doit se construire sans effort supplémentaire.`
    ],
    items: [
      `meilleure lecture des actions réalisées`,
      `historique exploitable`,
      `suivi des échéances`,
      `vision claire des demandes en cours`,
      `responsabilisation sans surcharge`
    ]
  },
  {
    title: `Réduction de la charge cognitive`,
    icon: Brain,
    color: 'amber',
    paragraphs: [
      `La charge cognitive inutile réduit la disponibilité du conducteur pour les situations réellement importantes.`,
      `Chaque application supplémentaire, chaque calcul manuel, chaque information à chercher, chaque statut à deviner et chaque support à croiser prélève une partie de l'attention.`,
      `L'objectif n'est pas de simplifier le métier artificiellement. L'objectif est de retirer ce qui parasite l'exécution.`
    ],
    items: [
      `moins de changements de contexte`,
      `moins de mémoire sollicitée`,
      `moins de calculs répétitifs`,
      `moins de signaux ambigus`,
      `plus de présence opérationnelle`
    ]
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
    subtitle: `Traçabilité qualité`,
    icon: ClipboardCheck,
    subject: `Suivi de validité des éléments critiques en contact produit.`,
    issueParagraphs: [
      `Certains éléments de la ligne, comme les tuyaux ou la tête de remplissage, sont en contact direct avec le produit. Leur suivi conditionne la conformité du démarrage.`,
      `Les informations importantes sont la cuve associée, la matière en cours, la date de changement, la date limite d'utilisation et le statut de conformité.`,
      `Lorsque ces informations reposent sur un support papier ou une vérification isolée, la qualité dépend fortement de la vigilance individuelle.`
    ],
    responseParagraphs: [
      `Expiry Check centralise l'état des éléments critiques par ligne.`,
      `Le conducteur visualise immédiatement :`
    ],
    responseItems: [
      `la cuve associée`,
      `la matière en cours`,
      `les éléments suivis`,
      `la date du dernier changement`,
      `la date limite`,
      `le statut qualité`,
      `l'historique des actions`,
      `l'alerte en cas de changement de matière`
    ],
    responseOutro: `La vue avant démarrage donne une réponse claire : conforme, vigilance ou action requise.`,
    valueParagraphs: [
      `Le contrôle devient immédiat.`,
      `L'échéance devient visible.`,
      `L'action nécessaire devient explicite.`,
      `L'historique devient exploitable.`
    ],
    indicators: [
      `taux de contrôles réalisés avant démarrage`,
      `nombre d'alertes avant expiration`,
      `nombre d'écarts détectés avant production`,
      `temps moyen de vérification`,
      `conformité des remplacements dans les délais`
    ]
  },
  {
    id: '5.2',
    title: 'Logistics Call',
    subtitle: `Appels logistiques`,
    icon: RadioTower,
    subject: `Signalement et suivi des palettes prêtes à évacuer.`,
    issueParagraphs: [
      `Lorsqu'une palette est prête, la logistique doit être informée rapidement. Un signal physique ou isolé permet d'appeler, mais ne permet pas toujours de suivre.`,
      `Un appel non suivi crée de l'incertitude :`
    ],
    issueItems: [
      `La demande a-t-elle été vue ?`,
      `Est-elle prioritaire ?`,
      `Depuis combien de temps attend-elle ?`,
      `Quelqu'un l'a-t-il prise en charge ?`,
      `Le signal est-il encore valide ?`
    ],
    responseParagraphs: [
      `Logistics Call transforme l'appel en flux suivi.`,
      `Côté ligne, le conducteur crée une demande simple : ligne, zone, nombre de palettes, priorité, commentaire.`,
      `Côté logistique, la demande apparaît dans un tableau de traitement avec un statut clair : en attente, vu, en cours, récupéré ou annulé.`,
      `Chaque demande porte son heure de création, son temps écoulé et son niveau de priorité.`
    ],
    valueParagraphs: [
      `Le signal devient une demande suivie.`,
      `La demande devient priorisable.`,
      `Le délai devient visible.`,
      `La prise en charge devient traçable.`
    ],
    indicators: [
      `temps moyen de prise en charge`,
      `temps moyen de récupération`,
      `nombre de demandes en attente`,
      `nombre de demandes annulées`,
      `taux de demandes traitées dans le délai cible`,
      `réduction des déplacements inutiles`
    ]
  },
  {
    id: '5.3',
    title: 'Knowledge Base',
    subtitle: `Standards terrain`,
    icon: Library,
    subject: `Accès rapide aux standards, modes opératoires, check-lists et fiches réaction.`,
    issueParagraphs: [
      `Une documentation utile doit être accessible au moment où elle est nécessaire.`,
      `Lorsque la base documentaire est lente, peu intuitive ou difficile à rechercher, l'information existe mais perd de sa valeur opérationnelle.`,
      `Un standard difficile à trouver devient un standard peu utilisé.`
    ],
    responseParagraphs: [
      `Knowledge Base propose une base documentaire structurée autour de l'usage terrain.`,
      `L'utilisateur accède aux contenus par recherche, catégorie, tags et fiches synthétiques.`,
      `Chaque fiche peut contenir :`
    ],
    responseItems: [
      `un résumé`,
      `les étapes clés`,
      `les points de vigilance`,
      `le niveau de criticité`,
      `le temps estimé`,
      `les documents liés`,
      `la date de mise à jour`
    ],
    valueParagraphs: [
      `L'information devient plus rapide à trouver.`,
      `Le standard devient plus facile à appliquer.`,
      `La réaction aux situations courantes devient plus fluide.`
    ],
    indicators: [
      `temps moyen de recherche d'une procédure`,
      `nombre de consultations`,
      `taux de fiches trouvées via recherche`,
      `temps de réaction à une anomalie`,
      `taux d'utilisation des standards disponibles`
    ]
  },
  {
    id: '5.4',
    title: 'Packing Calculator',
    subtitle: `Calcul palettes / cartons / unités`,
    icon: Calculator,
    subject: `Conversion d'une quantité totale en palettes, cartons et unités.`,
    issueParagraphs: [
      `Le conducteur reçoit une quantité totale à produire. Selon la référence, il doit convertir cette quantité en palettes complètes, cartons complets et unités restantes.`,
      `Le calcul dépend du nombre d'unités par carton et du nombre de cartons par palette.`,
      `Le calcul est simple en théorie. En situation de ligne, il s'ajoute à la cadence, aux arrêts, aux contrôles, à l'approvisionnement et aux saisies.`,
      `Une erreur de calcul peut créer un dépassement non anticipé, une mauvaise préparation ou une perte de temps.`
    ],
    responseParagraphs: [
      `Packing Calculator calcule automatiquement le découpage opérationnel.`,
      `Le conducteur saisit :`
    ],
    responseItems: [
      `la quantité demandée`,
      `le nombre d'unités par carton`,
      `le nombre de cartons par palette`
    ],
    responseMiddle: `Le système affiche :`,
    responseSecondaryItems: [
      `la capacité d'une palette`,
      `le nombre de palettes complètes`,
      `les cartons restants`,
      `les unités restantes`,
      `l'écart selon la stratégie choisie`
    ],
    responseOutro: `Les politiques disponibles rendent le choix explicite : ne pas dépasser, arrondir au carton, arrondir à la palette.`,
    valueParagraphs: [
      `Le calcul manuel disparaît.`,
      `L'écart devient visible.`,
      `La décision devient plus rapide.`,
      `Le risque d'erreur diminue.`
    ],
    indicators: [
      `temps moyen de calcul`,
      `nombre d'erreurs de quantité`,
      `écarts de production`,
      `dépassements évités`,
      `taux d'utilisation du calculateur`
    ]
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
  `identifier les règles métier`,
  `repérer les manques`,
  `prioriser les développements utiles`,
  `éviter les solutions hors-sol`
];

const visionItems = [
  `ce qui est conforme`,
  `ce qui demande une action`,
  `ce qui est en attente`,
  `ce qui est prioritaire`,
  `ce qui risque de bloquer`,
  `ce qui a déjà été traité`
];

/* ─── PRIMITIVES ─────────────────────────────────────────────────────────── */

const colorMap: Record<string, string> = {
  teal: 'bg-teal-500/10 text-teal-700 ring-teal-500/20',
  blue: 'bg-blue-500/10 text-blue-700 ring-blue-500/20',
  violet: 'bg-violet-500/10 text-violet-700 ring-violet-500/20',
  amber: 'bg-amber-500/10 text-amber-700 ring-amber-500/20'
};

function Pill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-teal-700 ring-1 ring-inset ring-teal-600/20">
      {label}
    </span>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-teal-600">
      <span className="block h-px w-5 bg-teal-500" />
      {children}
    </p>
  );
}

function BulletList({ items, accent = false }: { items: string[]; accent?: boolean }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${accent ? 'bg-teal-500' : 'bg-slate-400'}`} />
          <span className="text-sm leading-7 text-slate-600">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function CheckList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <CheckCircle2 size={15} className="mt-1 shrink-0 text-teal-500" />
          <span className="text-sm leading-6 text-slate-700">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function ChapterNumber({ n }: { n: string }) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600 text-sm font-black text-white shadow-md">
        {n}
      </span>
      <div className="h-px flex-1 bg-gradient-to-r from-teal-200 to-transparent" />
    </div>
  );
}

function Callout({ icon: Icon, children }: { icon: React.ElementType; children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-teal-50" />
      <div className="relative">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
          <Icon size={20} className="text-teal-700" />
        </div>
        {children}
      </div>
    </div>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────────────────── */

export function OperationalReportPage() {
  return (
    <div className="bg-slate-50 text-slate-900">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="industrial-grid absolute inset-0 opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-white" />
        <div className="relative mx-auto max-w-5xl px-5 py-12 sm:px-6 sm:py-24 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Pill label="Rapport d'observation opérationnelle" />
          </div>
          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
            Du terrain<br />
            <span className="text-teal-600">au prototype</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Une ligne de conditionnement ne se pilote pas uniquement par la machine. Elle se pilote par
            l'enchaînement continu de décisions humaines : vérifier, approvisionner, contrôler, saisir,
            calculer, appeler, arbitrer, réagir.
          </p>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-500">
            La performance d'une ligne dépend donc autant de la cadence machine que de la qualité de
            l'environnement informationnel autour du conducteur.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {openingStatements.map((s, i) => (
              <div key={s.key} className="group relative rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur transition hover:shadow-md">
                <span className="mb-3 block text-xs font-black text-teal-500">0{i + 1}</span>
                <p className="text-sm font-semibold leading-6 text-slate-800">{s.text}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 max-w-2xl text-xl font-bold leading-8 text-slate-950">
            Les prototypes présentés répondent à un principe unique : rendre les flux terrain plus visibles,
            plus traçables et plus simples à exécuter.
          </p>
        </div>
      </section>

      {/* ── SYNTHÈSE ── */}
      <section className="bg-slate-950 py-12 sm:py-20 text-white">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <SectionLabel>Vue executive</SectionLabel>
          <h2 className="mt-4 text-4xl font-black tracking-tight">Synthèse opérationnelle</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-400">
            Ces prototypes ne constituent pas des solutions finales. Ils matérialisent des axes
            d'amélioration concrets, testables, mesurables et discutables avec les utilisateurs terrain.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {summaryRows.map((row) => (
              <div key={row.module} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition hover:bg-white/8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20">
                    <row.icon size={18} className="text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{row.module}</h3>
                    <p className="text-xs text-teal-400">{row.flow}</p>
                  </div>
                </div>
                <div className="space-y-3 border-t border-white/10 pt-4">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Problème</p>
                    <p className="text-sm text-slate-300">{row.problem}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Apport direct</p>
                    <p className="text-sm text-slate-300">{row.contribution}</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Indicateurs</p>
                    <p className="text-sm text-slate-400">{row.indicators}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHAPITRES 01–02 ── */}
      <section className="bg-white py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid gap-20">

            {/* 01 */}
            <div>
              <ChapterNumber n="01" />
              <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    Conduite de ligne et charge réelle du poste
                  </h2>
                  <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                    <p>La conduite de ligne concentre plusieurs responsabilités simultanées.</p>
                    <p>
                      Le conducteur suit l'avancement de la production, surveille l'état de la ligne,
                      gère les arrêts, approvisionne les machines, réalise des contrôles, vérifie des
                      informations qualité, déclare des données, appelle la logistique, calcule des
                      quantités et consulte les standards lorsque la situation l'exige.
                    </p>
                    <p>Chaque tâche peut paraître simple isolément. Leur superposition crée la difficulté réelle du poste.</p>
                  </div>
                </div>
                <Callout icon={Gauge}>
                  <p className="text-lg font-bold leading-8 text-slate-950">
                    la machine, le produit, la matière, la qualité, la quantité, les palettes, les arrêts,
                    les outils, les documents, les priorités, les urgences et les aléas.
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    La reconstruction permanente de cette cohérence consomme de l'attention.
                  </p>
                </Callout>
              </div>
            </div>

            {/* 02 */}
            <div>
              <ChapterNumber n="02" />
              <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    Fragmentation de l'attention
                  </h2>
                  <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                    <p>Le point critique n'est pas l'absence d'information. Le point critique est sa dispersion.</p>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <ul className="space-y-2 text-sm leading-7 text-slate-600">
                        {[
                          `Une date peut être sur une feuille.`,
                          `Une déclaration peut être dans un logiciel.`,
                          `Un appel logistique peut dépendre d'un signal physique.`,
                          `Une procédure peut être dans une base documentaire lente.`,
                          `Un calcul peut être fait mentalement ou à part.`,
                          `Un statut peut exister sans être visible par tous.`
                        ].map((t) => (
                          <li key={t} className="flex items-start gap-2">
                            <ArrowRight size={14} className="mt-1.5 shrink-0 text-slate-400" />
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p>Cette dispersion crée une charge invisible.</p>
                    <p>
                      Elle impose au conducteur de changer de support, de retrouver le contexte, de comparer
                      des informations, de mémoriser des actions, de vérifier plusieurs fois et de compenser
                      les limites du système par sa vigilance.
                    </p>
                  </div>
                </div>
                <Callout icon={AlertTriangle}>
                  <p className="text-lg font-bold leading-8 text-slate-950">
                    Le conducteur ne doit pas compenser le système d'information.
                  </p>
                  <p className="mt-2 text-base font-bold text-teal-700">
                    Le système d'information doit soutenir le conducteur.
                  </p>
                </Callout>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── IMPACT ── */}
      <section className="bg-slate-50 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <SectionLabel>Impacts</SectionLabel>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            3. Impact opérationnel attendu
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {impactBlocks.map((block) => (
              <article key={block.title} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                <div className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${colorMap[block.color]}`}>
                  <block.icon size={14} />
                  {block.title}
                </div>
                <div className="space-y-3 text-sm leading-7 text-slate-600">
                  {block.paragraphs.map((p) => <p key={p}>{p}</p>)}
                </div>
                <div className="mt-5 rounded-xl bg-slate-50 p-4">
                  <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Impact attendu</p>
                  <BulletList items={block.items} accent />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRINCIPE DE CONCEPTION ── */}
      <section className="bg-white py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <ChapterNumber n="04" />
          <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
            <div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Principe de conception</h2>
              <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                <p>Un outil métier efficace ne cherche pas à être visible pour lui-même. Il sert l'action.</p>
                <p>Il doit répondre immédiatement à cinq questions :</p>
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                {designQuestions.map((q, i) => (
                  <div key={q} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="text-xs font-black text-teal-500">{String(i + 1).padStart(2, '0')}</span>
                    <span className="text-sm font-semibold text-slate-800">{q}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                <p>L'interface n'a pas vocation à impressionner. Elle doit rendre le travail plus juste, plus fluide et plus sûr.</p>
                <p className="text-sm text-slate-500">
                  La valeur d'un outil métier ne se mesure pas au nombre de fonctionnalités affichées.
                  Elle se mesure à la quantité de friction retirée du travail réel.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5">
                <Zap size={20} className="text-teal-600" />
                <p className="mt-3 text-base font-bold leading-7 text-teal-900">
                  Un bon outil est visible lorsqu'il évite une erreur. Il devient discret lorsque
                  l'exécution avance normalement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROTOTYPES ── */}
      <section className="bg-slate-50 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <SectionLabel>Dossiers</SectionLabel>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-slate-950">5. Prototypes</h2>

          <div className="mt-10 space-y-6">
            {prototypes.map((proto) => (
              <article key={proto.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-slate-100 bg-gradient-to-r from-slate-950 to-slate-800 p-6 sm:p-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="rounded-lg bg-teal-500/20 p-2">
                        <proto.icon size={20} className="text-teal-400" />
                      </span>
                      <span className="text-xs font-bold uppercase tracking-widest text-teal-400">{proto.id}</span>
                    </div>
                    <h3 className="text-2xl font-black tracking-tight text-white sm:text-3xl">{proto.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">{proto.subtitle}</p>
                  </div>
                  <div className="hidden sm:block text-right">
                    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-sm">
                      {proto.subject}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="grid gap-px bg-slate-100 lg:grid-cols-2">
                  <div className="bg-white p-6">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Enjeu opérationnel</p>
                    <div className="space-y-3 text-sm leading-7 text-slate-600">
                      {proto.issueParagraphs.map((p) => <p key={p}>{p}</p>)}
                      {'issueItems' in proto && proto.issueItems ? <BulletList items={proto.issueItems as string[]} /> : null}
                    </div>
                  </div>

                  <div className="bg-white p-6">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Réponse proposée</p>
                    <div className="space-y-3 text-sm leading-7 text-slate-600">
                      {proto.responseParagraphs.map((p) => <p key={p}>{p}</p>)}
                      {'responseItems' in proto && proto.responseItems ? <CheckList items={proto.responseItems as string[]} /> : null}
                      {'responseMiddle' in proto && proto.responseMiddle ? <p className="font-semibold text-slate-700">{proto.responseMiddle as string}</p> : null}
                      {'responseSecondaryItems' in proto && proto.responseSecondaryItems ? <CheckList items={proto.responseSecondaryItems as string[]} /> : null}
                      {'responseOutro' in proto && proto.responseOutro ? (
                        <p className="rounded-lg bg-teal-50 px-4 py-3 text-sm font-semibold text-teal-800">{proto.responseOutro as string}</p>
                      ) : null}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Valeur opérationnelle</p>
                    <div className="space-y-2">
                      {proto.valueParagraphs.map((p) => (
                        <div key={p} className="flex items-center gap-3">
                          <ArrowRight size={14} className="shrink-0 text-teal-500" />
                          <p className="text-sm font-semibold text-slate-700">{p}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-6">
                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Indicateurs possibles</p>
                    <BulletList items={proto.indicators} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHAPITRES 06–09 ── */}
      <section className="bg-white py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid gap-20">

            {/* 06 */}
            <div>
              <ChapterNumber n="06" />
              <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Lecture globale</h2>
                  <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                    <p>Les quatre prototypes ciblent un même enjeu : la continuité du flux opérationnel.</p>
                    <p>
                      Ils ne répondent pas à quatre problèmes isolés. Ils répondent à quatre formes de
                      friction dans le travail réel :
                    </p>
                    <BulletList items={globalFrictionItems} accent />
                    <p>
                      Dans chaque cas, l'enjeu n'est pas de remplacer le conducteur. L'enjeu est de
                      prolonger son intelligence terrain avec un système plus clair.
                    </p>
                  </div>
                </div>
                <Callout icon={Route}>
                  <p className="text-lg font-bold leading-8 text-slate-950">
                    L'outil doit absorber la complexité répétitive pour laisser au conducteur la décision,
                    la vigilance et l'arbitrage.
                  </p>
                </Callout>
              </div>
            </div>

            {/* 07 */}
            <div>
              <ChapterNumber n="07" />
              <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Intérêt des prototypes</h2>
                  <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                    <p>Un prototype permet de matérialiser rapidement une amélioration avant tout engagement lourd.</p>
                    <p>Il rend visible un flux, une logique, une interface, une hypothèse d'usage.</p>
                    <p>Sa valeur est immédiate :</p>
                    <BulletList items={prototypeValueItems} accent />
                  </div>
                </div>
                <Callout icon={FileText}>
                  <p className="text-lg font-bold leading-8 text-slate-950">
                    Un prototype transforme une idée abstraite en objet manipulable.
                  </p>
                  <p className="mt-3 text-sm text-slate-500">
                    Il accélère le passage entre observation, discussion et décision.
                  </p>
                </Callout>
              </div>
            </div>

            {/* 08 */}
            <div>
              <ChapterNumber n="08" />
              <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Vision</h2>
                  <div className="mt-6 space-y-4 text-base leading-8 text-slate-600">
                    <p>
                      L'objectif final n'est pas de multiplier les applications. L'objectif est de
                      construire un environnement de conduite plus fluide.
                    </p>
                    <p>
                      Un poste de conduite efficace présente la bonne information au bon moment, dans
                      le bon contexte, avec une action claire.
                    </p>
                    <p>Il doit permettre de voir immédiatement :</p>
                    <BulletList items={visionItems} accent />
                    <p>
                      La performance ne vient pas seulement de la machine. Elle vient aussi de la
                      qualité du système qui entoure l'action humaine.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { text: `L'interface doit disparaître dans l'exécution.`, dark: true },
                    { text: `Elle reste présente pour sécuriser, alerter, guider et tracer.`, dark: false },
                    { text: `Elle s'efface lorsque le travail avance.`, dark: false }
                  ].map((item) => (
                    <div key={item.text} className={`rounded-xl p-4 ${item.dark ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-slate-50'}`}>
                      <p className={`text-sm font-semibold leading-6 ${item.dark ? 'text-white' : 'text-slate-700'}`}>{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 09 */}
            <div>
              <ChapterNumber n="09" />
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Positionnement</h2>
              <div className="mt-6 max-w-3xl space-y-4 text-base leading-8 text-slate-600">
                <p>Ces prototypes sont fictifs, anonymisés et limités à une démonstration.</p>
                <p>
                  Ils ne représentent aucun système existant. Ils n'utilisent aucune donnée réelle ou
                  confidentielle. Ils ne remplacent aucune procédure validée.
                </p>
                <p>
                  Ils montrent une direction : rendre certains flux terrain plus lisibles, plus traçables
                  et plus simples à piloter.
                </p>
                <p>
                  L'amélioration opérationnelle ne passe pas toujours par de grands projets. Elle passe
                  aussi par la suppression de frictions précises, répétées et mesurables.
                </p>
                <p className="font-semibold text-slate-800">
                  Une date mieux visible, un appel mieux suivi, un standard plus accessible ou un calcul
                  fiabilisé peuvent améliorer concrètement la qualité du travail quotidien.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CONCLUSION ── */}
      <section className="bg-slate-950 py-12 sm:py-20">
        <div className="mx-auto max-w-5xl px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
            <div>
              <SectionLabel>Conclusion</SectionLabel>
              <div className="mt-6 space-y-5 text-base leading-8 text-slate-300">
                <p>
                  Une ligne de conditionnement ne se résume pas à sa cadence. Elle dépend de la façon
                  dont l'information circule autour de ceux qui la pilotent.
                </p>
                <p>
                  Lorsque l'information est claire, contextualisée et actionnable, le travail devient
                  plus fluide. Lorsqu'elle est dispersée, ambiguë ou portée par la mémoire, elle crée
                  de la charge inutile.
                </p>
                <p>LineOps Toolkit présente quatre prototypes autour d'une même ambition :</p>
              </div>
              <div className="mt-6 rounded-2xl border border-teal-500/30 bg-teal-500/10 p-6">
                <p className="text-xl font-black leading-8 text-white">
                  Rendre les flux terrain plus visibles, plus traçables et plus faciles à exécuter.
                </p>
              </div>
              <div className="mt-6 space-y-4 text-base leading-8 text-slate-300">
                <p>
                  La valeur recherchée est directe : moins d'erreurs évitables, moins de temps perdu,
                  moins de charge cognitive, plus de traçabilité et une meilleure continuité opérationnelle.
                </p>
              </div>
            </div>
            <div className="space-y-3 lg:pt-16">
              {[
                { text: `Les meilleurs outils métier ne s'ajoutent pas au travail.`, accent: false },
                { text: `Ils s'intègrent à son mouvement.`, accent: true },
                { text: `Ils soutiennent l'action sans la ralentir.`, accent: false }
              ].map((item) => (
                <div key={item.text} className={`rounded-xl border p-4 ${item.accent ? 'border-teal-500/40 bg-teal-500/10' : 'border-white/10 bg-white/5'}`}>
                  <p className={`text-sm font-semibold ${item.accent ? 'text-teal-300' : 'text-slate-400'}`}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
