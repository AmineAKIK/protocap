import { Download, WifiOff, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const dismiss = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[100] mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-950 p-4 text-white shadow-2xl" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-300 text-slate-950">
          {needRefresh ? <Download size={19} /> : <WifiOff size={19} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-black">{needRefresh ? 'Mise à jour prête' : 'Application disponible hors ligne'}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-300">
            {needRefresh
              ? 'Termine la saisie en cours, puis applique la nouvelle version. Les actions déjà validées sont enregistrées localement.'
              : 'Les écrans déjà mis en cache restent accessibles sans réseau. L’ouverture ShiftGuide peut néanmoins demander une session serveur valide.'}
          </p>
          {needRefresh ? (
            <button type="button" onClick={() => void updateServiceWorker(true)} className="mt-3 min-h-11 rounded-xl bg-teal-300 px-4 text-sm font-black text-slate-950">
              Mettre à jour maintenant
            </button>
          ) : null}
        </div>
        <button type="button" onClick={dismiss} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 text-slate-300 hover:bg-white/10" aria-label="Fermer la notification"><X size={18} /></button>
      </div>
    </div>
  );
}
