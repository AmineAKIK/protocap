import { AlertTriangle, ChevronLeft, Grid2x2, RotateCcw, Send, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildSystemPrompt } from '../../data/celineSystemPrompt';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  text: string;
  note: string | null;
  module: string | null;
  done: boolean;
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

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY as string;

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

async function callDeepSeek(
  history: ApiMessage[]
): Promise<{ message: string; checklist: ChecklistItem[]; followUp: string | null }> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...history],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    let errMsg = `Erreur ${res.status}`;
    try { const b = await res.json(); errMsg = b.error?.message ?? errMsg; } catch { /* ignore */ }
    if (res.status === 401) throw new Error('Clé API invalide.');
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
const PROMPT_VERSION = 'v5';

function loadHistory(): CelineMessage[] {
  try {
    if (localStorage.getItem('shiftguide_prompt_version') !== PROMPT_VERSION) {
      localStorage.removeItem(STORAGE_KEY_HISTORY);
      localStorage.setItem('shiftguide_prompt_version', PROMPT_VERSION);
      return [];
    }
    const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
    return saved ? (JSON.parse(saved) as CelineMessage[]) : [];
  } catch {
    return [];
  }
}

// ─── WelcomeScreen ────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { emoji: '🌅', text: 'Je commence mon poste' },
  { emoji: '🚀', text: 'Je lance un OC' },
  { emoji: '🔄', text: "J'ai un changement d'OC de formule" },
  { emoji: '🛢️', text: 'Il y a une nouvelle cuve' },
  { emoji: '🏁', text: 'Je finis mon poste' },
  { emoji: '📖', text: "C'est quoi SPCB ?" },
];

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="space-y-4 px-4 py-4">
      <div className="rounded-2xl border border-slate-700 bg-[#1e293b] p-5">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👩‍💼</span>
          <div>
            <p className="text-sm font-bold text-[#f1f5f9]">Céline</p>
            <p className="text-xs text-[#94a3b8]">Assistante opérationnelle ShiftGuide</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-[#94a3b8]">
          Dis-moi où tu en es dans ton poste. Je te guide étape par étape.
        </p>
      </div>

      <p className="px-1 text-xs font-bold uppercase tracking-widest text-slate-500">
        Situations fréquentes
      </p>

      <div className="grid grid-cols-1 gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.text}
            onClick={() => onSuggest(s.text)}
            className="flex items-center gap-3 rounded-xl bg-[#1e293b] px-4 py-3 text-left transition hover:bg-[#283548] active:scale-[0.98]"
          >
            <span className="text-lg leading-none">{s.emoji}</span>
            <span className="text-sm font-medium text-[#94a3b8]">{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Checklist ────────────────────────────────────────────────────────────────

function Checklist({
  items,
  msgId,
  onToggle,
}: {
  items: ChecklistItem[];
  msgId: string;
  onToggle: (msgId: string, itemId: string) => void;
}) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const pct = total > 0 ? (done / total) * 100 : 0;
  const complete = done === total && total > 0;

  return (
    <div className="mt-2 overflow-hidden rounded-2xl border border-slate-700/50 bg-[#1e293b]">
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-2.5">
        <span className="text-xs font-bold text-slate-500">{done} / {total} actions</span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${complete ? 'bg-green-500' : 'bg-[#2563eb]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-slate-800/60">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(msgId, item.id)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40 active:scale-[0.99]"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                item.done ? 'border-green-600 bg-green-600 text-white' : 'border-slate-600 text-transparent'
              }`}
            >
              ✓
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm leading-snug transition-colors ${item.done ? 'text-slate-600 line-through' : 'text-[#f1f5f9]'}`}>
                {item.text}
              </p>
              {item.note && (
                <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.note}</p>
              )}
              {item.module && (
                <span className="mt-1.5 inline-block rounded-full bg-[#3b82f6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#3b82f6]">
                  {item.module}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {complete && (
        <div className="border-t border-green-800/40 bg-green-900/20 px-4 py-2 text-center text-xs font-bold text-green-400">
          Tout est fait ✓
        </div>
      )}
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onToggle,
}: {
  msg: CelineMessage;
  onToggle: (msgId: string, itemId: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <span className="px-1 text-xs font-bold uppercase tracking-widest text-[#3b82f6]">
          Céline
        </span>
      )}

      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-[#3b82f6] text-white'
            : 'rounded-tl-sm border border-slate-700/50 bg-[#1e293b] text-[#f1f5f9]'
        }`}
      >
        {msg.loading ? (
          <div className="flex items-center gap-2.5">
            <span className="text-sm text-slate-400">Céline réfléchit</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-500"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{msg.content}</p>
        )}
      </div>

      {!msg.loading && msg.checklist.length > 0 && (
        <div className="w-full max-w-[92%]">
          <Checklist items={msg.checklist} msgId={msg.id} onToggle={onToggle} />
        </div>
      )}

      {!msg.loading && msg.followUp && (
        <div className="max-w-[88%] rounded-xl border border-slate-700/30 bg-slate-800/40 px-3 py-2">
          <p className="text-xs italic text-slate-500">💬 {msg.followUp}</p>
        </div>
      )}
    </div>
  );
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-8 backdrop-blur-sm sm:items-center sm:pb-0">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-700 bg-[#1e293b]">
        <div className="px-5 py-5">
          <p className="text-sm font-bold text-[#f1f5f9]">Quitter Céline ?</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#94a3b8]">
            La conversation en cours sera perdue.
          </p>
        </div>
        <div className="flex border-t border-slate-700">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-semibold text-slate-400 transition hover:bg-slate-800"
          >
            Annuler
          </button>
          <div className="w-px bg-slate-700" />
          <button
            onClick={onConfirm}
            className="flex-1 py-3.5 text-sm font-semibold text-red-400 transition hover:bg-slate-800"
          >
            Quitter
          </button>
        </div>
      </div>
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

  const messageCount = messages.length;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageCount]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(messages.filter((m) => !m.loading)));
  }, [messages]);

  const clearSession = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  };

  const toggleItem = (msgId: string, itemId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id !== msgId
          ? m
          : { ...m, checklist: m.checklist.map((item) => item.id === itemId ? { ...item, done: !item.done } : item) }
      )
    );
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

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

    setMessages((prev) => [...prev, userMsg, placeholder]);
    setInput('');
    setError(null);
    setLoading(true);
    inputRef.current?.focus();

    try {
      const result = await callDeepSeek(toApiHistory([...messages, userMsg]));
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
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
      setMessages((prev) => prev.filter((m) => !m.loading));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0f172a] text-[#f1f5f9]">
      {confirmExit && (
        <ConfirmModal
          onConfirm={() => navigate('/')}
          onCancel={() => setConfirmExit(false)}
        />
      )}
      <header className="sticky top-0 z-30 flex-none border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => messages.length === 0 ? navigate('/') : setConfirmExit(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          >
            <ChevronLeft size={18} />
            Toolkit
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[#f1f5f9]">Céline</span>
            <span className="rounded-full bg-[#3b82f6]/20 px-2 py-0.5 text-xs font-semibold text-[#3b82f6]">
              IA
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/shiftguide/modules"
              className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-400 transition hover:bg-slate-700 hover:text-slate-200"
            >
              <Grid2x2 size={13} />
              Modules
            </Link>
            <Link
              to="/shiftguide/urgences"
              className="flex items-center gap-1.5 rounded-lg bg-red-700/80 px-3 py-1.5 text-xs font-bold text-red-100 transition hover:bg-red-600"
            >
              <AlertTriangle size={13} />
              Urgences
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggest={sendMessage} />
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onToggle={toggleItem} />
            ))
          )}

          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-red-800/60 bg-red-900/20 px-4 py-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {messages.length > 0 && (
        <div className="flex-none flex items-center gap-2 border-t border-slate-800/60 px-4 py-2">
          <button
            onClick={clearSession}
            className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-700 hover:text-slate-300"
          >
            <Trash2 size={11} />
            Effacer
          </button>
          <button
            onClick={clearSession}
            className="flex items-center gap-1.5 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-700 hover:text-slate-300"
          >
            <RotateCcw size={11} />
            Nouveau poste
          </button>
        </div>
      )}

      <div className="flex-none border-t border-slate-800 bg-[#0f172a] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-2xl border border-slate-700/60 bg-[#1e293b] px-4 py-3 transition focus-within:border-[#3b82f6]/60">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) sendMessage(input); }}
              placeholder="Décris ta situation…"
              className="w-full bg-transparent text-sm text-[#f1f5f9] placeholder-slate-600 outline-none"
              autoComplete="off"
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#3b82f6] text-white transition hover:bg-blue-400 active:scale-90 disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
