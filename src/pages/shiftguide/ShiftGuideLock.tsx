import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { unlockShiftGuide } from '../../hooks/useShiftGuideAuth';

export function ShiftGuideLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attempt = async () => {
    const trimmed = code.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);

    const result = await unlockShiftGuide(trimmed);

    if (result.ok) {
      onUnlock();
    } else {
      setError(result.error ?? 'Code incorrect.');
      setCode('');
      setLoading(false);
      setTimeout(() => setError(null), 2500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f5f7] px-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
        <div className="border-b border-zinc-100 bg-zinc-950 px-6 py-6 text-white">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-500/15 ring-1 ring-teal-400/20">
            <LockKeyhole size={22} className="text-teal-300" />
          </span>
          <p className="mt-4 text-xl font-black">ShiftGuide</p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-teal-300">
            Accès restreint
          </p>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm font-bold text-zinc-600">
            Cette section est protégée. Entre le code d'accès pour continuer.
          </p>

          <div
            className={`mt-5 overflow-hidden rounded-xl border transition ${
              error
                ? 'border-red-400 ring-4 ring-red-100'
                : 'border-zinc-200 focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10'
            } bg-white`}
          >
            <input
              ref={inputRef}
              type="password"
              value={code}
              autoFocus
              disabled={loading}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') attempt(); }}
              placeholder="Code d'accès"
              className="w-full bg-transparent px-4 py-3.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none disabled:opacity-50"
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600">
              <ShieldAlert size={13} />
              {error}
            </div>
          )}

          <button
            onClick={attempt}
            disabled={!code.trim() || loading}
            className="mt-4 w-full rounded-xl bg-zinc-950 py-3.5 text-sm font-black text-teal-300 transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40"
          >
            {loading ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </div>
      </div>
    </div>
  );
}
