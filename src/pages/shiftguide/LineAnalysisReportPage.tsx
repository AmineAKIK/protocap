import {
  Activity, AlertTriangle, ArrowDown, ArrowRight, BarChart3, BookOpen,
  Box, CheckCircle2, ChevronDown, ChevronLeft, CircleDot, Clock3,
  Factory, Gauge, GitBranch, Layers3, Lightbulb, Menu, PackageOpen,
  RadioTower, Search, ShieldCheck, Sparkles, Target, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

type Tone = 'confirmed' | 'hypothesis' | 'watch' | 'excluded';
type Fault = { name: string; occurrences: string; nature: string; status: string; tone: Tone };

const sections = [
  { id: 'synthese', n: '01', label: 'Résumé exécutif', icon: Target },
  { id: 'etuyese', n: '02', label: 'Étuyeuse D6318-1', icon: PackageOpen },
  { id: 'encaisseuse', n: '03', label: 'Encaisseuse D63182', icon: Box },
  { id: 'performance', n: '04', label: 'Contexte de performance', icon: Gauge },
  { id: 'strategie', n: '05', label: 'Proposition stratégique', icon: Lightbulb },
] as const;

const etuyeseCaused: Fault[] = [
  { name: 'Magasin étuis vide droite (B103)', occurrences: '48', nature: "Conséquence directe — la désynchronisation interrompt l’avancée du tapis droit.", status: 'Confirmé', tone: 'confirmed' },
  { name: 'Défaut prise étuis', occurrences: '41–45', nature: "Conséquence directe — l’étui arrive en diagonale et l’aspiration échoue.", status: 'Confirmé', tone: 'confirmed' },
  { name: 'Bourrage bol V2', occurrences: '38–39', nature: 'Écart marqué avec le bol V1 (5–6 occurrences) ; même signature que le déséquilibre observé sur les tubes lignes 1/2, mécanisme non confirmé.', status: 'Hypothèse', tone: 'hypothesis' },
];

const otherCauses: Fault[] = [
  { name: 'Bourrage intro tube ligne 1 & 2', occurrences: '4–5 / 21', nature: "Le dernier tube du tapis d’alimentation s’arrête systématiquement devant les cellules à chaque arrêt.", status: 'Réel — réglage temps de roulement', tone: 'confirmed' },
  { name: 'Pliage petit rabat sup. (B04/B05)', occurrences: '16–17', nature: 'Toujours à la même position du plateau tournant sur un cycle qui en compte plusieurs — signature d’un poste précis, non d’un aléa produit.', status: 'Réel — poste mécanique à inspecter', tone: 'confirmed' },
  { name: 'Trappe arrière gauche (B120)', occurrences: '4–8', nature: 'Blocage intermittent résolu par réouverture manuelle ; la récurrence suggère une pièce en usure.', status: 'Réel — à surveiller', tone: 'watch' },
  { name: 'Basculeur étuis (IA212)', occurrences: '44–48', nature: "Un couvercle mal clipsé non détecté poursuit son cycle et se coince au retournement ; le mécanisme est identifié, pas la cause de non-détection.", status: 'Réel partiel — cause à identifier', tone: 'hypothesis' },
];

const noImpact: Fault[] = [
  { name: 'Alerte couvercle mal clipsé', occurrences: '95–97', nature: 'Cas détectés : rejet propre par la machine vers la caisse prévue à cet effet.', status: 'Géré — sans impact si détecté', tone: 'confirmed' },
  { name: 'Sens produit / bourrage sortie', occurrences: '13–17', nature: 'Boîte sortie à l’envers ou ouverte sur le tapis après éjection — possible symptôme aval, non confirmé.', status: 'À surveiller', tone: 'watch' },
  { name: 'Modif : sauvegarde format actif', occurrences: '9', nature: 'Journal de changement de format, pas un dysfonctionnement.', status: 'Exclu — non pertinent', tone: 'excluded' },
];

const unlinked: Fault[] = [
  { name: 'Machine en sécurité', occurrences: '68 / 2h01', nature: 'Le plus gros total cumulé du journal — fréquence et durée élevées simultanément.', status: 'Cumul', tone: 'watch' },
  { name: 'Attente étiqueteuse prête', occurrences: '6 / 54min', nature: '9 min par occurrence en moyenne — rare mais coûteux ; pointe vers une désynchronisation avec l’étiqueteuse en amont.', status: 'Machine amont à investiguer', tone: 'hypothesis' },
  { name: 'Cluster TransfertLot (4 libellés)', occurrences: '37 / 70min', nature: 'Avertissement moteur, erreur moteur, dépassement de couple, moteur non prêt : quatre alarmes, un sous-système.', status: 'Moteur à ausculter', tone: 'hypothesis' },
  { name: 'Défaut caisse non évacuée (BM51)', occurrences: '32 / 45min', nature: 'Caisse non évacuée du poste de rebut — mécanisme non observé sur site.', status: 'À investiguer', tone: 'watch' },
  { name: 'Machine en sur-cadence', occurrences: '17 / 18min', nature: 'Cadence au-delà du seuil machine — réglage local ou cascade depuis l’amont, non déterminé.', status: 'À investiguer', tone: 'watch' },
  { name: 'Niveau mini scotcheuse gauche (B60)', occurrences: '11 / 30min', nature: 'Niveau de consommable bas — probable réapprovisionnement, pas un défaut mécanique.', status: 'Probable — logistique', tone: 'excluded' },
  { name: 'Défaut prise caisse (B20)', occurrences: '11 / 6min', nature: 'Même poste que « retirer caisse au poste dépose » — cause commune possible, non confirmée.', status: 'À investiguer', tone: 'watch' },
];

const toneStyles: Record<Tone, string> = {
  confirmed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  hypothesis: 'border-amber-200 bg-amber-50 text-amber-800',
  watch: 'border-sky-200 bg-sky-50 text-sky-800',
  excluded: 'border-zinc-200 bg-zinc-100 text-zinc-600',
};

function FaultCards({ items }: { items: Fault[] }) {
  return <div className="grid gap-3 md:grid-cols-2">{items.map((fault) => (
    <details key={fault.name} className="group rounded-2xl border border-zinc-200 bg-white shadow-sm open:shadow-md">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4">
        <div className="min-w-0">
          <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${toneStyles[fault.tone]}`}>{fault.status}</span>
          <h4 className="mt-3 font-black text-zinc-950">{fault.name}</h4>
          <p className="mt-1 text-xs font-black uppercase tracking-wider text-zinc-400">{fault.occurrences} occurrences</p>
        </div>
        <ChevronDown className="mt-1 shrink-0 text-zinc-400 transition group-open:rotate-180" size={18} />
      </summary>
      <p className="border-t border-zinc-100 px-4 py-4 text-sm leading-6 text-zinc-600">{fault.nature}</p>
    </details>
  ))}</div>;
}

function SectionTitle({ number, eyebrow, title, children }: { number: string; eyebrow: string; title: string; children?: React.ReactNode }) {
  return <div className="mb-7 border-b border-zinc-200 pb-6">
    <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[.2em] text-teal-700"><span className="grid h-8 w-8 place-items-center rounded-lg bg-teal-100">{number}</span>{eyebrow}</div>
    <h2 className="mt-4 text-3xl font-black tracking-tight text-zinc-950 sm:text-4xl">{title}</h2>
    {children && <div className="mt-3 max-w-4xl text-base leading-7 text-zinc-600">{children}</div>}
  </div>;
}

function MachineRoot({ title, machine, status, children }: { title: string; machine: string; status: string; children: React.ReactNode }) {
  return <div className="relative overflow-hidden rounded-3xl border border-emerald-300 bg-gradient-to-br from-emerald-950 to-zinc-950 p-6 text-white shadow-xl sm:p-8">
    <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
    <div className="relative flex flex-wrap items-start justify-between gap-5">
      <div><p className="text-xs font-black uppercase tracking-[.22em] text-emerald-300">Cause racine · {machine}</p><h3 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h3></div>
      <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-black uppercase text-emerald-200">{status}</span>
    </div>
    <p className="relative mt-5 max-w-4xl text-sm leading-7 text-zinc-300">{children}</p>
  </div>;
}

function NavRail({ active }: { active: string }) {
  return <aside className="hidden xl:block"><div className="sticky top-24 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm">
    <p className="px-3 pb-3 pt-2 text-[10px] font-black uppercase tracking-[.2em] text-zinc-400">Dans ce rapport</p>
    {sections.map(({ id, n, label, icon: Icon }) => <a key={id} href={`#${id}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${active === id ? 'bg-zinc-950 text-white shadow-lg' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950'}`}><Icon size={16} className={active === id ? 'text-teal-300' : ''}/><span className="w-5 text-[10px] opacity-60">{n}</span>{label}</a>)}
  </div></aside>;
}

export function LineAnalysisReportPage() {
  const navigate = useNavigate();
  const [active, setActive] = useState('synthese');
  const [mobileNav, setMobileNav] = useState(false);
  const [root, setRoot] = useState<'etuyese' | 'encaisseuse'>('etuyese');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
      let current = 'synthese';
      for (const section of sections) {
        const el = document.getElementById(section.id);
        if (el && el.getBoundingClientRect().top < 180) current = section.id;
      }
      setActive(current);
    };
    update(); window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  const activeRoot = useMemo(() => root === 'etuyese' ? etuyeseCaused : [{ name: 'Bourrage entrée élévateur (B102)', occurrences: '20 / 55min', nature: 'Confirmé par observation visuelle directe du mécanisme de frottement.', status: 'Confirmé par observation directe', tone: 'confirmed' as Tone }], [root]);

  return <div className="min-h-screen scroll-smooth bg-[#f3f5f7] text-zinc-950">
    <div className="fixed left-0 top-0 z-[60] h-1 bg-teal-500 transition-[width]" style={{ width: `${progress}%` }} />
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate('/shiftguide/modules')} className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-sm font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"><ChevronLeft size={18}/> <span className="hidden sm:inline">Modules</span></button>
        <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-950 text-teal-300"><GitBranch size={19}/></span><div className="min-w-0"><p className="truncate text-sm font-black">Analyse de ligne 101</p><p className="hidden text-[10px] font-black uppercase tracking-[.18em] text-zinc-400 sm:block">Diagnostic causal & performance</p></div></div>
        <div className="flex items-center gap-2"><Link to="/shiftguide/linepulse" className="grid h-10 w-10 place-items-center rounded-full bg-zinc-950 text-teal-300" aria-label="LinePulse"><RadioTower size={15}/></Link><button onClick={() => setMobileNav(!mobileNav)} className="grid h-10 w-10 place-items-center rounded-full bg-zinc-100 xl:hidden" aria-label="Sommaire">{mobileNav ? <X size={17}/> : <Menu size={17}/>}</button></div>
      </div>
      {mobileNav && <nav className="border-t border-zinc-100 bg-white p-3 xl:hidden">{sections.map(s => <a key={s.id} href={`#${s.id}`} onClick={() => setMobileNav(false)} className="flex rounded-xl px-4 py-3 text-sm font-bold hover:bg-zinc-100"><span className="mr-3 text-teal-700">{s.n}</span>{s.label}</a>)}</nav>}
    </header>

    <main>
      <section className="relative overflow-hidden bg-zinc-950 text-white">
        <div className="industrial-grid absolute inset-0 opacity-20"/><div className="absolute -right-20 top-10 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl"/>
        <div className="relative mx-auto max-w-[1500px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid items-end gap-10 lg:grid-cols-[1fr_auto]">
            <div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-black uppercase tracking-wider text-teal-200">Document interne</span><span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-zinc-300">SAV JYGA · fenêtre en cours</span></div><p className="mt-8 text-xs font-black uppercase tracking-[.28em] text-teal-300">Rapport d’analyse de ligne 101</p><h1 className="mt-3 max-w-4xl text-4xl font-black tracking-[-.04em] sm:text-6xl lg:text-7xl">Du symptôme visible à la cause réelle.</h1><p className="mt-6 max-w-3xl text-lg leading-8 text-zinc-300">Diagnostic causal et performance des machines <strong className="text-white">Encaisseuse D63182</strong> et <strong className="text-white">Étuyeuse D6318-1</strong>.</p><p className="mt-5 text-sm font-bold text-zinc-500">AKIK Mohamed Amine</p></div>
            <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur sm:w-[430px]">{[['2','machines'],['2','causes racines'],['1','correction appliquée']].map(([value,label]) => <div key={label} className="border-r border-white/10 p-4 last:border-0"><p className="text-3xl font-black text-teal-300">{value}</p><p className="mt-1 text-[10px] font-black uppercase leading-4 tracking-wider text-zinc-400">{label}</p></div>)}</div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-8 sm:px-6 lg:px-8 xl:grid-cols-[17rem_minmax(0,1fr)]"><NavRail active={active}/><div className="min-w-0 space-y-8">
        <section id="synthese" className="scroll-mt-24 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8">
          <SectionTitle number="01" eyebrow="Résumé exécutif" title="Deux causes structurent le diagnostic."><p>Deux causes racines ont été identifiées et confirmées par observation directe. Elles expliquent à elles seules la majorité des arrêts significatifs enregistrés sur les deux machines. Une cause est corrigée ; la seconde est documentée avec preuve mécanique et attend intervention.</p></SectionTitle>
          <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider text-emerald-700">Étuyeuse D6318-1</span><CheckCircle2 className="text-emerald-600" size={21}/></div><h3 className="mt-4 text-xl font-black">Cellule droite désynchronisée</h3><p className="mt-2 text-sm leading-6 text-emerald-950/70">Désalignement des deux tapis d’alimentation.</p><span className="mt-5 inline-flex rounded-full bg-emerald-700 px-3 py-1 text-xs font-black uppercase text-white">Corrigée</span></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-black uppercase tracking-wider text-amber-700">Encaisseuse D63182</span><AlertTriangle className="text-amber-600" size={21}/></div><h3 className="mt-4 text-xl font-black">Boîte couvercle-en-avant</h3><p className="mt-2 text-sm leading-6 text-amber-950/70">Frottement contre la butée du plateau élévateur.</p><span className="mt-5 inline-flex rounded-full bg-amber-600 px-3 py-1 text-xs font-black uppercase text-white">Diagnostiquée</span></div></div>
          <div className="mt-6 rounded-2xl bg-zinc-950 p-5 text-white sm:p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-teal-300">Méthodologie · réel / causé</p><p className="mt-3 leading-7 text-zinc-300"><strong className="text-white">Problème réel :</strong> cause racine physique ou mécanique identifiée et vérifiée sur site. <strong className="text-white">Problème causé :</strong> événement distinct dans le journal, mais conséquence en aval d’un problème réel. Cette distinction évite de corriger isolément plusieurs alarmes partageant une même cause.</p><div className="mt-5 grid gap-2 sm:grid-cols-3"><span className="rounded-xl bg-emerald-400/10 p-3 text-xs font-bold text-emerald-200">● Observation directe</span><span className="rounded-xl bg-sky-400/10 p-3 text-xs font-bold text-sky-200">● Corrélation temporelle</span><span className="rounded-xl bg-amber-400/10 p-3 text-xs font-bold text-amber-200">● Hypothèse ouverte</span></div><p className="mt-4 text-xs leading-5 text-zinc-500">Dans ce rapport, aucun défaut ne repose sur une simple corrélation temporelle jugée assez solide pour être qualifiée de confirmée.</p></div>
        </section>

        <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-teal-700">Carte causale interactive</p><h2 className="mt-2 text-2xl font-black">Choisir une cause racine</h2></div><div className="flex rounded-xl bg-zinc-100 p-1"><button onClick={() => setRoot('etuyese')} className={`rounded-lg px-3 py-2 text-xs font-black transition ${root === 'etuyese' ? 'bg-white text-zinc-950 shadow' : 'text-zinc-500'}`}>Étuyeuse</button><button onClick={() => setRoot('encaisseuse')} className={`rounded-lg px-3 py-2 text-xs font-black transition ${root === 'encaisseuse' ? 'bg-white text-zinc-950 shadow' : 'text-zinc-500'}`}>Encaisseuse</button></div></div><div className="mt-6 rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-5 text-center"><p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Cause réelle</p><p className="mt-2 text-lg font-black">{root === 'etuyese' ? 'Cellule droite désynchronisée' : 'Boîte présentée couvercle-en-avant'}</p></div><div className="mx-auto grid h-12 w-px bg-gradient-to-b from-emerald-600 to-zinc-300"><ArrowDown className="-ml-[9px] mt-7 text-emerald-700" size={19}/></div><div className="grid gap-3 md:grid-cols-3">{activeRoot.map(item => <div key={item.name} className={`rounded-2xl border p-4 ${toneStyles[item.tone]}`}><p className="text-xs font-black uppercase">{item.status}</p><p className="mt-3 font-black text-zinc-950">{item.name}</p><p className="mt-2 text-xs font-bold text-zinc-500">{item.occurrences} occurrences</p></div>)}</div></section>

        <section id="etuyese" className="scroll-mt-24 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"><SectionTitle number="02" eyebrow="Machine" title="Étuyeuse D6318-1"/><MachineRoot machine="Étuyeuse D6318-1" title="Désynchronisation de la cellule droite" status="Corrigée le 21/07/2026">La machine possède deux tapis d’alimentation en étuis, chacun piloté par sa cellule. Sans synchronisation, un tapis avance seul : l’étui arrive en diagonale devant la buse et l’aspiration ne peut plus assurer la prise. La cellule droite a été repositionnée ; aucun nouveau défaut d’étui n’a été constaté sur le reste de la journée.</MachineRoot><h3 className="mb-4 mt-8 text-lg font-black">Défauts générés en aval</h3><FaultCards items={etuyeseCaused}/><h3 className="mb-4 mt-9 text-lg font-black">2.1 · Autres causes identifiées</h3><p className="mb-5 text-sm leading-6 text-zinc-600">Quatre défauts supplémentaires disposent d’un mécanisme indépendant de la cellule. Le dernier est partiellement expliqué : son symptôme est compris, sa cause profonde reste ouverte.</p><FaultCards items={otherCauses}/><h3 className="mb-4 mt-9 text-lg font-black">2.2 · Défauts sans impact opérationnel</h3><p className="mb-5 text-sm leading-6 text-zinc-600">Le défaut le plus fréquent du journal n’entraîne aucune cascade lorsqu’il est détecté. Les cas qui échappent à la détection relèvent du basculeur étuis ci-dessus.</p><FaultCards items={noImpact}/><div className="mt-7 rounded-2xl border border-zinc-200 bg-zinc-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-zinc-500">2.3 · Insuffisant pour conclure</p><p className="mt-3 text-sm leading-6 text-zinc-600">Occurrences uniques ou quasi uniques : machine en sur-cadence (5), alerte éjection poste 10 (3), pliage petit rabat inférieur (1), bourrage convoyeur introduction droit (1), défaut blocage étuis après éjection (1). Ils sont consignés pour suivi, mais ne sont pas prioritaires.</p></div></section>

        <section id="encaisseuse" className="scroll-mt-24 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"><SectionTitle number="03" eyebrow="Machine" title="Encaisseuse D63182"/><MachineRoot machine="Encaisseuse D63182" title="Orientation d’entrée de la boîte" status="Diagnostiquée">Au maintien de la dernière boîte avant élévation, un bras pousse les boîtes dans le carton. Présenté couvercle-en-avant, le bord frotte sur la fixation du plateau, peut ouvrir le rabat, désorganiser le carton et provoquer un bourrage. Dans l’orientation inverse, aucun bord ouvrant n’est exposé.</MachineRoot><div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Effet confirmé · B102</p><div className="mt-3 flex items-end justify-between gap-4"><h3 className="text-xl font-black">Bourrage entrée élévateur</h3><p className="text-2xl font-black text-emerald-700">20 <span className="text-xs">/ 55min</span></p></div><p className="mt-3 text-sm text-emerald-950/70">Mécanisme de frottement confirmé par observation visuelle directe.</p></div><div className="mt-4 rounded-2xl bg-amber-50 p-5 ring-1 ring-amber-200"><p className="text-xs font-black uppercase tracking-wider text-amber-700">Correction proposée</p><p className="mt-2 text-sm font-bold leading-6 text-amber-950">Inverser le sens de présentation des boîtes à l’entrée, ou — si l’amont impose ce sens — ajouter un point de retournement avant le poste.</p></div><h3 className="mb-4 mt-9 text-lg font-black">3.1 · Défauts non rattachés à ce jour</h3><p className="mb-5 text-sm leading-6 text-zinc-600">Listés par transparence faute d’une observation terrain équivalente au bourrage B102.</p><FaultCards items={unlinked}/><div className="mt-6 rounded-2xl bg-zinc-100 p-5 text-sm leading-6 text-zinc-600">Faible occurrence, consignés pour suivi : retirer caisse au poste dépose (5), bourrage convoyeur intro B101 (6), niveau consommable étiqueteuse bas (1), EntrainementTaquets — alerte moteur (3), bourrage dans élévateur B105 (2), soit 15 occurrences cumulées.</div></section>

        <section id="performance" className="scroll-mt-24 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-8"><SectionTitle number="04" eyebrow="Mesure" title="Contexte de performance">Les indicateurs relevés le jour de l’intervention situent l’effet possible de la correction apportée à l’étuyeuse.</SectionTitle><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['405','tubes / minute','Cadence en cours',Activity],['400','tubes / minute','Cadence nominale',Gauge],['10h 00','record sans incident','Meilleur TMBF',ShieldCheck],['4 min 12','depuis le dernier arrêt','TMBF équipe',Clock3]].map(([value,unit,label,Icon]) => { const I=Icon as LucideIcon; return <div key={String(label)} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"><I size={18} className="text-teal-700"/><p className="mt-5 text-3xl font-black">{String(value)}</p><p className="mt-1 text-xs font-bold text-zinc-500">{String(unit)}</p><p className="mt-4 text-[10px] font-black uppercase tracking-wider text-zinc-400">{String(label)}</p></div>})}</div><div className="mt-7 space-y-4 text-sm leading-7 text-zinc-600"><p><strong className="text-zinc-950">Précision de lecture :</strong> le TMBF affiché n’est pas une moyenne. C’est un chrono remis à zéro à chaque arrêt dépassant trois minutes, mesuré par la cellule de cadence. « 4 min 12 » indique la durée sans incident au moment de la capture. Le record de 10h donne un meilleur cas observé, pas un plafond théorique.</p><p>La cadence dépasse le nominal, ce qui écarte une explication par sous-régime. Un relevé ponctuel du TMBF ne révèle cependant pas la distribution des incidents : il faudrait l’historique complet des remises à zéro.</p><p>La production horaire remonte nettement à partir de 7h. Le repositionnement a eu lieu durant le poste du matin commencé à 6h, sans heure exacte. La coïncidence est cohérente avec l’effet attendu, mais la correction et le changement d’équipe évoluent simultanément : leur part respective ne peut pas encore être isolée statistiquement.</p><p className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-sky-950"><strong>Vigilance :</strong> le compteur « tube/minute » concerne une étape distincte de l’étuyeuse. Si l’amélioration reflète sa correction, elle illustre l’effet système : une station aval qui bourre peut limiter le débit effectif d’une station amont.</p></div></section>

        <section id="strategie" className="scroll-mt-24 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-xl"><div className="p-5 sm:p-8"><SectionTitle number="05" eyebrow="Vision" title="Proposition stratégique"><p className="text-zinc-300">Formaliser le raisonnement causal en un outil visuel opérateur, généralisable aux lignes complexes.</p></SectionTitle><div className="space-y-4 text-sm leading-7 text-zinc-300"><p>Les diagnostics partent d’un symptôme journalisé — bourrage, défaut de prise, alerte — dont la cause réelle se trouve ailleurs. Une ligne de conditionnement est un système intégré : une perturbation se propage aux étapes suivantes.</p><p>Ici, la distance reste courte et interne à la machine. Sur une ligne complète de quatre ou cinq machines, un bourrage visible sur l’encaisseuse peut provenir d’une cellophaneuse ou d’une étiqueteuse plusieurs postes en amont.</p></div><div className="mt-8 rounded-2xl border border-white/10 bg-white/[.04] p-5"><p className="text-xs font-black uppercase tracking-[.2em] text-teal-300">Scénario illustratif · non observé sur cette ligne</p><div className="mt-6 grid items-center gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr]"><div className="rounded-xl border border-dashed border-zinc-500 p-4 text-center"><p className="font-black">Cellophaneuse</p><p className="mt-1 text-xs text-zinc-500">Cause racine potentielle</p></div><ArrowRight className="mx-auto rotate-90 text-teal-300 md:rotate-0"/><div className="rounded-xl border border-dashed border-zinc-500 p-4 text-center"><p className="font-black">Étiqueteuse</p><p className="mt-1 text-xs text-zinc-500">Relais possible</p></div><ArrowRight className="mx-auto rotate-90 text-teal-300 md:rotate-0"/><div className="rounded-xl border border-red-400/50 bg-red-400/10 p-4 text-center"><p className="font-black text-red-200">Encaisseuse</p><p className="mt-1 text-xs text-red-300/70">Symptôme visible</p></div></div></div><h3 className="mt-9 text-xl font-black">5.1 · Ce que l’outil propose</h3><div className="mt-4 grid gap-3 md:grid-cols-2">{['Une base structurée en schéma causal : cause racine → défauts générés.','Un statut visuel par nœud, sans prétendre à plus de certitude que les preuves.','Une architecture extensible à toutes les machines, au-delà du sous-système local.','Un réflexe pédagogique : remonter tout le système avant de se focaliser sur le symptôme.'].map((t,i)=><div key={t} className="flex gap-3 rounded-xl bg-white/[.05] p-4"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-teal-400/10 text-xs font-black text-teal-300">{i+1}</span><p className="text-sm leading-6 text-zinc-300">{t}</p></div>)}</div><h3 className="mt-9 text-xl font-black">5.2 · Valeur attendue</h3><p className="mt-3 text-sm leading-7 text-zinc-300">L’outil ne remplace pas l’expertise technique : il en démocratise le point d’entrée. Les deux cas validés forment la preuve de concept initiale. Chaque intervention documentée selon la grille réel/causé enrichit la base sans travail redondant : le même modèle sert de rapport d’intervention et de nœud pédagogique.</p></div><div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 bg-white/[.03] px-5 py-5 sm:px-8"><p className="text-xs font-black uppercase tracking-[.2em] text-zinc-500">Fin du rapport · Analyse de ligne 101</p><a href="#synthese" className="inline-flex items-center gap-2 rounded-full bg-teal-400 px-4 py-2 text-xs font-black text-zinc-950">Revenir au début <ArrowDown className="rotate-180" size={14}/></a></div></section>
      </div></div>
    </main>
  </div>;
}
