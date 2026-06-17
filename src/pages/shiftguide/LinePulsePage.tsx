import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowDownRight,
  BarChart3,
  BellRing,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Factory,
  Gauge,
  History,
  Layers3,
  LineChart,
  MonitorCheck,
  RadioTower,
  Route,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Target,
  TimerReset,
  TrendingUp,
  UserRound,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import linePulseMock from '../../data/linePulseMock.json';

type ViewMode = 'driver' | 'supervisor' | 'manager' | 'executive' | 'value';
type LineStatus = 'green' | 'orange' | 'red';
type ComponentState = 'Disponible' | 'Risque identifie' | 'Non disponible';
type SupportType = 'Aucun' | 'Technique' | 'Qualite' | 'Logistique' | 'Maintenance';

interface ProductionLine {
  id: string;
  name: string;
  zone: string;
  team: string;
  conductor: string;
  status: LineStatus;
  change: string;
  components: ComponentState;
  support: SupportType;
  hasRisk: boolean;
  risk: string;
  comment: string;
  lastUpdate: string;
  oc: string;
  cadence: number;
  nextMilestone: string;
}

interface AlertHistoryItem {
  time: string;
  line: string;
  event: string;
  severity: LineStatus;
}

interface WeeklyPoint {
  day: string;
  value: number;
  alerts: number;
  supports: number;
}

interface EventStreamItem extends AlertHistoryItem {
  type: string;
}

interface Recommendation {
  id: string;
  line: string;
  priority: 'Critique' | 'Haute';
  deadline: string;
  decision: string;
  impact: string;
  owner: string;
}

interface OperationalImpact {
  collectionTimeSaved: string;
  targetedRounds: number;
  resolvedAlerts: number;
  continuityIndex: number;
  globalRisk: string;
  weekendVisibility: number;
  weekendCoverage: string;
}

interface ExecutiveData {
  operationalAvailability: number;
  linesUnderWatch: number;
  criticalBlocks: number;
  decisionsToday: number;
}

interface LinePulseData {
  site: string;
  snapshotTime: string;
  shift: string;
  lines: ProductionLine[];
  alertsHistory: AlertHistoryItem[];
  weeklyStability: WeeklyPoint[];
  eventStream: EventStreamItem[];
  recommendations: Recommendation[];
  operationalImpact: OperationalImpact;
  executive: ExecutiveData;
}

const DATA = linePulseMock as LinePulseData;

const statusConfig: Record<LineStatus, { label: string; dot: string; text: string; bg: string; ring: string; icon: LucideIcon }> = {
  green: {
    label: 'Ligne OK',
    dot: 'bg-emerald-400',
    text: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-100',
    icon: CheckCircle2,
  },
  orange: {
    label: 'Vigilance',
    dot: 'bg-amber-400',
    text: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-100',
    icon: AlertTriangle,
  },
  red: {
    label: 'Blocage',
    dot: 'bg-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-100',
    icon: BellRing,
  },
};

const changeOptions = ['Aucun', 'Lot', 'Format', 'Formule', 'Pays', 'Packaging'];
const componentOptions: ComponentState[] = ['Disponible', 'Risque identifie', 'Non disponible'];
const supportOptions: SupportType[] = ['Aucun', 'Technique', 'Qualite', 'Logistique', 'Maintenance'];
const filterOptions = [
  { id: 'risks', label: 'Risques', icon: AlertTriangle },
  { id: 'changes', label: "Changement d'OC", icon: Layers3 },
  { id: 'technical', label: 'Besoin technique', icon: Wrench },
  { id: 'quality', label: 'Besoin qualite', icon: ShieldCheck },
] as const;

function classNames(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function statusCounts(lines: ProductionLine[]) {
  return {
    green: lines.filter((line) => line.status === 'green').length,
    orange: lines.filter((line) => line.status === 'orange').length,
    red: lines.filter((line) => line.status === 'red').length,
  };
}

function stabilityIndex(lines: ProductionLine[]) {
  const redPenalty = lines.filter((line) => line.status === 'red').length * 9;
  const orangePenalty = lines.filter((line) => line.status === 'orange').length * 4;
  const riskPenalty = lines.filter((line) => line.hasRisk).length * 2;
  const supportPenalty = lines.filter((line) => line.support !== 'Aucun').length;
  return Math.max(0, Math.min(100, 100 - redPenalty - orangePenalty - riskPenalty - supportPenalty));
}

function needsAction(line: ProductionLine) {
  return line.status === 'red' || line.support !== 'Aucun' || line.components !== 'Disponible' || line.hasRisk;
}

function StatusBadge({ status, compact = false }: { status: LineStatus; compact?: boolean }) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={classNames(
        'inline-flex items-center gap-2 rounded-full font-black ring-1',
        config.bg,
        config.text,
        config.ring,
        compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      )}
    >
      <span className={classNames('h-2 w-2 rounded-full', config.dot)} />
      <Icon size={compact ? 12 : 14} />
      {config.label}
    </span>
  );
}

function MetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-4 shadow-lg shadow-zinc-200/60">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-zinc-950">{value}</p>
        </div>
        <span className={classNames('grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1', tone)}>
          <Icon size={18} />
        </span>
      </div>
      <p className="mt-3 text-xs font-bold leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function OperationalImpactStrip({ impact }: { impact: OperationalImpact }) {
  const metrics = [
    {
      label: 'Collecte evitee',
      value: impact.collectionTimeSaved,
      detail: "Temps restitue aujourd'hui",
      icon: TimerReset,
      tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100',
    },
    {
      label: 'Tournees ciblees',
      value: `${impact.targetedRounds}/12`,
      detail: 'Lignes a voir en priorite',
      icon: Route,
      tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    },
    {
      label: 'Alertes resolues',
      value: impact.resolvedAlerts,
      detail: 'Avant impact production',
      icon: CheckCircle2,
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
    {
      label: 'Continuite',
      value: `${impact.continuityIndex}%`,
      detail: `Risque global ${impact.globalRisk.toLowerCase()}`,
      icon: Gauge,
      tone: 'bg-amber-50 text-amber-700 ring-amber-100',
    },
  ];

  return (
    <section className="grid min-w-0 max-w-full gap-3 md:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_1.35fr]">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <div key={metric.label} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-400">{metric.label}</p>
                <p className="mt-2 text-2xl font-black tracking-tight text-zinc-950">{metric.value}</p>
              </div>
              <span className={classNames('grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1', metric.tone)}>
                <Icon size={16} />
              </span>
            </div>
            <p className="mt-2 text-xs font-bold text-zinc-500">{metric.detail}</p>
          </div>
        );
      })}

      <div className="relative overflow-hidden rounded-2xl border border-teal-800 bg-zinc-950 p-4 text-white shadow-lg shadow-zinc-950/10 md:col-span-2 xl:col-span-1">
        <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-teal-400/10" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-300">Visibilite week-end</p>
            <p className="mt-2 text-3xl font-black">{impact.weekendVisibility}%</p>
          </div>
          <CalendarDays size={19} className="text-teal-300" />
        </div>
        <p className="relative mt-2 text-xs font-bold leading-5 text-zinc-400">{impact.weekendCoverage}</p>
        <p className="relative mt-2 text-[10px] font-black uppercase tracking-[0.14em] text-teal-300">
          Sans dependance animateur
        </p>
      </div>
    </section>
  );
}

