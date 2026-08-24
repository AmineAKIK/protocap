import {
  AlertTriangle,
  Bot,
  Check,
  ChevronLeft,
  Factory,
  Flag,
  GitBranch,
  HelpCircle,
  Mic,
  MicOff,
  PlayCircle,
  RotateCcw,
  Send,
  Sparkles,
  Waves,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  SharedCelinePresentation,
  SharedCelineWorkflow,
} from '../../../shared/celineContract.js';
import { AccessibleDialog } from '../../components/AccessibleDialog';
import { getSgModules } from '../../data/shiftguideModules';
import { requestCelineResponse } from '../../features/shiftguide/celineClient';
import { getShiftGuidePersistentStorage } from '../../features/shiftguide/shiftGuideStorage';
import { setSharedActionStatus } from '../../hooks/useModuleProgress';

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

const browser = window as unknown as Record<string, unknown>;
const SpeechRecognitionAPI = (
  browser.SpeechRecognition ?? browser.webkitSpeechRecognition
) as SpeechRecognitionCtor | undefined;
const storage = getShiftGuidePersistentStorage();
const STORAGE_KEY_HISTORY = 'shiftguide_celine_history';

function useSpeechInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => () => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = null;
    rec.onend = null;
    rec.onerror = null;
    rec.stop();
    recRef.current = null;
  }, []);

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
    rec.onresult = (event) => onResult(event.results[0][0].transcript);
    rec.onend = () => {
      if (recRef.current === rec) recRef.current = null;
      setListening(false);
    };
    rec.onerror = rec.onend;
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return { listening, toggle, supported: !!SpeechRecognitionAPI };
}

interface ChecklistItem {
  id: string;
  actionId: string;
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
  presentation?: SharedCelinePresentation;
  workflow?: SharedCelineWorkflow;
  loading?: boolean;
}

function findProgressScope(actionId: string): string | undefined {
  for (const module of getSgModules()) {
    if (module.type === 'standard' && module.actions.some((action) => action.id === actionId)) {
      return module.id;
    }
    if (module.type === 'choice') {
      const subModule = module.subModules.find((sub) =>
        sub.actions.some((action) => action.id === actionId)
      );
      if (subModule) return subModule.id;
    }
  }
  return undefined;
}

async function requestCelineGuidance(userMessage: string, signal: AbortSignal) {
  const response = await requestCelineResponse(userMessage, signal);
  const createdAt = Date.now();
  return {
    message: response.message,
    checklist: response.checklist.map((item, index): ChecklistItem => ({
      ...item,
      id: `${item.actionId}_${createdAt}_${index}`,
      done: false,
      na: false,
    })),
    followUp: response.followUp,
    presentation: response.presentation,
    workflow: response.workflow,
  };
}

function isValidMessage(value: unknown): value is CelineMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Record<string, unknown>;
  return (
    typeof message.id === 'string' &&
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'string' &&
    Array.isArray(message.checklist) &&
    (message.followUp === null || typeof message.followUp === 'string')
  );
}

function loadHistory(): CelineMessage[] {
  try {
    const raw = storage.getItem(STORAGE_KEY_HISTORY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isValidMessage) : [];
  } catch {
    return [];
  }
}

const SUGGESTIONS: Array<{ icon: LucideIcon; text: string }> = [
  { icon: PlayCircle, text: 'Je lance un OC' },
  { icon: Factory, text: 'Je suis en production' },
  { icon: Waves, text: 'Il y a une nouvelle cuve' },
  { icon: GitBranch, text: "J'ai un changement d'OC de formule" },
  { icon: Flag, text: 'Je finis mon poste' },
  { icon: HelpCircle, text: "C'est quoi SPCB ?" },
];

function ConfirmExit({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AccessibleDialog
      title="Quitter Céline ?"
      description="La conversation reste disponible pendant la session ShiftGuide."
      onClose={onCancel}
      hideCloseButton
      initialFocusRef={cancelRef}
      className="max-w-sm"
      contentClassName="p-0"
    >
      <div className="flex border-t border-slate-100 bg-slate-50">
        <button ref={cancelRef} type="button" onClick={onCancel} className="flex-1 py-3.5 text-sm font-semibold text-slate-600 hover:bg-white">
          Rester
        </button>
        <button type="button" onClick={onConfirm} className="flex-1 py-3.5 text-sm font-semibold text-teal-800 hover:bg-teal-50">
          Quitter
        </button>
      </div>
    </AccessibleDialog>
  );
}

