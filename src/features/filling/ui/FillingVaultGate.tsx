import { Database, KeyRound, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useFillingGold } from '../application/FillingGoldContext';
import { StatusNotice } from './components';

const AUTO_LOCK_MS = 15 * 60 * 1000;

export function FillingVaultGate({ children }: { children: ReactNode }) {
  const { vaultState, error, initializeVault, unlockVault, lockVault } = useFillingGold();
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (vaultState !== 'unlocked') return;
    let timeout = window.setTimeout(lockVault, AUTO_LOCK_MS);
    const reset = () => {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(lockVault, AUTO_LOCK_MS);
    };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(timeout);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [lockVault, vaultState]);

  if (vaultState === 'unlocked') return <>{children}</>;

  if (vaultState === 'opening') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <div className="text-center">
          <LoaderCircle size={36} className="mx-auto animate-spin text-teal-300" />
          <p className="mt-4 text-sm font-black">Vérification du coffre local…</p>
        </div>
      </div>
    );
  }

  const isSetup = vaultState === 'needs_setup';
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    if (passphrase.length < 8) {
      setLocalError('La phrase secrète doit contenir au moins huit caractères.');
      return;
    }
    if (isSetup && confirmation !== passphrase) {
      setLocalError('Les deux phrases secrètes ne correspondent pas.');
      return;
    }
    setSubmitting(true);
    try {
      if (isSetup) await initializeVault(passphrase);
      else await unlockVault(passphrase);
      setPassphrase('');
      setConfirmation('');
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white text-slate-950 shadow-2xl">
        <div className="bg-slate-900 px-6 py-6 text-white">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-400 text-slate-950">
            {isSetup ? <Database size={23} /> : <KeyRound size={23} />}
          </span>
          <h1 className="mt-4 text-xl font-black">
            {isSetup ? 'Créer le coffre local' : 'Déverrouiller la Gold'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {isSetup
              ? 'Les profils, mesures et historiques seront chiffrés sur cet appareil.'
              : 'La phrase secrète locale déchiffre les données sans les envoyer au serveur.'}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          {error || localError ? (
            <StatusNotice tone="danger" title="Accès impossible">
              {localError ?? error}
            </StatusNotice>
          ) : null}
          {isSetup ? (
            <StatusNotice tone="warning" title="À conserver absolument">
              Il n’existe aucune récupération automatique. Sauvegarde cette phrase dans un endroit sûr.
            </StatusNotice>
          ) : null}
          <label className="block">
            <span className="text-xs font-black uppercase tracking-wide text-slate-600">
              Phrase secrète locale
            </span>
            <input
              type="password"
              autoComplete={isSetup ? 'new-password' : 'current-password'}
              value={passphrase}
              onChange={(event) => setPassphrase(event.target.value)}
              className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 text-base font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              autoFocus
            />
          </label>
          {isSetup ? (
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-600">
                Confirmer la phrase
              </span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 text-base font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              />
            </label>
          ) : null}
          <button
            type="submit"
            disabled={submitting || passphrase.length < 8}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white disabled:opacity-50"
          >
            {submitting ? <LoaderCircle size={19} className="animate-spin" /> : <ShieldCheck size={19} />}
            {submitting ? 'Ouverture…' : isSetup ? 'Créer et ouvrir le coffre' : 'Déverrouiller'}
          </button>
          <p className="text-center text-xs font-semibold leading-5 text-slate-500">
            Verrouillage automatique après 15 minutes d’inactivité. Le verrouillage système de l’appareil reste indispensable.
          </p>
        </form>
      </div>
    </div>
  );
}