function RecommendationsPanel({
  recommendations,
  limit,
  dark = false,
}: {
  recommendations: Recommendation[];
  limit?: number;
  dark?: boolean;
}) {
  const [assigned, setAssigned] = useState<string[]>([]);
  const visible = typeof limit === 'number' ? recommendations.slice(0, limit) : recommendations;

  return (
    <section className={classNames('min-w-0 max-w-full rounded-3xl p-3 shadow-sm sm:p-5', dark ? 'border border-zinc-800 bg-zinc-950 text-white' : 'border border-zinc-200 bg-white')}>
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className={classNames('text-[11px] font-black uppercase tracking-[0.18em]', dark ? 'text-teal-300' : 'text-teal-700')}>
            Decisions suggerees
          </p>
          <h3 className={classNames('mt-1 text-xl font-black tracking-tight', dark ? 'text-white' : 'text-zinc-950')}>
            Que faire maintenant ?
          </h3>
        </div>
        <span className={classNames('w-fit shrink-0 rounded-full px-3 py-1.5 text-xs font-black ring-1', dark ? 'bg-white/5 text-zinc-300 ring-white/10' : 'bg-teal-50 text-teal-700 ring-teal-100')}>
          {recommendations.length} decisions
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {visible.map((recommendation, index) => {
          const isAssigned = assigned.includes(recommendation.id);

          return (
            <article
              key={recommendation.id}
              className={classNames(
                'group min-w-0 rounded-2xl p-3 ring-1 transition sm:p-4',
                dark ? 'bg-white/[0.04] ring-white/10 hover:bg-white/[0.07]' : 'bg-zinc-50 ring-zinc-200 hover:bg-white hover:shadow-md'
              )}
            >
              <div className="flex items-start gap-3">
                <span className={classNames(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-xl text-xs font-black',
                  recommendation.priority === 'Critique' ? 'bg-red-500 text-white' : 'bg-amber-400 text-zinc-950'
                )}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={classNames('text-sm font-black', dark ? 'text-white' : 'text-zinc-950')}>{recommendation.line}</p>
                    <span className={classNames(
                      'rounded-full px-2 py-0.5 text-[10px] font-black uppercase',
                      recommendation.priority === 'Critique' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    )}>
                      {recommendation.priority}
                    </span>
                    <span className={classNames('text-[10px] font-black uppercase tracking-[0.12em]', dark ? 'text-zinc-500' : 'text-zinc-400')}>
                      {recommendation.deadline}
                    </span>
                  </div>
                  <p className={classNames('mt-2 text-sm font-bold leading-6', dark ? 'text-zinc-300' : 'text-zinc-700')}>
                    {recommendation.decision}
                  </p>
                  <p className={classNames('mt-2 text-xs font-bold', dark ? 'text-teal-300' : 'text-teal-700')}>
                    Impact : {recommendation.impact}
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className={classNames('text-[10px] font-black uppercase tracking-[0.14em]', dark ? 'text-zinc-500' : 'text-zinc-400')}>
                      Responsable · {recommendation.owner}
                    </span>
                    <button
                      onClick={() => setAssigned((current) => isAssigned ? current.filter((id) => id !== recommendation.id) : [...current, recommendation.id])}
                      className={classNames(
                        'inline-flex h-9 w-full shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 text-xs font-black transition sm:w-auto',
                        isAssigned
                          ? 'bg-emerald-100 text-emerald-800'
                          : dark
                            ? 'bg-teal-400 text-zinc-950 hover:bg-teal-300'
                            : 'bg-zinc-950 text-white hover:bg-zinc-800'
                      )}
                    >
                      {isAssigned ? <CheckCircle2 size={13} /> : <ArrowRight size={13} />}
                      {isAssigned ? 'Assignee' : 'Assigner'}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EventCenter({ events, compact = false }: { events: EventStreamItem[]; compact?: boolean }) {
  const [pulseIndex, setPulseIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setPulseIndex((current) => (current + 1) % events.length);
    }, 3500);
    return () => window.clearInterval(interval);
  }, [events.length]);

  const orderedEvents = [...events.slice(pulseIndex), ...events.slice(0, pulseIndex)].reverse();
  const visibleEvents = compact ? orderedEvents.slice(0, 4) : orderedEvents;

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex min-w-0 flex-col gap-3 border-b border-zinc-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-black text-zinc-950">
            <Wifi size={15} className="text-teal-600" />
            Centre d'evenements
          </p>
          <p className="mt-1 text-xs font-bold text-zinc-500">Activite terrain consolidee en temps reel</p>
        </div>
        <span className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
          Live
        </span>
      </div>
      <div className="divide-y divide-zinc-100">
        {visibleEvents.map((event, index) => (
          <div key={`${event.time}-${event.line}`} className={classNames('grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] gap-2 px-4 py-3 transition-all sm:grid-cols-[3.25rem_minmax(0,1fr)] sm:gap-3 sm:px-5', index === 0 && 'animate-slide-in bg-teal-50/50')}>
            <span className="pt-0.5 text-xs font-black tabular-nums text-zinc-400">{index === 0 ? 'LIVE' : event.time}</span>
            <div className="min-w-0 border-l border-zinc-200 pl-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={classNames('h-2 w-2 rounded-full', statusConfig[event.severity].dot)} />
                <p className="text-sm font-black text-zinc-950">{event.line}</p>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-zinc-500">
                  {event.type}
                </span>
              </div>
              <p className="mt-1 text-xs font-bold leading-5 text-zinc-600">{event.event}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ViewToggle({ active, onChange }: { active: ViewMode; onChange: (mode: ViewMode) => void }) {
  const items: Array<{ id: ViewMode; label: string; icon: LucideIcon }> = [
    { id: 'driver', label: 'Conducteur', icon: UserRound },
    { id: 'supervisor', label: 'Superviseur', icon: RadioTower },
    { id: 'manager', label: 'Manager', icon: BarChart3 },
    { id: 'executive', label: 'Executive', icon: Building2 },
    { id: 'value', label: 'Valeur', icon: Sparkles },
  ];

  return (
    <div className="grid grid-cols-5 rounded-2xl bg-zinc-100 p-1 ring-1 ring-zinc-200">
      {items.map((item) => {
        const Icon = item.icon;
        const selected = active === item.id;

        return (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={classNames(
              'inline-flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 text-[11px] font-black transition',
              selected ? 'bg-zinc-950 text-white shadow-lg shadow-zinc-950/10' : 'text-zinc-500 hover:bg-white hover:text-zinc-950'
            )}
            title={item.label}
          >
            <Icon size={14} className="shrink-0" />
            <span className="hidden whitespace-nowrap 2xl:inline">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ChipGroup<T extends string>({
  value,
  options,
  onChange,
  tone = 'dark',
}: {
  value: T;
  options: T[];
  onChange: (value: T) => void;
  tone?: 'dark' | 'status';
}) {
  return (
    <div className="grid gap-2 min-[420px]:grid-cols-2">
      {options.map((option) => {
        const selected = value === option;

        return (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={classNames(
              'min-h-11 rounded-xl px-3 py-2 text-left text-sm font-black transition ring-1',
              selected
                ? tone === 'status'
                  ? 'bg-zinc-950 text-white ring-zinc-950 shadow-lg shadow-zinc-950/10'
                  : 'bg-teal-600 text-white ring-teal-600 shadow-lg shadow-teal-600/20'
                : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50 hover:text-zinc-950'
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function DriverPulse({ lines }: { lines: ProductionLine[] }) {
  const [selectedLineId, setSelectedLineId] = useState('L03');
  const selectedLine = lines.find((line) => line.id === selectedLineId) ?? lines[0];
  const [status, setStatus] = useState<LineStatus>(selectedLine.status);
  const [change, setChange] = useState(selectedLine.change);
  const [components, setComponents] = useState<ComponentState>(selectedLine.components);
  const [support, setSupport] = useState<SupportType>(selectedLine.support);
  const [hasRisk, setHasRisk] = useState(selectedLine.hasRisk);
  const [comment, setComment] = useState(selectedLine.comment);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const loadLine = (lineId: string) => {
    const line = lines.find((item) => item.id === lineId) ?? lines[0];
    setSelectedLineId(lineId);
    setStatus(line.status);
    setChange(line.change);
    setComponents(line.components);
    setSupport(line.support);
    setHasRisk(line.hasRisk);
    setComment(line.comment);
    setPublishedAt(null);
  };

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
        <div className="border-b border-zinc-100 bg-zinc-950 px-4 py-5 text-white sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-300">Pulse conducteur</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">Situation ligne en 30 secondes</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
                Un signal operationnel court, partageable et tracable pour completer le terrain.
              </p>
            </div>
            <StatusBadge status={status} />
          </div>
        </div>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Ligne</p>
              <select
                value={selectedLineId}
                onChange={(event) => loadLine(event.target.value)}
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-black text-zinc-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              >
                {lines.map((line) => (
                  <option key={line.id} value={line.id}>{line.name}</option>
                ))}
              </select>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Equipe</p>
              <p className="mt-3 text-lg font-black text-zinc-950">{selectedLine.team}</p>
              <p className="text-xs font-bold text-zinc-500">{selectedLine.zone}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400">Conducteur</p>
              <p className="mt-3 text-lg font-black text-zinc-950">{selectedLine.conductor}</p>
              <p className="text-xs font-bold text-zinc-500">{selectedLine.oc}</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-black text-zinc-950">Statut global</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['green', 'orange', 'red'] as LineStatus[]).map((item) => {
                const config = statusConfig[item];
                const Icon = config.icon;
                const selected = status === item;

                return (
                  <button
                    key={item}
                    onClick={() => setStatus(item)}
                    className={classNames(
                      'flex min-h-14 items-center gap-3 rounded-2xl px-4 text-left text-sm font-black transition ring-1',
                      selected ? 'bg-zinc-950 text-white ring-zinc-950 shadow-xl shadow-zinc-950/10' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    <span className={classNames('h-3 w-3 rounded-full', config.dot)} />
                    <Icon size={17} className={selected ? 'text-teal-300' : config.text} />
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-black text-zinc-950">Changement prevu aujourd'hui</p>
              <ChipGroup value={change} options={changeOptions} onChange={setChange} />
            </div>
            <div>
              <p className="mb-3 text-sm font-black text-zinc-950">Disponibilite AC / composants</p>
              <ChipGroup value={components} options={componentOptions} onChange={setComponents} tone="status" />
            </div>
            <div>
              <p className="mb-3 text-sm font-black text-zinc-950">Support necessaire</p>
              <ChipGroup value={support} options={supportOptions} onChange={setSupport} />
            </div>
            <div>
              <p className="mb-3 text-sm font-black text-zinc-950">Risque identifie pour la journee</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: true, label: 'Oui' },
                  { value: false, label: 'Non' },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => setHasRisk(item.value)}
                    className={classNames(
                      'h-11 rounded-xl text-sm font-black ring-1 transition',
                      hasRisk === item.value
                        ? 'bg-zinc-950 text-white ring-zinc-950 shadow-lg shadow-zinc-950/10'
                        : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                rows={4}
                placeholder="Commentaire court..."
                className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold leading-6 text-zinc-800 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10"
              />
            </div>
          </div>

          <button
            onClick={() => setPublishedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }))}
            className="group flex w-full items-center justify-center gap-3 rounded-2xl bg-teal-600 px-5 py-4 text-sm font-black text-white shadow-xl shadow-teal-600/20 transition hover:-translate-y-0.5 hover:bg-teal-500"
          >
            <RadioTower size={18} className="transition group-hover:scale-110" />
            Publier le statut
          </button>

          {publishedAt && (
            <div className="animate-slide-in rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800">
              Statut publie a {publishedAt}. Le cockpit superviseur est alimente.
            </div>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Apercu live</p>
          <div className="mt-4 rounded-2xl bg-zinc-950 p-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <p className="text-lg font-black">{selectedLine.name}</p>
              <StatusBadge status={status} compact />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 text-xs font-bold text-zinc-400">
              <span>Changement</span><span className="text-right text-white">{change}</span>
              <span>Composants</span><span className="text-right text-white">{components}</span>
              <span>Support</span><span className="text-right text-white">{support}</span>
              <span>Risque</span><span className="text-right text-white">{hasRisk ? 'Oui' : 'Non'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
          <p className="flex items-center gap-2 text-sm font-black text-indigo-950">
            <Zap size={16} />
            Intention produit
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-indigo-900">
            Le signal ne remplace pas la tournee terrain. Il la prepare, la priorise et conserve une trace exploitable.
          </p>
        </div>
      </aside>
    </section>
  );
}

function SupervisorTable({ lines }: { lines: ProductionLine[] }) {
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const filteredLines = useMemo(() => {
    if (activeFilters.length === 0) return lines;

    return lines.filter((line) => {
      return activeFilters.every((filter) => {
        if (filter === 'risks') return line.hasRisk || line.status !== 'green';
        if (filter === 'changes') return line.change !== 'Aucun';
        if (filter === 'technical') return line.support === 'Technique' || line.support === 'Maintenance';
        if (filter === 'quality') return line.support === 'Qualite';
        return true;
      });
    });
  }, [activeFilters, lines]);

  const toggleFilter = (id: string) => {
    setActiveFilters((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Centre de controle</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">Vision operationnelle des lignes</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {filterOptions.map((filter) => {
            const Icon = filter.icon;
            const active = activeFilters.includes(filter.id);

            return (
              <button
                key={filter.id}
                onClick={() => toggleFilter(filter.id)}
                className={classNames(
                  'inline-flex h-10 items-center gap-2 rounded-full px-3 text-xs font-black ring-1 transition',
                  active ? 'bg-zinc-950 text-teal-300 ring-zinc-950' : 'bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50'
                )}
              >
                <Icon size={14} />
                {filter.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
        <div className="hidden grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.7fr] gap-4 border-b border-zinc-100 bg-zinc-50 px-5 py-3 text-[11px] font-black uppercase tracking-[0.16em] text-zinc-400 lg:grid">
          <span>Ligne</span>
          <span>Statut</span>
          <span>Changement</span>
          <span>Support</span>
          <span className="text-right">Derniere MAJ</span>
        </div>

        <div className="divide-y divide-zinc-100">
          {filteredLines.map((line) => (
            <div
              key={line.id}
              className={classNames(
                'grid gap-3 px-4 py-4 transition hover:bg-zinc-50 lg:grid-cols-[1.1fr_0.9fr_0.9fr_0.9fr_0.7fr] lg:items-center lg:gap-4 lg:px-5',
                line.status === 'red' && 'bg-red-50/40',
                line.status === 'orange' && 'bg-amber-50/30'
              )}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className={classNames('h-3 w-3 shrink-0 rounded-full shadow-lg', statusConfig[line.status].dot)} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-zinc-950">{line.name}</p>
                    <p className="truncate text-xs font-bold text-zinc-500">{line.zone} · {line.conductor}</p>
                  </div>
                </div>
              </div>
              <StatusBadge status={line.status} compact />
              <div>
                <p className="text-sm font-black text-zinc-950">{line.change}</p>
                <p className="text-xs font-bold text-zinc-500">{line.oc}</p>
              </div>
              <div>
                <p className="text-sm font-black text-zinc-950">{line.support}</p>
                <p className={classNames('text-xs font-bold', line.components === 'Disponible' ? 'text-emerald-700' : 'text-amber-700')}>
                  {line.components}
                </p>
              </div>
              <div className="text-left lg:text-right">
                <p className="text-sm font-black tabular-nums text-zinc-950">{line.lastUpdate}</p>
                <p className="text-xs font-bold text-zinc-500">{line.nextMilestone}</p>
              </div>
              {(line.hasRisk || line.status !== 'green') && (
                <div className="rounded-2xl bg-white px-3 py-2 text-xs font-bold leading-5 text-zinc-600 ring-1 ring-zinc-200 lg:col-span-5">
                  {line.risk}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SupervisorPulse({
  lines,
  recommendations,
  events,
  impact,
}: {
  lines: ProductionLine[];
  recommendations: Recommendation[];
  events: EventStreamItem[];
  impact: OperationalImpact;
}) {
  const counts = statusCounts(lines);
  const actionLines = lines.filter(needsAction);
  const stability = stabilityIndex(lines);

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Lignes vertes"
          value={counts.green}
          detail="Production nominale ou situation maitrisee."
          icon={CheckCircle2}
          tone="bg-emerald-400/10 text-emerald-300 ring-emerald-400/20"
        />
        <MetricTile
          label="Vigilance"
          value={counts.orange}
          detail="Points a traiter avant impact production."
          icon={AlertTriangle}
          tone="bg-amber-400/10 text-amber-300 ring-amber-400/20"
        />
        <MetricTile
          label="Blocages"
          value={counts.red}
          detail="Lignes necessitant un arbitrage rapide."
          icon={BellRing}
          tone="bg-red-500/10 text-red-300 ring-red-400/20"
        />
        <MetricTile
          label="Stabilite"
          value={`${stability}%`}
          detail={`${actionLines.length} lignes avec signal d'attention.`}
          icon={Gauge}
          tone="bg-cyan-400/10 text-cyan-300 ring-cyan-400/20"
        />
      </section>

      <OperationalImpactStrip impact={impact} />

      <div className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <RecommendationsPanel recommendations={recommendations} limit={3} />
        <EventCenter events={events} compact />
      </div>

      <div className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <SupervisorTable lines={lines} />

        <aside className="space-y-4">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5 text-white shadow-2xl shadow-zinc-950/10">
            <p className="flex items-center gap-2 text-sm font-black">
              <Activity size={16} className="text-teal-300" />
              Priorite tournee
            </p>
            <div className="mt-4 space-y-3">
              {actionLines.slice(0, 5).map((line, index) => (
                <div key={line.id} className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-black">{index + 1}. {line.name}</p>
                    <span className={classNames('h-2.5 w-2.5 rounded-full', statusConfig[line.status].dot)} />
                  </div>
                  <p className="mt-2 text-xs font-bold leading-5 text-zinc-400">{line.risk}</p>
                  <p className="mt-2 text-[11px] font-black uppercase tracking-[0.14em] text-teal-300">{line.support}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-black text-zinc-950">
              <SlidersHorizontal size={16} />
              Lecture instantanee
            </p>
            <div className="mt-4 space-y-3">
              {[
                ['Changements prevus', lines.filter((line) => line.change !== 'Aucun').length],
                ['Supports demandes', lines.filter((line) => line.support !== 'Aucun').length],
                ['Risque composants', lines.filter((line) => line.components !== 'Disponible').length],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between rounded-2xl bg-zinc-50 px-3 py-3 ring-1 ring-zinc-200">
                  <span className="text-sm font-bold text-zinc-600">{label}</span>
                  <span className="text-lg font-black text-zinc-950">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MiniBarChart({ points }: { points: WeeklyPoint[] }) {
  const maxAlerts = Math.max(...points.map((point) => point.alerts));
  const maxSupports = Math.max(...points.map((point) => point.supports));

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-950" /> Stabilite</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> Alertes</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal-400" /> Supports</span>
      </div>
      <div className="flex h-40 items-end gap-3">
        {points.map((point) => (
          <div key={point.day} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
            <div className="flex h-full w-full items-end justify-center gap-1">
              <div
                className="w-2.5 rounded-t-lg bg-zinc-950 transition-all duration-700 sm:w-3"
                style={{ height: `${Math.max(18, point.value)}%` }}
                title={`Stabilite ${point.value}%`}
              />
              <div
                className="w-2.5 rounded-t-lg bg-amber-400 transition-all duration-700 sm:w-3"
                style={{ height: `${Math.max(10, (point.alerts / maxAlerts) * 82)}%` }}
                title={`${point.alerts} alertes`}
              />
              <div
                className="w-2.5 rounded-t-lg bg-teal-400 transition-all duration-700 sm:w-3"
                style={{ height: `${Math.max(10, (point.supports / maxSupports) * 72)}%` }}
                title={`${point.supports} demandes support`}
              />
            </div>
            <span className="text-xs font-black text-zinc-500">{point.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ManagerPhone({
  lines,
  recommendations,
  risk,
}: {
  lines: ProductionLine[];
  recommendations: Recommendation[];
  risk: string;
}) {
  const counts = statusCounts(lines);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Vue mobile manager</p>
          <p className="mt-1 text-sm font-black text-zinc-950">Situation comprise en moins de 5 secondes</p>
        </div>
        <Smartphone size={18} className="text-zinc-400" />
      </div>
      <div className="mx-auto max-w-[21rem] rounded-[2.4rem] border-[7px] border-zinc-950 bg-zinc-950 p-2 shadow-2xl shadow-zinc-950/25">
        <div className="overflow-hidden rounded-[1.8rem] bg-[#f5f7f8]">
          <div className="bg-zinc-950 px-4 pb-5 pt-3 text-white">
            <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-white/20" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-teal-300">LinePulse · 07:42</p>
                <p className="mt-1 text-lg font-black">Bonjour, direction site</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-400 text-zinc-950">
                <RadioTower size={17} />
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { label: 'OK', value: counts.green, tone: 'text-emerald-300' },
                { label: 'Vigilance', value: counts.orange, tone: 'text-amber-300' },
                { label: 'Blocages', value: counts.red, tone: 'text-red-300' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-white/[0.06] px-2 py-3 text-center ring-1 ring-white/10">
                  <p className={classNames('text-xl font-black', item.tone)}>{item.value}</p>
                  <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-zinc-500">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 p-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-700">Risque du jour</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="text-xl font-black text-amber-950">{risk}</p>
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-400">Top 3 priorites</p>
              <div className="mt-3 space-y-3">
                {recommendations.slice(0, 3).map((recommendation, index) => (
                  <div key={recommendation.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                    <span className={classNames(
                      'grid h-6 w-6 place-items-center rounded-lg text-[10px] font-black',
                      recommendation.priority === 'Critique' ? 'bg-red-500 text-white' : 'bg-amber-400 text-zinc-950'
                    )}>
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-zinc-950">{recommendation.line}</p>
                        <p className="text-[8px] font-black uppercase text-zinc-400">{recommendation.deadline}</p>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[10px] font-bold leading-4 text-zinc-600">{recommendation.decision}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 text-xs font-black text-white">
              Ouvrir les decisions
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ManagerPulse({
  lines,
  alertsHistory,
  weeklyStability,
  recommendations,
  events,
  impact,
}: {
  lines: ProductionLine[];
  alertsHistory: AlertHistoryItem[];
  weeklyStability: WeeklyPoint[];
  recommendations: Recommendation[];
  events: EventStreamItem[];
  impact: OperationalImpact;
}) {
  const counts = statusCounts(lines);
  const stability = stabilityIndex(lines);
  const actionLines = lines.filter(needsAction);
  const topRisks = actionLines.slice(0, 4);
  const supportDistribution = supportOptions
    .filter((support) => support !== 'Aucun')
    .map((support) => ({ support, count: lines.filter((line) => line.support === support).length }))
    .filter((item) => item.count > 0);

  return (
    <div className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="min-w-0 space-y-5">
        <OperationalImpactStrip impact={impact} />

        <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-white shadow-2xl shadow-zinc-950/10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-teal-300">Etat global du site</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight">Production sous controle, avec actions ciblees</h2>
              </div>
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/20">
                <Factory size={22} />
              </span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
                <p className="text-3xl font-black">{counts.green}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-300">OK</p>
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
                <p className="text-3xl font-black">{counts.orange}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-amber-300">Vigilance</p>
              </div>
              <div className="rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
                <p className="text-3xl font-black">{counts.red}</p>
                <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-red-300">Blocage</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-teal-100 bg-teal-50 p-6 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-black text-teal-950">
              <Gauge size={16} />
              Indice de stabilite
            </p>
            <div className="mt-6 grid place-items-center">
              <div className="grid h-36 w-36 place-items-center rounded-full bg-white shadow-inner ring-8 ring-teal-200">
                <span className="text-4xl font-black tracking-tight text-zinc-950">{stability}</span>
              </div>
            </div>
            <p className="mt-5 text-center text-sm font-bold leading-6 text-teal-900">
              Mesure synthetique basee sur blocages, vigilances, risques et supports demandes.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Evolution</p>
                <h3 className="text-xl font-black tracking-tight text-zinc-950">Stabilite sur la semaine</h3>
              </div>
              <LineChart size={18} className="text-zinc-400" />
            </div>
            <MiniBarChart points={weeklyStability} />
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="flex items-center gap-2 text-sm font-black text-zinc-950">
              <TrendingUp size={16} />
              Repartition des alertes
            </p>
            <div className="mt-5 space-y-4">
              {supportDistribution.map((item) => (
                <div key={item.support}>
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span className="text-zinc-600">{item.support}</span>
                    <span className="text-zinc-950">{item.count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full bg-teal-600" style={{ width: `${(item.count / lines.length) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Top risques du jour</p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-zinc-950">Lignes necessitant une attention immediate</h3>
            </div>
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-black text-red-700 ring-1 ring-red-100">
              {actionLines.length} actions
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {topRisks.map((line) => (
              <div key={line.id} className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-200">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-black text-zinc-950">{line.name}</p>
                  <StatusBadge status={line.status} compact />
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-zinc-600">{line.risk}</p>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-zinc-400">{line.nextMilestone}</p>
              </div>
            ))}
          </div>
        </div>

        <RecommendationsPanel recommendations={recommendations} />
      </section>

      <aside className="min-w-0 space-y-5">
        <ManagerPhone lines={lines} recommendations={recommendations} risk={impact.globalRisk} />

        <div className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-black text-red-950">
            <ArrowDownRight size={16} />
            Carte synthetique
          </p>
          <p className="mt-4 text-3xl font-black tracking-tight text-red-950">
            {actionLines.length} lignes necessitent une action
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-red-900">
            Les tournees terrain peuvent etre orientees vers les lignes a plus fort impact.
          </p>
        </div>

        <EventCenter events={events} compact />

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-black text-zinc-950">
            <History size={16} />
            Historique des alertes
          </p>
          <div className="mt-5 space-y-4">
            {alertsHistory.map((alert) => (
              <div key={`${alert.time}-${alert.line}`} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3">
                <span className="text-xs font-black tabular-nums text-zinc-400">{alert.time}</span>
                <div className="min-w-0 border-l border-zinc-200 pl-3">
                  <div className="flex items-center gap-2">
                    <span className={classNames('h-2 w-2 rounded-full', statusConfig[alert.severity].dot)} />
                    <p className="truncate text-sm font-black text-zinc-950">{alert.line}</p>
                  </div>
                  <p className="mt-1 text-xs font-bold leading-5 text-zinc-500">{alert.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-indigo-100 bg-indigo-50 p-5">
          <p className="flex items-center gap-2 text-sm font-black text-indigo-950">
            <ClipboardCheck size={16} />
            Decision
          </p>
          <p className="mt-3 text-sm font-bold leading-6 text-indigo-900">
            La plateforme donne une vision commune avant les arbitrages, y compris week-end et equipes reduites.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ExecutiveOverview({
  lines,
  recommendations,
  events,
  impact,
  executive,
}: {
  lines: ProductionLine[];
  recommendations: Recommendation[];
  events: EventStreamItem[];
  impact: OperationalImpact;
  executive: ExecutiveData;
}) {
  const majorRisks = lines.filter((line) => line.status === 'red' || line.status === 'orange').slice(0, 4);
  const metrics = [
    {
      label: 'Disponibilite operationnelle',
      value: `${executive.operationalAvailability}%`,
      detail: 'Capacite disponible sur le poste',
      icon: Gauge,
      tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
    },
    {
      label: 'Lignes sous surveillance',
      value: executive.linesUnderWatch,
      detail: 'Suivi renforce sans blocage',
      icon: MonitorCheck,
      tone: 'bg-amber-50 text-amber-700 ring-amber-100',
    },
    {
      label: 'Blocages critiques',
      value: executive.criticalBlocks,
      detail: 'Arbitrage requis maintenant',
      icon: BellRing,
      tone: 'bg-red-50 text-red-700 ring-red-100',
    },
    {
      label: 'Decisions aujourd hui',
      value: executive.decisionsToday,
      detail: 'Decisions a impact production',
      icon: Target,
      tone: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    },
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/15">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-teal-300 ring-1 ring-teal-400/20">
                <span className="h-2 w-2 animate-pulse rounded-full bg-teal-300" />
                Executive live brief
              </span>
            </div>
            <p className="mt-5 text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">Etat du site en moins de 10 secondes</p>
            <h2 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
              Le site reste operationnel. Deux blocages exigent une decision avant 08:00.
            </h2>
            <p className="mt-4 max-w-3xl text-sm font-bold leading-7 text-zinc-400">
              Les risques sont localises, les responsables sont identifies et les actions recommandees sont deja priorisees.
            </p>
          </div>
          <div className="border-t border-white/10 bg-white/[0.03] p-6 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Decision prioritaire</p>
            <p className="mt-3 text-xl font-black">Securiser Ligne 8 avant la rupture composants.</p>
            <div className="mt-5 rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-400/20">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-red-300">Fenetre de decision</p>
              <p className="mt-1 text-3xl font-black">18 min</p>
              <p className="mt-2 text-xs font-bold text-zinc-400">Avant escalation en arret de production.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricTile key={metric.label} {...metric} />
        ))}
      </section>

      <OperationalImpactStrip impact={impact} />

      <div className="grid min-w-0 max-w-full gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
        <RecommendationsPanel recommendations={recommendations} limit={3} dark />
        <div className="space-y-5">
          <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Risques majeurs</p>
                <h3 className="mt-1 text-xl font-black tracking-tight text-zinc-950">Surveillance direction</h3>
              </div>
              <AlertTriangle size={18} className="text-amber-500" />
            </div>
            <div className="mt-5 space-y-3">
              {majorRisks.map((line) => (
                <div key={line.id} className="flex items-start gap-3 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-200">
                  <span className={classNames('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', statusConfig[line.status].dot)} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-zinc-950">{line.name}</p>
                      <span className="text-[10px] font-black uppercase text-zinc-400">{line.support}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold leading-5 text-zinc-600">{line.risk}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <EventCenter events={events} compact />
        </div>
      </div>
    </div>
  );
}

function WhyLinePulse({ impact }: { impact: OperationalImpact }) {
  const before = [
    'Animateur et technicien parcourent toutes les lignes.',
    'Informations principalement orales et dispersees.',
    'Priorites identifiees tardivement ou selon les personnes presentes.',
    'Visibilite variable le week-end et en equipe reduite.',
    'Peu de donnees exploitables pour comprendre les tendances.',
  ];
  const after = [
    'Information instantanee, structuree et partagee.',
    'Tournees orientees vers les lignes qui en ont reellement besoin.',
    'Decisions suggerees avec echeance, responsable et impact.',
    'Meme niveau de visibilite semaine et week-end.',
    'Historique transformant les signaux terrain en connaissance.',
  ];

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-4xl">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-teal-700">Pourquoi LinePulse ?</p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">
            Conserver le terrain. Eliminer les angles morts.
          </h2>
          <p className="mt-4 text-sm font-bold leading-7 text-zinc-600 sm:text-base">
            LinePulse ne remplace ni l'animateur, ni le technicien, ni les echanges en ligne. Il donne a chacun la meme lecture
            de la situation avant d'agir, puis conserve la trace de ce qui a ete compris et decide.
          </p>
        </div>
      </section>

      <section className="grid overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/50 lg:grid-cols-2">
        <div className="border-b border-zinc-200 bg-zinc-100 p-6 lg:border-b-0 lg:border-r sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">Avant</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight text-zinc-950">Une information qui circule</h3>
            </div>
            <Route size={22} className="text-zinc-400" />
          </div>
          <div className="mt-6 space-y-4">
            {before.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-zinc-200 text-zinc-500">
                  <ArrowRight size={13} />
                </span>
                <p className="text-sm font-bold leading-6 text-zinc-600">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-950 p-6 text-white sm:p-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-teal-300">Avec LinePulse</p>
              <h3 className="mt-1 text-2xl font-black tracking-tight">Une information qui fait agir</h3>
            </div>
            <Zap size={22} className="text-teal-300" />
          </div>
          <div className="mt-6 space-y-4">
            {after.map((item) => (
              <div key={item} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-teal-400 text-zinc-950">
                  <CheckCircle2 size={13} />
                </span>
                <p className="text-sm font-bold leading-6 text-zinc-300">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <OperationalImpactStrip impact={impact} />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: 'Comprendre',
            title: 'Une situation lisible immediatement',
            detail: 'Chaque profil voit uniquement les signaux utiles a sa decision.',
            icon: MonitorCheck,
          },
          {
            label: 'Decider',
            title: 'Une action proposee avant impact',
            detail: 'La recommandation precise qui agit, avant quand et pour quel gain.',
            icon: Target,
          },
          {
            label: 'Apprendre',
            title: 'Une connaissance qui reste',
            detail: 'Les tendances rendent enfin les informations terrain exploitables.',
            icon: TrendingUp,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-700 ring-1 ring-teal-100">
                <Icon size={19} />
              </span>
              <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-teal-700">{item.label}</p>
              <h3 className="mt-1 text-lg font-black text-zinc-950">{item.title}</h3>
              <p className="mt-2 text-sm font-bold leading-6 text-zinc-500">{item.detail}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function LinePulsePage() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState<ViewMode>('supervisor');
  const lines = DATA.lines;
  const counts = statusCounts(lines);
  const stability = stabilityIndex(lines);
  const narratives: Record<ViewMode, { eyebrow: string; title: string; detail: string }> = {
    driver: {
      eyebrow: 'Signal terrain',
      title: 'Publier une situation claire avant que le besoin ne devienne une urgence.',
      detail: "Le conducteur partage l'essentiel en moins de 30 secondes. Le terrain reste la source, toute l'organisation gagne en anticipation.",
    },
    supervisor: {
      eyebrow: 'Decision operationnelle',
      title: 'Voir ou agir maintenant, avant que les signaux faibles ne deviennent des arrets.',
      detail: 'Les remontees terrain deviennent des priorites, des recommandations et des tournees ciblees.',
    },
    manager: {
      eyebrow: 'Pilotage du poste',
      title: 'Comprendre la situation du site en quelques secondes, sur ordinateur comme sur mobile.',
      detail: 'Le manager voit les risques, les decisions attendues et leur impact sans parcourir plusieurs sources.',
    },
    executive: {
      eyebrow: 'Executive overview',
      title: 'Lier la disponibilite du site aux decisions qui protegent la production.',
      detail: "Une lecture synthetique pour arbitrer rapidement les risques majeurs et suivre la continuite operationnelle.",
    },
    value: {
      eyebrow: 'Valeur operationnelle',
      title: 'Conserver les tournees terrain, tout en eliminant les angles morts entre deux passages.',
      detail: "LinePulse transforme une information orale et ponctuelle en visibilite continue, partagee et exploitable.",
    },
  };
  const narrative = narratives[activeView];

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-clip bg-[#f4f6f8] text-zinc-950">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto grid min-h-16 max-w-[1540px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex h-10 items-center gap-2 rounded-full px-2 text-sm font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 sm:px-3"
          >
            <ChevronLeft size={17} />
            <span className="hidden sm:inline">Retour</span>
          </button>

          <div className="min-w-0">
            <div className="flex min-w-0 items-center justify-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-zinc-950 text-teal-300 shadow-lg shadow-zinc-950/10">
                <RadioTower size={19} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-black tracking-tight text-zinc-950">LinePulse</p>
                <p className="hidden truncate text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400 sm:block">
                  Operational visibility platform
                </p>
              </div>
            </div>
          </div>

          <Link
            to="/shiftguide/modules"
            className="inline-flex h-10 items-center justify-center rounded-full bg-zinc-100 px-3 text-xs font-black text-zinc-700 transition hover:bg-zinc-200"
          >
            ShiftGuide
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full min-w-0 max-w-[1540px] px-3 py-5 sm:px-6 lg:px-8">
        <section className="min-w-0 max-w-full overflow-hidden rounded-[1.75rem] border border-zinc-800 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/10">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_34rem]">
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-teal-400/10 px-3 py-1.5 text-xs font-black text-teal-300 ring-1 ring-teal-400/20">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-teal-300" />
                  Temps reel · {DATA.snapshotTime}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-black text-zinc-300 ring-1 ring-white/10">
                  {DATA.site}
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-black text-zinc-300 ring-1 ring-white/10">
                  Poste {DATA.shift}
                </span>
              </div>
              <p className="mt-5 text-[11px] font-black uppercase tracking-[0.22em] text-teal-300">{narrative.eyebrow}</p>
              <h1 className="mt-2 max-w-4xl text-3xl font-black tracking-tight sm:text-5xl">
                {narrative.title}
              </h1>
              <p className="mt-4 max-w-3xl text-sm font-semibold leading-7 text-zinc-400 sm:text-base">
                {narrative.detail}
              </p>
            </div>
            <div className="border-t border-white/10 bg-white/[0.03] p-5 sm:p-7 xl:border-l xl:border-t-0">
              <ViewToggle active={activeView} onChange={setActiveView} />
              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { label: 'OK', value: counts.green, tone: 'text-emerald-300' },
                  { label: 'Vigilance', value: counts.orange, tone: 'text-amber-300' },
                  { label: 'Blocage', value: counts.red, tone: 'text-red-300' },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl bg-white/[0.05] p-3 ring-1 ring-white/10">
                    <p className={classNames('text-2xl font-black', item.tone)}>{item.value}</p>
                    <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500">{item.label}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-white/[0.05] p-4 ring-1 ring-white/10">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-zinc-400">Stabilite site</span>
                  <span className="text-xl font-black text-white">{stability}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-teal-300" style={{ width: `${stability}%` }} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-6 min-w-0 max-w-full">
          {activeView === 'driver' && <DriverPulse lines={lines} />}
          {activeView === 'supervisor' && (
            <SupervisorPulse
              lines={lines}
              recommendations={DATA.recommendations}
              events={DATA.eventStream}
              impact={DATA.operationalImpact}
            />
          )}
          {activeView === 'manager' && (
            <ManagerPulse
              lines={lines}
              alertsHistory={DATA.alertsHistory}
              weeklyStability={DATA.weeklyStability}
              recommendations={DATA.recommendations}
              events={DATA.eventStream}
              impact={DATA.operationalImpact}
            />
          )}
          {activeView === 'executive' && (
            <ExecutiveOverview
              lines={lines}
              recommendations={DATA.recommendations}
              events={DATA.eventStream}
              impact={DATA.operationalImpact}
              executive={DATA.executive}
            />
          )}
          {activeView === 'value' && <WhyLinePulse impact={DATA.operationalImpact} />}
        </div>
      </main>
    </div>
  );
}
