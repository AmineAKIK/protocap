import {
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Clock3,
  Factory,
  Flag,
  Gauge,
  GitBranch,
  Grid2x2,
  HelpCircle,
  ListChecks,
  Mic,
  MicOff,
  PlayCircle,
  RadioTower,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildSystemPrompt } from '../../data/celineSystemPrompt';

// ─── Speech Recognition ───────────────────────────────────────────────────────

interface ISpeechRecognitionEvent {
  results: { [i: number]: { [j: number]: { transcript: string } } };
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((e: ISpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionCtor = new () => ISpeechRecognition;

const w = window as unknown as Record<string, unknown>;
const SpeechRecognitionAPI = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as SpeechRecognitionCtor | undefined;

function useSpeechInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<ISpeechRecognition | null>(null);

  const toggle = () => {
    if (!SpeechRecognitionAPI) return;

    if (listening) {
      recRef.current?.stop();
      return;
    }

    const rec = new SpeechRecognitionAPI();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e: ISpeechRecognitionEvent) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);

    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return { listening, toggle, supported: !!SpeechRecognitionAPI };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  text: string;
  note: string | null;
  module: string | null;
  done: boolean;
  na: boolean;
}

interface CelineMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  checklist: ChecklistItem[];
  followUp: string | null;
  loading?: boolean;
}

interface ApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ─── API ──────────────────────────────────────────────────────────────────────

function toApiHistory(msgs: CelineMessage[]): ApiMessage[] {
  return msgs
    .filter((m) => !m.loading)
    .map((m) => ({
      role: m.role,
      content:
        m.role === 'assistant'
          ? JSON.stringify({ message: m.content, checklist: m.checklist, followUp: m.followUp })
          : m.content,
    }));
}

async function callCelineApi(
  history: ApiMessage[],
  signal: AbortSignal
): Promise<{ message: string; checklist: ChecklistItem[]; followUp: string | null }> {
  const res = await fetch('/api/shiftguide/chat', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...history],
    }),
    signal,
  });

  if (!res.ok) {
    let errMsg = `Erreur ${res.status}`;
    try { const b = await res.json(); errMsg = b.error?.message ?? errMsg; } catch { /* ignore */ }
    if (res.status === 401) throw new Error('La session ShiftGuide a expiré. Recharge la page pour te reconnecter.');
    if (res.status === 429) throw new Error('Quota API dépassé. Réessaie dans un moment.');
    throw new Error(errMsg);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(raw);
    const checklist: ChecklistItem[] = (parsed.checklist ?? []).map(
      (item: Record<string, unknown>, i: number) => ({
        id: `${Date.now()}_${i}`,
        text: String(item.text ?? ''),
        note: item.note ? String(item.note) : null,
        module: item.module ? String(item.module) : null,
        done: false,
        na: false,
      })
    );
    return {
      message: String(parsed.message ?? ''),
      checklist,
      followUp: parsed.followUp ? String(parsed.followUp) : null,
    };
  } catch {
    return { message: raw, checklist: [], followUp: null };
  }
}

// ─── Storage ──────────────────────────────────────────────────────────────────

const STORAGE_KEY_HISTORY = 'shiftguide_celine_history';
const PROMPT_VERSION = 'v10';

function isValidMessage(m: unknown): m is CelineMessage {
  if (!m || typeof m !== 'object') return false;
  const msg = m as Record<string, unknown>;
  return (
    typeof msg.id === 'string' &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string' &&
    Array.isArray(msg.checklist) &&
    (msg.followUp === null || typeof msg.followUp === 'string')
  );
}

function normalizeMessage(m: CelineMessage): CelineMessage {
  return {
    ...m,
    checklist: m.checklist.map((item) => ({
      ...item,
      na: item.na ?? false,
    })),
  };
}

function loadHistory(): CelineMessage[] {
  try {
    if (localStorage.getItem('shiftguide_prompt_version') !== PROMPT_VERSION) {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      localStorage.setItem('shiftguide_prompt_version', PROMPT_VERSION);
      return [];
    }
    const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMessage).map(normalizeMessage);
  } catch {
    return [];
  }
}

// ─── WelcomeScreen ────────────────────────────────────────────────────────────