function Checklist({
  items,
  workflow,
  onAction,
}: {
  items: ChecklistItem[];
  workflow?: SharedCelineWorkflow;
  onAction: (itemId: string, action: 'done' | 'na') => void;
}) {
  const treated = items.filter((item) => item.done || item.na).length;
  const complete = items.length > 0 && treated === items.length;

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      {workflow && (
        <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
          <div>
            <p className="text-xs font-black text-zinc-800">{workflow.label}</p>
            <p className="text-[11px] font-semibold text-zinc-500">
              Étape {workflow.currentIndex + 1} sur {workflow.totalActions}
            </p>
          </div>
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-teal-600 transition-all"
              style={{ width: `${((workflow.currentIndex + 1) / workflow.totalActions) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-100">
        {items.map((item) => (
          <div key={item.id} className={`flex items-start gap-3 px-4 py-4 ${item.done || item.na ? 'bg-zinc-50 opacity-70' : ''}`}>
            <button
              type="button"
              onClick={() => onAction(item.id, 'done')}
              aria-label={item.done ? `Annuler la validation : ${item.text}` : `Valider : ${item.text}`}
              className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border transition ${item.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 text-transparent hover:border-emerald-600'}`}
            >
              <Check size={14} />
            </button>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium leading-6 ${item.done ? 'text-zinc-400 line-through' : 'text-zinc-900'}`}>{item.text}</p>
              {item.note && <p className="mt-1 text-xs leading-5 text-zinc-500">{item.note}</p>}
              {item.module && <p className="mt-2 text-[10px] font-black uppercase tracking-wide text-teal-700">{item.module}</p>}
            </div>
            <button
              type="button"
              onClick={() => onAction(item.id, 'na')}
              className={`rounded-full px-2.5 py-1 text-[10px] font-black ${item.na ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-100'}`}
            >
              N/A
            </button>
          </div>
        ))}
      </div>

      {complete && workflow && (
        <div className="flex items-center justify-center gap-2 border-t border-emerald-100 bg-emerald-50 px-4 py-2.5 text-xs font-bold text-emerald-800">
          <Sparkles size={13} />
          Étape traitée — Céline prépare la suivante…
        </div>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  onAction,
}: {
  message: CelineMessage;
  onAction: (messageId: string, itemId: string, action: 'done' | 'na') => void;
}) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <span className="inline-flex items-center gap-1.5 px-1 text-[11px] font-black uppercase tracking-[0.16em] text-teal-700">
          <Bot size={12} /> Céline
        </span>
      )}
      <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${isUser ? 'rounded-tr-md bg-teal-700 text-white' : 'rounded-tl-md border border-zinc-200 bg-white text-zinc-800'}`}>
        {message.loading ? 'Céline analyse…' : message.content}
      </div>
      {!message.loading && message.checklist.length > 0 && (
        <div className="w-full max-w-[94%]">
          <Checklist
            items={message.checklist}
            workflow={message.workflow}
            onAction={(itemId, action) => onAction(message.id, itemId, action)}
          />
        </div>
      )}
      {!message.loading && message.followUp && (
        <div className="max-w-[88%] rounded-xl bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 ring-1 ring-teal-100">
          {message.followUp}
        </div>
      )}
    </div>
  );
}

export function CelinePage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<CelineMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pendingRef = useRef(false);
  const autoAdvanceRef = useRef<Set<string>>(new Set());
  const sendMessageRef = useRef<(text: string) => void>(() => undefined);

  useEffect(() => () => abortRef.current?.abort(), []);

  const { listening, toggle: toggleMic, supported: micSupported } = useSpeechInput((transcript) => {
    sendMessageRef.current(transcript);
  });

  useEffect(() => {
    storage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages.filter((message) => !message.loading)));
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeWorkflow = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const workflow = messages[index].workflow;
      if (workflow) return workflow;
    }
    return undefined;
  }, [messages]);

  const appendAssistant = (result: Awaited<ReturnType<typeof requestCelineGuidance>>) => {
    setMessages((current) => [
      ...current.filter((message) => !message.loading),
      {
        id: `celine_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: result.message,
        checklist: result.checklist,
        followUp: result.followUp,
        presentation: result.presentation,
        workflow: result.workflow,
      },
    ]);
  };

  const requestSilentAdvance = async (sourceMessageId: string) => {
    if (pendingRef.current || autoAdvanceRef.current.has(sourceMessageId)) return;
    autoAdvanceRef.current.add(sourceMessageId);
    pendingRef.current = true;
    setLoading(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await requestCelineGuidance("C'est fait.", controller.signal);
      appendAssistant(result);
    } catch (err: unknown) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Impossible de préparer l’étape suivante.');
      }
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loading || pendingRef.current) return;
    const last = [...messages].reverse().find((message) =>
      message.role === 'assistant' &&
      message.presentation === 'focus' &&
      message.workflow &&
      message.checklist.length > 0
    );
    if (!last || autoAdvanceRef.current.has(last.id)) return;
    if (!last.checklist.every((item) => item.done || item.na)) return;
    const timer = window.setTimeout(() => void requestSilentAdvance(last.id), 350);
    return () => window.clearTimeout(timer);
  }, [messages, loading]);

  const handleItemAction = (messageId: string, itemId: string, action: 'done' | 'na') => {
    const item = messages.find((message) => message.id === messageId)?.checklist.find((candidate) => candidate.id === itemId);
    if (!item) return;
    const nextDone = action === 'done' ? !item.done : false;
    const nextNa = action === 'na' ? !item.na : false;

    setMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        checklist: message.checklist.map((candidate) =>
          candidate.id === itemId ? { ...candidate, done: nextDone, na: nextNa } : candidate
        ),
      };
    }));

    const status = nextDone ? 'validated' : nextNa ? 'na' : 'pending';
    setSharedActionStatus(item.actionId, status, findProgressScope(item.actionId));
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pendingRef.current) return;

    const userMessage: CelineMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
      checklist: [],
      followUp: null,
    };
    const loadingMessage: CelineMessage = {
      id: `loading_${Date.now()}`,
      role: 'assistant',
      content: '',
      checklist: [],
      followUp: null,
      loading: true,
    };

    pendingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setMessages((current) => [...current, userMessage, loadingMessage]);
    setInput('');
    setError(null);
    setLoading(true);

    try {
      appendAssistant(await requestCelineGuidance(trimmed, controller.signal));
    } catch (err: unknown) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
        setMessages((current) => current.filter((message) => !message.loading));
      }
    } finally {
      pendingRef.current = false;
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  useEffect(() => {
    sendMessageRef.current = sendMessage;
  });

  const clearConversation = () => {
    abortRef.current?.abort();
    pendingRef.current = false;
    autoAdvanceRef.current.clear();
    setMessages([]);
    setError(null);
    setLoading(false);
    storage.removeItem(STORAGE_KEY_HISTORY);
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[#f3f5f7] text-zinc-950">
      {confirmExit && (
        <ConfirmExit
          onConfirm={() => { setConfirmExit(false); navigate('/shiftguide'); }}
          onCancel={() => setConfirmExit(false)}
        />
      )}

      <header className="flex-none border-b border-zinc-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => messages.length === 0 ? navigate('/shiftguide') : setConfirmExit(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-sm font-bold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <ChevronLeft size={18} /> Accueil
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-zinc-950 text-teal-300"><Bot size={17} /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-black">Céline</p>
              <p className="truncate text-[11px] font-semibold text-zinc-500">
                {activeWorkflow ? `${activeWorkflow.label} · ${activeWorkflow.currentIndex + 1}/${activeWorkflow.totalActions}` : 'Assistant opérationnel ShiftGuide'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearConversation}
            disabled={messages.length === 0}
            title="Nouvelle conversation"
            aria-label="Nouvelle conversation"
            className="grid h-10 w-10 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100 disabled:opacity-30"
          >
            <RotateCcw size={17} />
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
          {messages.length === 0 ? (
            <div className="mx-auto max-w-2xl py-8 sm:py-14">
              <div className="rounded-3xl bg-zinc-950 px-6 py-7 text-white shadow-xl">
                <div className="flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-400 text-zinc-950"><Bot size={22} /></span>
                  <div><h1 className="text-xl font-black">Que se passe-t-il sur la ligne ?</h1><p className="mt-1 text-sm text-zinc-400">Décris la situation naturellement. Céline te guide à partir du référentiel.</p></div>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map(({ icon: Icon, text }) => (
                  <button key={text} type="button" onClick={() => void sendMessage(text)} className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left text-sm font-bold text-zinc-800 shadow-sm hover:border-teal-300 hover:shadow-md">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Icon size={17} /></span>
                    {text}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} onAction={handleItemAction} />
              ))}
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="flex-none border-t border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-4xl items-center gap-2">
          <div className="flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) void sendMessage(input); }}
              placeholder={listening ? 'Écoute en cours…' : 'Décris ta situation…'}
              autoComplete="off"
              className="w-full bg-transparent text-sm text-zinc-900 placeholder-zinc-400 outline-none"
            />
          </div>
          {micSupported && (
            <button type="button" onClick={toggleMic} aria-label={listening ? "Arrêter l'écoute" : 'Dicter'} className={`grid h-12 w-12 place-items-center rounded-xl ${listening ? 'bg-red-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}>
              {listening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}
          <button type="button" onClick={() => void sendMessage(input)} disabled={!input.trim() || loading} aria-label="Envoyer" className="grid h-12 w-12 place-items-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40">
            <Send size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}
