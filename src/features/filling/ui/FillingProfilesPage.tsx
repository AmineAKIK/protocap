import { CheckCircle2, CopyPlus, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useFillingGold } from '../application/FillingGoldContext';
import {
  profileBundleToForm,
  profileBundleFromForm,
  profileReadinessIssues,
  type FillingProfileBundle,
} from '../application/profileBundle';
import { GoldProfileEditor } from './GoldProfileEditor';
import { PageIntro, StatusNotice } from './components';

export function FillingProfilesPage() {
  const { profiles, saveProfile, deleteProfile } = useFillingGold();
  const [editing, setEditing] = useState<FillingProfileBundle | 'new' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readiness = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profileReadinessIssues(profile)])),
    [profiles],
  );

  if (editing) {
    return (
      <div className="mx-auto max-w-5xl px-3 py-6 sm:px-6 sm:py-8">
        <PageIntro
          eyebrow="Données de référence"
          title={editing === 'new' ? 'Créer un profil de réglage' : `Modifier ${editing.label}`}
          description="Chaque bloc conserve sa source. Un profil réel n’est activable que lorsqu’il est complet et vérifié par toi."
        />
        <GoldProfileEditor
          profile={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSave={async (profile) => {
            await saveProfile(profile);
            setMessage('Profil enregistré dans le coffre local.');
            setEditing(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 sm:py-8">
      <PageIntro
        eyebrow="Configuration"
        title="Profils de réglage"
        description="Une combinaison regroupe la machine, le produit, le tube, le plan de démarrage et la balance."
        actions={
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white sm:w-auto"
          >
            <Plus size={18} /> Nouveau profil
          </button>
        }
      />

      {message ? <StatusNotice tone="success" title={message} /> : null}
      {error ? <div className="mt-4"><StatusNotice tone="danger" title="Action impossible">{error}</StatusNotice></div> : null}

      {profiles.length === 0 ? (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <ShieldAlert size={36} className="mx-auto text-slate-300" />
          <h2 className="mt-4 text-lg font-black">Aucun profil exploitable</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
            Commence par créer la combinaison réelle que tu souhaites qualifier. Aucune tolérance n’est inventée par l’application.
          </p>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-teal-700 px-5 text-sm font-black text-white"
          >
            <Plus size={18} /> Préparer mes données
          </button>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {profiles.map((profile) => {
            const issues = readiness.get(profile.id) ?? [];
            const ready = issues.length === 0;
            return (
              <article key={profile.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-lg font-black text-slate-950">{profile.label}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">Version {profile.version} · modifié le {new Date(profile.updatedAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase ${ready ? 'bg-emerald-100 text-emerald-800' : profile.status === 'obsolete' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-800'}`}>
                      {ready ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                      {ready ? 'Réel activé' : profile.status === 'obsolete' ? 'Obsolète' : 'Simulation'}
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 p-5 text-sm sm:grid-cols-2">
                  <div><p className="text-xs font-black uppercase text-slate-400">Cible</p><p className="mt-1 font-black">{profile.profiles.product.approvedTargetVolumeMl} mL</p></div>
                  <div><p className="text-xs font-black uppercase text-slate-400">Masse volumique</p><p className="mt-1 font-black">{profile.profiles.product.density.valueGPerMl} g/mL</p></div>
                  <div><p className="text-xs font-black uppercase text-slate-400">Tare</p><p className="mt-1 font-black">{profile.profiles.packaging.tareMode === 'fixed' ? `${profile.profiles.packaging.fixedTare?.meanG} g moyenne` : profile.profiles.packaging.tareMode === 'paired' ? 'Appariée' : 'Destructive'}</p></div>
                  <div><p className="text-xs font-black uppercase text-slate-400">Échantillon</p><p className="mt-1 font-black">{profile.profiles.controlPlan.sampleSize} tubes</p></div>
                </div>
                {!ready ? (
                  <div className="mx-5 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-950">
                    {issues.slice(0, 2).join(' ')}
                  </div>
                ) : null}
                <div className="grid grid-cols-3 border-t border-slate-100">
                  <button type="button" onClick={() => setEditing(profile)} className="inline-flex min-h-12 items-center justify-center gap-1.5 text-sm font-black text-slate-700 hover:bg-slate-50"><Pencil size={15} /> Modifier</button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const form = profileBundleToForm(profile);
                        form.label = `${form.label} — copie`;
                        form.version = '1';
                        form.status = 'draft';
                        const copy = profileBundleFromForm(form);
                        await saveProfile(copy);
                        setMessage('Copie créée en mode simulation.');
                      } catch (cause) {
                        setError(cause instanceof Error ? cause.message : 'Copie impossible.');
                      }
                    }}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 border-x border-slate-100 text-sm font-black text-slate-700 hover:bg-slate-50"
                  ><CopyPlus size={15} /> Copier</button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!window.confirm(`Supprimer définitivement le profil « ${profile.label} » ?`)) return;
                      try {
                        await deleteProfile(profile.id);
                        setMessage('Profil supprimé. Les anciennes sessions conservent leur snapshot.');
                      } catch (cause) {
                        setError(cause instanceof Error ? cause.message : 'Suppression impossible.');
                      }
                    }}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 text-sm font-black text-rose-700 hover:bg-rose-50"
                  ><Trash2 size={15} /> Supprimer</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