const SUGGESTIONS: Array<{ icon: LucideIcon; text: string; tone: string }> = [
  { icon: Clock3, text: 'Je commence mon poste', tone: 'bg-teal-50 text-teal-700 ring-teal-100' },
  { icon: PlayCircle, text: 'Je lance un OC', tone: 'bg-blue-50 text-blue-700 ring-blue-100' },
  { icon: GitBranch, text: "J'ai un changement d'OC de formule", tone: 'bg-violet-50 text-violet-700 ring-violet-100' },
  { icon: Waves, text: 'Il y a une nouvelle cuve', tone: 'bg-cyan-50 text-cyan-700 ring-cyan-100' },
  { icon: Flag, text: 'Je finis mon poste', tone: 'bg-slate-100 text-slate-700 ring-slate-200' },
  { icon: HelpCircle, text: "C'est quoi SPCB ?", tone: 'bg-amber-50 text-amber-700 ring-amber-100' },
];

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/10">
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-500 text-zinc-950">
              <Bot size={22} />
            </span>
            <div>
              <p className="text-xl font-black">Céline</p>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-300">
                Assistant command
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-300">
            Décris le moment terrain. Céline répond en actions, modules associés et relance
            automatiquement quand la checklist est traitée.
          </p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-white/10 bg-white/[0.03] px-5 py-4">
          {[
            ['Guidage', 'temps réel'],
            ['Actions', 'cochables'],
            ['Mémoire', 'locale'],
          ].map(([label, value]) => (
            <div key={label} className="px-3 first:pl-0 last:pr-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">{label}</p>
              <p className="mt-1 text-sm font-black text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            Situations fréquentes
          </p>
          <p className="mt-1 text-sm font-bold text-zinc-500">
            Démarrer plus vite sans taper.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => {
          const Icon = suggestion.icon;

          return (
          <button
            key={suggestion.text}
            onClick={() => onSuggest(suggestion.text)}
            className="group flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md active:scale-[0.99]"
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ring-1 ${suggestion.tone}`}>
              <Icon size={17} />
            </span>
            <span className="min-w-0 text-sm font-black text-zinc-800 transition group-hover:text-teal-700">
              {suggestion.text}
            </span>
          </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-6 backdrop-blur-sm">
      <div className="w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="px-5 py-5">
          <p className="text-sm font-bold text-slate-950">Quitter Céline ?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Tu veux vraiment quitter ? L'historique reste sauvegardé, tu pourras reprendre.
          </p>
        </div>
        <div className="flex border-t border-slate-100 bg-slate-50">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-semibold text-slate-600 transition hover:bg-white hover:text-slate-950"
          >
            Annuler
          </button>
          <div className="w-px bg-slate-100" />
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
          >
            Quitter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function Checklist({
  items,
  msgId,
  onAction,
}: {
  items: ChecklistItem[];
  msgId: string;
  onAction: (msgId: string, itemId: string, action: 'done' | 'na') => void;
}) {
  const treated = items.filter((i) => i.done || i.na).length;
  const total = items.length;
  const pct = total > 0 ? (treated / total) * 100 : 0;
  const complete = treated === total && total > 0;

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="text-xs font-bold text-slate-500">{treated} / {total} actions</span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-emerald-500' : 'bg-teal-700'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {items.map((item) => {
          const treated = item.done || item.na;
          return (
            <div
              key={item.id}
              className={`flex w-full items-start gap-3 px-4 py-3 transition ${treated ? 'opacity-60' : ''}`}
            >
              {/* Done button */}
              <button
                onClick={() => onAction(msgId, item.id, 'done')}
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
                  item.done
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 text-transparent hover:border-emerald-600'
                }`}
              >
                <Check size={13} />
              </button>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className={`break-words text-sm leading-6 transition-colors ${item.done ? 'text-slate-400 line-through' : item.na ? 'text-slate-400' : 'text-slate-800'}`}>
                  {item.text}
                </p>
                {item.note && (
                  <p className="mt-0.5 break-words text-xs leading-5 text-slate-500">{item.note}</p>
                )}
                {item.module && (
                  <span className="mt-1.5 inline-block rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-700 ring-1 ring-teal-100">
                    {item.module}
                  </span>
                )}
              </div>

              {/* N/A button */}
              <button
                onClick={() => onAction(msgId, item.id, 'na')}
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold transition-all active:scale-95 ${
                  item.na
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                N/A
              </button>
            </div>
          );
        })}
      </div>

      {complete && (
        <div className="flex items-center justify-center gap-2 border-t border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-700">
          <span>Tout est traité</span>
          <Sparkles size={13} />
          <span>Céline prépare la suite…</span>
        </div>
      )}
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onAction,
}: {
  msg: CelineMessage;
  onAction: (msgId: string, itemId: string, action: 'done' | 'na') => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <span className="inline-flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-widest text-teal-700">
          <Bot size={12} />
          Céline
        </span>
      )}

      <div
        className={`max-w-[88%] overflow-hidden rounded-xl ${
          isUser
            ? 'rounded-tr-sm bg-teal-700 text-white shadow-sm'
            : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 shadow-sm'
        }`}
      >
        <div className="px-4 py-3">
          {msg.loading ? (
            <div className="flex items-center gap-2.5">
              <span className="text-sm text-slate-500">Céline réfléchit</span>
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-600"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <p className="break-words text-sm leading-relaxed whitespace-pre-line">{msg.content}</p>
          )}
        </div>
      </div>

      {!msg.loading && msg.checklist.length > 0 && (
        <div className="w-full max-w-[92%]">
          <Checklist items={msg.checklist} msgId={msg.id} onAction={onAction} />
        </div>
      )}

      {!msg.loading && msg.followUp && msg.checklist.length === 0 && (
        <div className="max-w-[88%] rounded-xl border border-teal-100 bg-teal-50 px-3 py-2">
          <p className="break-words text-xs font-semibold text-teal-800">{msg.followUp}</p>
        </div>
      )}
    </div>
  );
}

