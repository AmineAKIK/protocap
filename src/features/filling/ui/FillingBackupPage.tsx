import {
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileCheck2,
  HardDrive,
  KeyRound,
  LoaderCircle,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { useFillingGold } from '../application/FillingGoldContext';
import { ENGINE_VERSION } from '../domain/engineVersion';
import {
  exportEncryptedBackup,
  inspectStorageHealth,
  previewEncryptedBackup,
  restoreEncryptedBackup,
  changeLocalPassphrase,
  readWrappedDataKey,
  unlockLocalEncryption,
  type BackupPreview,
  type StorageHealthReport,
} from '../infrastructure';
import { PageIntro, StatusNotice } from './components';

function bytes(value: number | null): string {
  if (value === null) return 'indisponible';
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} Ko`;
  return `${(value / 1024 / 1024).toFixed(1)} Mo`;
}

function downloadText(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function FillingBackupPage() {
  const { repositories, refresh, persistence } = useFillingGold();
  const [health, setHealth] = useState<StorageHealthReport | null>(null);
  const [exportPassphrase, setExportPassphrase] = useState('');
  const [exportConfirmation, setExportConfirmation] = useState('');
  const [importPassphrase, setImportPassphrase] = useState('');
  const [serializedBackup, setSerializedBackup] = useState('');
  const [backupName, setBackupName] = useState('');
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [currentLocalPassphrase, setCurrentLocalPassphrase] = useState('');
  const [newLocalPassphrase, setNewLocalPassphrase] = useState('');
  const [newLocalConfirmation, setNewLocalConfirmation] = useState('');
  const [busy, setBusy] = useState<'export' | 'preview' | 'restore' | 'passphrase' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refreshHealth = async () => {
    if (!repositories) return;
    setHealth(await inspectStorageHealth(repositories.database));
  };

  useEffect(() => {
    void refreshHealth().catch(() => undefined);
    // Health is refreshed when this unlocked repository instance changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repositories]);

  const recordBackupEvent = async (type: 'backup_exported' | 'backup_imported') => {
    if (!repositories) return;
    const existing = (await repositories.events.list()).filter((entry) => !entry.value.sessionId);
    const sequence = existing.reduce((maximum, entry) => Math.max(maximum, entry.value.sequence), -1) + 1;
    await repositories.events.append({
      id: crypto.randomUUID(),
      sequence,
      type,
      occurredAt: new Date().toISOString(),
      engineVersion: ENGINE_VERSION,
    });
  };

  const exportBackup = async () => {
    setError(null);
    setMessage(null);
    if (!repositories) return;
    if (exportPassphrase.length < 8) {
      setError('La phrase de sauvegarde doit contenir au moins huit caractères.');
      return;
    }
    if (exportPassphrase !== exportConfirmation) {
      setError('Les deux phrases de sauvegarde ne correspondent pas.');
      return;
    }
    setBusy('export');
    try {
      const serialized = await exportEncryptedBackup(repositories, exportPassphrase);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      downloadText(`protocap-remplissage-${stamp}.json`, serialized);
      await recordBackupEvent('backup_exported');
      setExportPassphrase('');
      setExportConfirmation('');
      setMessage('Sauvegarde chiffrée créée et contrôlée. Conserve le fichier et sa phrase séparément.');
      await refreshHealth();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La sauvegarde n’a pas pu être créée.');
    } finally {
      setBusy(null);
    }
  };

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPreview(null);
    setError(null);
    setMessage(null);
    setSerializedBackup('');
    setBackupName('');
    if (!file) return;
    try {
      setSerializedBackup(await file.text());
      setBackupName(file.name);
    } catch {
      setError('Le fichier n’a pas pu être lu sur cet appareil.');
    }
  };

  const inspectBackup = async () => {
    setError(null);
    setMessage(null);
    if (!repositories || !serializedBackup) return;
    if (importPassphrase.length < 8) {
      setError('Saisis la phrase secrète utilisée lors de cet export.');
      return;
    }
    setBusy('preview');
    try {
      setPreview(await previewEncryptedBackup(serializedBackup, importPassphrase, repositories));
      setMessage('Intégrité et schémas vérifiés. Aucune donnée locale n’a encore été remplacée.');
    } catch (cause) {
      setPreview(null);
      setError(cause instanceof Error ? cause.message : 'Cette sauvegarde est illisible ou incompatible.');
    } finally {
      setBusy(null);
    }
  };

  const restoreBackup = async () => {
    if (!repositories || !preview) return;
    if (!window.confirm('Remplacer entièrement les profils, sessions et événements locaux par cette sauvegarde ?')) return;
    setBusy('restore');
    setError(null);
    setMessage(null);
    try {
      await restoreEncryptedBackup(repositories, preview);
      await recordBackupEvent('backup_imported');
      await refresh();
      await refreshHealth();
      setSerializedBackup('');
      setBackupName('');
      setImportPassphrase('');
      setPreview(null);
      setMessage('Restauration terminée et relue. Les données précédentes ont été remplacées.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La restauration a échoué sans être validée.');
    } finally {
      setBusy(null);
    }
  };

  const changePassphrase = async () => {
    if (!repositories) return;
    setError(null);
    setMessage(null);
    if (newLocalPassphrase.length < 8) {
      setError('La nouvelle phrase locale doit contenir au moins huit caractères.');
      return;
    }
    if (newLocalPassphrase !== newLocalConfirmation) {
      setError('La confirmation de la nouvelle phrase locale ne correspond pas.');
      return;
    }
    setBusy('passphrase');
    try {
      const verification = await unlockLocalEncryption(
        repositories.database,
        currentLocalPassphrase,
      );
      verification.cipher.lock();
      const envelope = await readWrappedDataKey(repositories.database);
      if (!envelope) throw new Error('L’enveloppe de chiffrement locale est introuvable.');
      await changeLocalPassphrase(
        repositories.database,
        repositories.cipher,
        newLocalPassphrase,
        envelope.revision,
      );
      setCurrentLocalPassphrase('');
      setNewLocalPassphrase('');
      setNewLocalConfirmation('');
      setMessage('Phrase secrète locale remplacée. Crée maintenant une nouvelle sauvegarde de contrôle.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'La phrase secrète locale n’a pas pu être remplacée.');
    } finally {
      setBusy(null);
    }
  };

  const counts = preview?.manifest.recordCounts;
  return (
    <div className="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8">
      <PageIntro
        eyebrow="Continuité locale"
        title="Sauvegarder, contrôler, restaurer"
        description="Les exports sont chiffrés avec une phrase propre au fichier. Une restauration remplace toujours l’ensemble local : aucun mélange silencieux d’historiques."
      />

      {error ? <StatusNotice tone="danger" title="Opération refusée">{error}</StatusNotice> : null}
      {message ? <div className="mt-4"><StatusNotice tone="success" title="Opération terminée">{message}</StatusNotice></div> : null}

      <section className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3 sm:p-5">
        <div className="flex items-center gap-3"><HardDrive className="text-teal-700" /><div><p className="text-xs font-black uppercase text-slate-400">Persistance</p><p className="font-black">{persistence === 'granted' || persistence === 'already-persistent' ? 'Garantie par le navigateur' : persistence === 'denied' ? 'Non garantie' : 'API indisponible'}</p></div></div>
        <div><p className="text-xs font-black uppercase text-slate-400">Utilisé</p><p className="mt-1 font-black">{bytes(health?.usageBytes ?? null)}</p></div>
        <div><p className="text-xs font-black uppercase text-slate-400">Quota</p><p className="mt-1 font-black">{bytes(health?.quotaBytes ?? null)}{health?.usageRatio !== null && health?.usageRatio !== undefined ? ` · ${Math.round(health.usageRatio * 100)} %` : ''}</p></div>
        {health?.warnings.length ? <div className="sm:col-span-3"><StatusNotice tone="warning" title="Surveillance stockage">{health.warnings.join(' ')}</StatusNotice></div> : null}
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-teal-100 text-teal-800"><DatabaseBackup size={23} /></span>
          <h2 className="mt-4 text-xl font-black">Créer une sauvegarde</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Le fichier contient profils, sessions, mesures, événements et réglages applicatifs. Il est inutilisable sans sa phrase.</p>
          <div className="mt-5 space-y-4">
            <label className="block"><span className="text-xs font-black uppercase text-slate-600">Phrase du fichier</span><input type="password" autoComplete="new-password" value={exportPassphrase} onChange={(event) => setExportPassphrase(event.target.value)} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
            <label className="block"><span className="text-xs font-black uppercase text-slate-600">Confirmation</span><input type="password" autoComplete="new-password" value={exportConfirmation} onChange={(event) => setExportConfirmation(event.target.value)} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
            <button type="button" onClick={exportBackup} disabled={busy !== null || exportPassphrase.length < 8 || exportConfirmation.length < 8} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white disabled:opacity-40">{busy === 'export' ? <LoaderCircle className="animate-spin" size={19} /> : <Download size={19} />} Exporter le coffre</button>
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm sm:p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-rose-100 text-rose-800"><Upload size={23} /></span>
          <h2 className="mt-4 text-xl font-black">Restaurer un coffre</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">Le fichier est déchiffré et validé en mémoire avant de proposer le remplacement. Aucun import partiel.</p>
          <div className="mt-5 space-y-4">
            <label className="block"><span className="text-xs font-black uppercase text-slate-600">Fichier .json chiffré</span><input type="file" accept="application/json,.json" onChange={selectBackup} className="mt-1 block min-h-14 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm font-bold file:mr-3 file:rounded-lg file:border-0 file:bg-slate-950 file:px-3 file:py-2 file:text-xs file:font-black file:text-white" /></label>
            {backupName ? <p className="flex items-center gap-2 text-xs font-bold text-slate-600"><FileCheck2 size={15} className="text-teal-700" />{backupName}</p> : null}
            <label className="block"><span className="text-xs font-black uppercase text-slate-600">Phrase de cette sauvegarde</span><input type="password" autoComplete="current-password" value={importPassphrase} onChange={(event) => { setImportPassphrase(event.target.value); setPreview(null); }} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
            <button type="button" onClick={inspectBackup} disabled={busy !== null || !serializedBackup || importPassphrase.length < 8} className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-800 disabled:opacity-40">{busy === 'preview' ? <LoaderCircle className="animate-spin" size={19} /> : <ShieldAlert size={19} />} Contrôler avant import</button>
          </div>
          {preview && counts ? (
            <div className="mt-5 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
              <p className="flex items-center gap-2 font-black text-emerald-950"><CheckCircle2 size={18} /> Sauvegarde valide</p>
              <p className="mt-2 text-sm font-semibold text-emerald-950">Créée le {new Date(preview.manifest.createdAt).toLocaleString('fr-FR')} · {counts.profiles} profils techniques · {counts.sessions} sessions · {counts.events} événements.</p>
              <button type="button" onClick={restoreBackup} disabled={busy !== null} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 text-sm font-black text-white disabled:opacity-40">{busy === 'restore' ? <LoaderCircle className="animate-spin" size={19} /> : <Upload size={19} />} Remplacer les données locales</button>
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-800"><KeyRound size={22} /></span>
          <div><h2 className="text-xl font-black">Changer la phrase du coffre local</h2><p className="mt-1 text-sm leading-6 text-slate-500">Cette opération ré-enveloppe la clé locale ; elle ne réécrit pas les mesures. Les anciennes sauvegardes gardent leur propre phrase.</p></div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label><span className="text-xs font-black uppercase text-slate-600">Phrase actuelle</span><input type="password" autoComplete="current-password" value={currentLocalPassphrase} onChange={(event) => setCurrentLocalPassphrase(event.target.value)} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
          <label><span className="text-xs font-black uppercase text-slate-600">Nouvelle phrase</span><input type="password" autoComplete="new-password" value={newLocalPassphrase} onChange={(event) => setNewLocalPassphrase(event.target.value)} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
          <label><span className="text-xs font-black uppercase text-slate-600">Confirmation</span><input type="password" autoComplete="new-password" value={newLocalConfirmation} onChange={(event) => setNewLocalConfirmation(event.target.value)} className="mt-1 min-h-14 w-full rounded-xl border border-slate-300 px-4 font-bold outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" /></label>
        </div>
        <button type="button" onClick={changePassphrase} disabled={busy !== null || currentLocalPassphrase.length < 8 || newLocalPassphrase.length < 8 || newLocalConfirmation.length < 8} className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-40 sm:w-auto">{busy === 'passphrase' ? <LoaderCircle className="animate-spin" size={19} /> : <KeyRound size={19} />} Remplacer la phrase locale</button>
      </section>
    </div>
  );
}
