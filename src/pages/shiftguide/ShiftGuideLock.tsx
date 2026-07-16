import { LockKeyhole, ShieldAlert } from 'lucide-react';
import { type FormEvent, useRef, useState } from 'react';
import { unlockShiftGuide } from '../../hooks/useShiftGuideAuth';

export function ShiftGuideLock({ onUnlock }: { onUnlock: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const attempt = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
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
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f3f5f7] px-6">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl shadow-zinc-200/60">
        <div className="border-b border-zinc-100 bg-zinc-950 px-6 py-6 text-white">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-500/15 ring-1 ring-teal-400/20">
            <LockKeyhole size={22} className="text-teal-300" />
          </span>
          <h1 className="mt-4 text-xl font-black">ShiftGuide</h1>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-teal-300">
            Accès restreint
          </p>
        </div>

        <form className="px-6 py-6" onSubmit={attempt} noValidate>
          <p className="text-sm font-bold text-zinc-600">
            Cette section est protégée. Entre le code d'accès pour continuer.
          </p>

          <label htmlFor="shiftguide-access-code" className="mt-5 block text-xs font-black uppercase tracking-wide text-zinc-500">
            Code d'accès
          </label>

          <div
            className={`mt-2 overflow-hidden rounded-xl border transition ${
              error
                ? 'border-red-400 ring-4 ring-red-100'
                : 'border-zinc-200 focus-within:border-teal-600 focus-within:ring-4 focus-within:ring-teal-600/10'
            } bg-white`}
          >
            <input
              id="shiftguide-access-code"
              ref={inputRef}
              type="password"
              name="shiftguide-access-code"
              value={code}
              autoFocus
              disabled={loading}
              maxLength={256}
              onChange={(e) => {
                setCode(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Code d'accès"
              className="w-full bg-transparent px-4 py-3.5 text-sm text-zinc-900 placeholder-zinc-400 outline-none disabled:opacity-50"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'shiftguide-access-error' : undefined}
            />
          </div>

          {error && (
            <div
              id="shiftguide-access-error"
              role="alert"
              aria-live="assertive"
              className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600"
            >
              <ShieldAlert size={13} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!code.trim() || loading}
            className="mt-4 w-full rounded-xl bg-zinc-950 py-3.5 text-sm font-black text-teal-300 transition hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-40"
          >
            {loading ? 'Vérification…' : 'Déverrouiller'}
          </button>
        </form>
      </div>
    </div>
  );
}