// ─── CelinePage ───────────────────────────────────────────────────────────────

export function CelinePage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CelineMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef<Set<string>>(new Set());
  const sendMessageRef = useRef<(text: string) => void>(() => {});

  const { listening, toggle: toggleMic, supported: micSupported } = useSpeechInput((transcript) => {
    sendMessageRef.current(transcript);
  });

  const messageCount = messages.length;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount]);

  // Intercept browser back gesture / OS back button when conversation is active
  const hasMessages = messages.length > 0;
  useEffect(() => {
    if (!hasMessages) return;
    window.history.pushState(null, '', window.location.href);
    const onPop = () => {
      window.history.pushState(null, '', window.location.href);
      setConfirmExit(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [hasMessages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages.filter((m) => !m.loading)));
  }, [messages]);

  // Auto-continue: when the last assistant checklist is fully treated, send next prompt
  useEffect(() => {
    if (loading || pendingRef.current) return;

    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && !m.loading && m.checklist.length > 0);

    if (!lastAssistant) return;
    if (autoSentRef.current.has(lastAssistant.id)) return;

    const allTreated = lastAssistant.checklist.every((item) => item.done || item.na);
    if (!allTreated) return;

    autoSentRef.current.add(lastAssistant.id);
    const text = 'C\'est fait.';

    const timer = setTimeout(() => {
      sendMessageRef.current(text);
    }, 700);

    return () => clearTimeout(timer);
  }, [messages, loading]);

  const clearSession = () => {
    abortRef.current?.abort();
    pendingRef.current = false;
    autoSentRef.current.clear();
    setMessages([]);
    setLoading(false);
    setError(null);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  };

  const handleItemAction = (msgId: string, itemId: string, action: 'done' | 'na') => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          checklist: m.checklist.map((item) => {
            if (item.id !== itemId) return item;
            if (action === 'done') return { ...item, done: !item.done, na: false };
            return { ...item, na: !item.na, done: false };
          }),
        };
      })
    );
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;
    const currentMessages = messages;

    const userMsg: CelineMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
      checklist: [],
      followUp: null,
    };
    const placeholder: CelineMessage = {
      id: `loading_${Date.now()}`,
      role: 'assistant',
      content: '',
      checklist: [],
      followUp: null,
      loading: true,
    };

    pendingRef.current = true;
    abortRef.current = new AbortController();

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput('');
    setError(null);
    setLoading(true);
    inputRef.current?.focus();

    try {
      const result = await callCelineApi(
        toApiHistory([...currentMessages, userMsg]),
        abortRef.current.signal
      );
      setMessages((prev) => [
        ...prev.filter((m) => !m.loading),
        {
          id: `celine_${Date.now()}`,
          role: 'assistant',
          content: result.message,
          checklist: result.checklist,
          followUp: result.followUp,
        },
      ]);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setMessages((prev) => prev.filter((m) => !m.loading));
    } finally {
      pendingRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // Keep ref in sync with latest sendMessage on every render
  sendMessageRef.current = sendMessage;

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f3f5f7] text-zinc-950">
      {confirmExit && (
        <ConfirmModal
          onConfirm={() => { setConfirmExit(false); navigate('/'); }}
          onCancel={() => setConfirmExit(false)}
        />
      )}

      <header className="sticky top-0 z-30 flex-none border-b border-zinc-200 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto grid h-14 w-full max-w-[1500px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 sm:h-16 sm:px-6 lg:px-8">
          <button
            onClick={() => messages.length === 0 ? navigate('/') : setConfirmExit(true)}
            className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm font-bold text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 sm:gap-2 sm:px-3"
          >
            <ChevronLeft size={18} />
            <span className="hidden min-[380px]:inline">Toolkit</span>
          </button>

          <div className="flex min-w-0 items-center justify-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-950 text-teal-300 shadow-lg shadow-zinc-950/10 sm:h-10 sm:w-10">
              <Bot size={17} />
            </span>
            <span className="truncate text-sm font-black text-zinc-950">Céline</span>
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-black text-teal-700 ring-1 ring-teal-100">
              IA
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/shiftguide/linepulse"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-xs font-black text-teal-300 transition hover:bg-zinc-800 sm:w-auto sm:gap-2 sm:px-3"
              aria-label="LinePulse"
            >
              <RadioTower size={13} />
              <span className="hidden sm:inline">Pulse</span>
            </Link>
            <Link
              to="/shiftguide/modules"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-xs font-black text-zinc-700 transition hover:bg-zinc-200 sm:w-auto sm:gap-2 sm:px-3"
              aria-label="Modules"
            >
              <Grid2x2 size={13} />
              <span className="hidden sm:inline">Modules</span>
            </Link>
            <Link
              to="/shiftguide/urgences"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-xs font-black text-red-700 ring-1 ring-red-100 transition hover:bg-red-100 sm:w-auto sm:gap-2 sm:px-3"
              aria-label="Urgences"
            >
              <AlertTriangle size={13} />
              <span className="hidden sm:inline">Urgences</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto grid min-h-full w-full max-w-[1500px] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_18rem] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/10">
              <div className="border-b border-white/10 px-4 py-4">
                <p className="flex items-center gap-2 text-sm font-black">
                  <ListChecks size={16} className="text-teal-300" />
                  LineOps cockpit
                </p>
                <p className="mt-2 text-xs leading-5 text-zinc-400">
                  L’assistant est le point d’entrée, les modules restent le référentiel.
                </p>
              </div>
              <div className="divide-y divide-white/10">
                {[
                  { to: '/shiftguide/linepulse', icon: RadioTower, label: 'LinePulse temps reel' },
                  { to: '/shiftguide/remplissage', icon: Gauge, label: 'Réglage remplissage Gold' },
                  { to: '/shiftguide/modules', icon: ClipboardCheck, label: 'Modules terrain' },
                  { to: '/shiftguide/modules', icon: Factory, label: 'Contexte ligne' },
                  { to: '/shiftguide/urgences', icon: AlertTriangle, label: 'Urgences' },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      className="flex items-center gap-3 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/10 text-teal-200 ring-1 ring-white/10">
                        <Icon size={16} />
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          <section className="min-w-0 space-y-4">
            {messages.length === 0 ? (
              <WelcomeScreen onSuggest={sendMessage} />
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} onAction={handleItemAction} />
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-700" />
                <p className="break-words text-sm font-semibold text-red-700">{error}</p>
              </div>
            )}

            <div ref={bottomRef} />
          </section>

          <aside className="hidden space-y-4 lg:block">
            <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-400">
                État session
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-zinc-100 px-3 py-3">
                  <p className="text-2xl font-black">{messages.length}</p>
                  <p className="text-[11px] font-black uppercase text-zinc-500">messages</p>
                </div>
                <div className="rounded-xl bg-teal-50 px-3 py-3 text-teal-800 ring-1 ring-teal-100">
                  <p className="text-2xl font-black">{loading ? 'ON' : 'OK'}</p>
                  <p className="text-[11px] font-black uppercase">moteur</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">
                Règle produit
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-amber-950">
                Céline guide, l’opérateur décide. Les actions validées restent explicites.
              </p>
            </div>
          </aside>
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex-none border-t border-zinc-200 bg-white/95 px-4 py-2">
          <div className="mx-auto flex max-w-[1500px] items-center gap-2">
          <button
            onClick={clearSession}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800"
            title="Effacer"
          >
            <Trash2 size={11} />
          </button>
          <button
            onClick={clearSession}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-black text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-800"
          >
            <RotateCcw size={11} />
            <span>Nouveau poste</span>
          </button>
          </div>
        </div>
      )}

      <div className="flex-none border-t border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-[1500px] items-center gap-2">
          <div className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(input); }}
              placeholder={listening ? 'Écoute en cours…' : 'Décris ta situation…'}
              className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
              autoComplete="off"
            />
          </div>
          {micSupported && (
            <button
              onClick={toggleMic}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition active:scale-95 ${
                listening
                  ? 'animate-pulse bg-red-600 text-white'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-800'
              }`}
            >
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-zinc-950 transition hover:bg-teal-500 active:scale-95 disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
