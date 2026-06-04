import { AlertTriangle, BookOpen, Grid2x2, Key, RotateCcw, Send, Trash2 } from 'lucide-react';
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

// ─── DeepSeek API ─────────────────────────────────────────────────────────────

async function callDeepSeek(
  history: ApiMessage[],
  apiKey: string
): Promise<{ message: string; checklist: ChecklistItem[]; followUp: string | null }> {
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ...history,
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!res.ok) {
    let errMsg = `Erreur ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error?.message ?? errMsg;
    } catch { /* ignore */ }
    if (res.status === 401) throw new Error('Clé API invalide. Vérifie ta clé DeepSeek.');
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

// ─── API Key Setup ────────────────────────────────────────────────────────────

function ApiKeySetup({ onSave }: { onSave: (key: string) => void }) {
  const [key, setKey] = useState('');

  const handleSave = () => {
    const trimmed = key.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-4 text-5xl">👩‍💼</div>
          <h2 className="text-xl font-bold text-[#f1f5f9]">Bonjour, je suis Céline</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#94a3b8]">
            Ton assistante de poste ShiftGuide. Pour démarrer, entre ta clé API DeepSeek.
          </p>
        </div>

        <div className="rounded-2xl bg-[#1e293b] p-5">
          <label className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500">
            <Key size={12} />
            Clé API DeepSeek
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm text-[#f1f5f9] placeholder-slate-600 outline-none ring-1 ring-transparent transition focus:ring-[#3b82f6]"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={!key.trim()}
            className="mt-3 w-full rounded-xl bg-[#3b82f6] py-3 text-sm font-bold text-white transition hover:bg-blue-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Démarrer avec Céline
          </button>
          <p className="mt-3 text-center text-xs text-slate-600">
            La clé est stockée uniquement dans ton navigateur.
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-slate-700">
          Besoin d'une clé ?{' '}
          <span className="text-slate-500">platform.deepseek.com</span>
        </p>
      </div>
    </div>
  );
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Je commence mon poste',
  'Je lance un OC',
  "J'ai un changement d'OC de formule",
  'Il y a une nouvelle cuve',
  'Je finis mon poste',
  "C'est quoi SPCB ?",
];

function WelcomeScreen({ onSuggest }: { onSuggest: (text: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-5 py-8">
      <div className="mb-3 text-5xl">👩‍💼</div>
      <h2 className="text-lg font-bold text-[#f1f5f9]">Bonjour, je suis Céline</h2>
      <p className="mt-2 max-w-xs text-center text-sm leading-relaxed text-[#94a3b8]">
        Dis-moi où tu en es dans ton poste. Je te donne exactement ce dont tu as besoin.
      </p>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="rounded-xl bg-[#1e293b] px-3 py-2 text-sm text-[#94a3b8] transition hover:bg-[#283548] hover:text-[#f1f5f9] active:scale-95"
          >
            {s}
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

  return (
    <div className="mt-2 overflow-hidden rounded-2xl rounded-tl-sm bg-[#1e293b]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2.5">
        <span className="text-xs font-bold text-slate-500">
          {done}/{total} actions
        </span>
        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              done === total && total > 0 ? 'bg-green-500' : 'bg-[#2563eb]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-slate-800/60">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(msgId, item.id)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-800/40 active:scale-[0.99]"
          >
            {/* Checkbox */}
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold transition-colors ${
                item.done
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-slate-600 text-transparent'
              }`}
            >
              ✓
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p
                className={`text-sm leading-snug transition-colors ${
                  item.done ? 'text-slate-600 line-through' : 'text-[#f1f5f9]'
                }`}
              >
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

      {/* Completion banner */}
      {done === total && total > 0 && (
        <div className="border-t border-green-800/40 bg-green-900/20 px-4 py-2 text-center text-xs font-bold text-green-400">
          Tout est fait ✓
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  onToggle,
}: {
  msg: CelineMessage;
  onToggle: (msgId: string, itemId: string) => void;
}) {
  const isUser = msg.role === 'user';

  return (
    <div className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
      {!isUser && (
        <span className="px-1 text-xs font-bold text-[#3b82f6]">Céline</span>
      )}

      {/* Text bubble */}
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'rounded-tr-sm bg-[#3b82f6] text-white'
            : 'rounded-tl-sm bg-[#1e293b] text-[#f1f5f9]'
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

      {/* Checklist */}
      {!msg.loading && msg.checklist.length > 0 && (
        <div className="w-full max-w-[92%]">
          <Checklist items={msg.checklist} msgId={msg.id} onToggle={onToggle} />
        </div>
      )}

      {/* Follow-up */}
      {!msg.loading && msg.followUp && (
        <p className="max-w-[88%] rounded-xl bg-slate-800/40 px-3 py-2 text-xs italic text-slate-500">
          💬 {msg.followUp}
        </p>
      )}
    </div>
  );
}

// ─── CelinePage ───────────────────────────────────────────────────────────────

const STORAGE_KEY_HISTORY = 'shiftguide_celine_history';
const STORAGE_KEY_API = 'shiftguide_deepseek_key';
const PROMPT_VERSION = 'v5'; // bump this to auto-clear old history on prompt changes

function loadHistory(): CelineMessage[] {
  try {
    const version = localStorage.getItem('shiftguide_prompt_version');
    if (version !== PROMPT_VERSION) {
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

export function CelinePage() {
  const navigate = useNavigate();
  const [apiKey, setApiKey] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY_API)
  );
  const [messages, setMessages] = useState<CelineMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const toSave = messages.filter((m) => !m.loading);
    localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(toSave));
  }, [messages]);

  const handleSaveKey = (key: string) => {
    localStorage.setItem(STORAGE_KEY_API, key);
    setApiKey(key);
    setShowSettings(false);
  };

  const handleToggle = (msgId: string, itemId: string) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          checklist: m.checklist.map((item) =>
            item.id === itemId ? { ...item, done: !item.done } : item
          ),
        };
      })
    );
  };

  const buildApiHistory = (msgs: CelineMessage[]): ApiMessage[] =>
    msgs
      .filter((m) => !m.loading)
      .map((m) => ({
        role: m.role,
        content:
          m.role === 'assistant'
            ? JSON.stringify({
                message: m.content,
                checklist: m.checklist,
                followUp: m.followUp,
              })
            : m.content,
      }));

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading || !apiKey) return;

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

    try {
      const history = buildApiHistory([...messages, userMsg]);
      const result = await callDeepSeek(history, apiKey);

      const reply: CelineMessage = {
        id: `celine_${Date.now()}`,
        role: 'assistant',
        content: result.message,
        checklist: result.checklist,
        followUp: result.followUp,
      };

      setMessages((prev) => [...prev.filter((m) => !m.loading), reply]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue.';
      setError(msg);
      setMessages((prev) => prev.filter((m) => !m.loading));
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY_HISTORY);
  };

  const handleSuggest = (text: string) => {
    setInput(text);
    sendMessage(text);
  };

  // ── Render ──

  if (showSettings || !apiKey) {
    return (
      <div className="flex h-[100dvh] flex-col bg-[#0f172a] text-[#f1f5f9]">
        {apiKey && (
          <header className="flex-none flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            >
              ← Retour
            </button>
            <span className="text-sm font-bold text-[#f1f5f9]">Clé API</span>
            <div className="w-16" />
          </header>
        )}
        <ApiKeySetup onSave={handleSaveKey} />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-[#0f172a] text-[#f1f5f9]">
      {/* Header */}
      <header className="flex-none flex items-center justify-between border-b border-slate-800 px-3 py-2.5">
        <button
          onClick={() => navigate('/')}
          className="rounded-lg px-2 py-1.5 text-sm text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
        >
          ← Toolkit
        </button>

        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#f1f5f9]">👩‍💼 Céline</span>
          <span className="rounded-full bg-green-900/60 px-2 py-0.5 text-xs font-semibold text-green-400">
            ShiftGuide
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Link
            to="/shiftguide/modules"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            title="Modules manuels"
          >
            <Grid2x2 size={16} />
          </Link>
          <Link
            to="/shiftguide/lexique"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
            title="Lexique"
          >
            <BookOpen size={16} />
          </Link>
          <Link
            to="/shiftguide/urgences"
            className="flex h-8 items-center gap-1 rounded-lg bg-red-800/40 px-2 text-xs font-bold text-red-400 transition hover:bg-red-700 hover:text-red-200"
          >
            <AlertTriangle size={13} />
          </Link>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          {messages.length === 0 ? (
            <WelcomeScreen onSuggest={handleSuggest} />
          ) : (
            messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} onToggle={handleToggle} />
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

      {/* Toolbar (when messages exist) */}
      {messages.length > 0 && (
        <div className="flex-none flex items-center justify-between border-t border-slate-800/40 px-4 py-1.5">
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-800 hover:text-slate-400"
          >
            <Trash2 size={12} />
            Effacer
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-800 hover:text-slate-400"
          >
            <Key size={12} />
            Clé API
          </button>
          <button
            onClick={() => {
              setMessages([]);
              localStorage.removeItem(STORAGE_KEY_HISTORY);
            }}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-800 hover:text-slate-400"
          >
            <RotateCcw size={12} />
            Nouveau poste
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex-none border-t border-slate-800 bg-[#0f172a] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 rounded-2xl bg-[#1e293b] px-4 py-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) sendMessage(input);
              }}
              placeholder="Décris ta situation à Céline…"
              className="w-full bg-transparent text-sm text-[#f1f5f9] placeholder-slate-600 outline-none"
              disabled={loading}
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
