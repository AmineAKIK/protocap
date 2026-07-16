import { Check, Save, X } from 'lucide-react';
import { useId, useState } from 'react';
import {
  emptyFillingProfileForm,
  profileBundleFromForm,
  profileBundleToForm,
  profileReadinessIssues,
  type FillingProfileBundle,
  type FillingProfileForm,
} from '../application/profileBundle';
import { DecimalField, FormSection, StatusNotice } from './components';

const fieldClass =
  'mt-1 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-bold text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100';

function TextField({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="text-xs font-black uppercase tracking-wide text-slate-600">{label}</label>
      <input
        id={id}
        className={fieldClass}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const id = useId();
  return (
    <div className="block">
      <label htmlFor={id} className="text-xs font-black uppercase tracking-wide text-slate-600">{label}</label>
      <select
        id={id}
        className={fieldClass}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GoldProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile?: FillingProfileBundle;
  onSave: (profile: FillingProfileBundle) => Promise<void> | void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FillingProfileForm>(() =>
    profile ? profileBundleToForm(profile) : { ...emptyFillingProfileForm },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof FillingProfileForm>(key: K, value: FillingProfileForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const bundle = profileBundleFromForm(form, profile);
      if (form.status === 'verified_by_me') {
        const issues = profileReadinessIssues(bundle);
        if (issues.length > 0) throw new Error(issues.join(' '));
      }
      await onSave(bundle);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Le profil n'a pas pu être enregistré.");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {error ? <StatusNotice tone="danger" title="Profil non enregistrable">{error}</StatusNotice> : null}

      <FormSection title="Identification" description="Ce libellé représente une combinaison machine–produit–tube–contrôle.">
        <TextField label="Nom du profil" value={form.label} onChange={(value) => update('label', value)} required />
        <TextField label="Version" value={form.version} onChange={(value) => update('version', value)} required />
        <SelectField
          label="Statut"
          value={form.status}
          onChange={(value) => update('status', value)}
          options={[
            { value: 'draft', label: 'Brouillon / simulation' },
            { value: 'verified_by_me', label: 'Vérifié par moi — réglage réel' },
            { value: 'obsolete', label: 'Obsolète' },
          ]}
        />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950">
          « Vérifié par moi » signifie que tu as contrôlé les valeurs dans tes sources. Ce n’est pas une approbation Qualité institutionnelle.
        </div>
      </FormSection>

      <FormSection title="Machine" description="Unité réellement saisie ou position réellement appliquée sur la remplisseuse.">
        <TextField label="Machine" value={form.machineName} onChange={(value) => update('machineName', value)} required />
        <TextField label="Ligne" value={form.line} onChange={(value) => update('line', value)} />
        <SelectField
          label="Type de consigne"
          value={form.setpointType}
          onChange={(value) => {
            update('setpointType', value);
            if (value === 'volume') update('machineUnit', 'mL');
            if (value === 'net_mass' || value === 'gross_mass') update('machineUnit', 'g');
            if (value === 'mechanical' && (form.machineUnit === 'mL' || form.machineUnit === 'g')) {
              update('machineUnit', 'graduation');
            }
          }}
          options={[
            { value: 'volume', label: 'Volume' },
            { value: 'net_mass', label: 'Masse NETTE' },
            { value: 'gross_mass', label: 'Masse BRUTE' },
            { value: 'mechanical', label: 'Mécanique' },
          ]}
        />
        <SelectField
          label="Unité machine"
          value={form.machineUnit}
          onChange={(value) => update('machineUnit', value)}
          options={[
            { value: 'mL', label: 'mL' },
            { value: 'g', label: 'g' },
            { value: 'graduation', label: 'graduation' },
            { value: 'turn', label: 'tour' },
            { value: 'mm', label: 'mm' },
            { value: 's', label: 'seconde' },
          ]}
        />
        <DecimalField label="Résolution" value={form.resolution} onChange={(e) => update('resolution', e.target.value)} unit={form.machineUnit} />
        <DecimalField label="Minimum" value={form.minimum} onChange={(e) => update('minimum', e.target.value)} unit={form.machineUnit} />
        <DecimalField label="Maximum" value={form.maximum} onChange={(e) => update('maximum', e.target.value)} unit={form.machineUnit} />
        <SelectField
          label="Politique d’arrondi"
          value={form.roundingPolicy}
          onChange={(value) => update('roundingPolicy', value)}
          options={[
            { value: 'nearest_half_up', label: 'Au plus proche, demi vers le haut' },
            { value: 'nearest_half_even', label: 'Au plus proche, demi pair' },
            { value: 'up', label: 'Vers +∞' },
            { value: 'down', label: 'Vers −∞' },
            { value: 'toward_zero', label: 'Vers zéro' },
            { value: 'away_from_zero', label: 'À l’opposé de zéro' },
          ]}
        />
        <SelectField
          label="Sens d’augmentation"
          value={form.increaseDirection}
          onChange={(value) => update('increaseDirection', value)}
          options={[
            { value: 'higher_value', label: 'Valeur plus élevée' },
            { value: 'lower_value', label: 'Valeur plus basse' },
            { value: 'clockwise', label: 'Sens horaire' },
            { value: 'counterclockwise', label: 'Sens antihoraire' },
          ]}
        />
        <TextField label="Source machine" value={form.machineSource} onChange={(value) => update('machineSource', value)} required={form.status === 'verified_by_me'} />
      </FormSection>

      <FormSection title="Produit" description="La valeur appelée densité doit être une masse volumique en g/mL.">
        <TextField label="Article / SKU" value={form.productSku} onChange={(value) => update('productSku', value)} required />
        <TextField label="Désignation" value={form.productName} onChange={(value) => update('productName', value)} required />
        <DecimalField label="Cible approuvée" value={form.targetVolumeMl} onChange={(e) => update('targetVolumeMl', e.target.value)} unit="mL" />
        <DecimalField label="Masse volumique" value={form.densityGPerMl} onChange={(e) => update('densityGPerMl', e.target.value)} unit="g/mL" hint="Une saisie proche de 1019 doit être refusée : vérifier 1,019." />
        <DecimalField label="Plage plausible minimale" value={form.densityPlausibleMinimumGPerMl} onChange={(e) => update('densityPlausibleMinimumGPerMl', e.target.value)} unit="g/mL" hint="Barrière de saisie à confirmer pour cette famille de produit." />
        <DecimalField label="Plage plausible maximale" value={form.densityPlausibleMaximumGPerMl} onChange={(e) => update('densityPlausibleMaximumGPerMl', e.target.value)} unit="g/mL" />
        <DecimalField label="Température de référence" value={form.referenceTemperatureC} onChange={(e) => update('referenceTemperatureC', e.target.value)} unit="°C" />
        <TextField label="Source produit / densité" value={form.productSource} onChange={(value) => update('productSource', value)} required={form.status === 'verified_by_me'} />
      </FormSection>

      <FormSection title="Tube et tare" description="Décrire exactement les composants présents lors de la pesée.">
        <TextField label="Profil tube" value={form.packagingName} onChange={(value) => update('packagingName', value)} required />
        <TextField label="Code format" value={form.formatCode} onChange={(value) => update('formatCode', value)} required />
        <TextField label="Composants inclus" value={form.includedComponents} onChange={(value) => update('includedComponents', value)} required />
        <TextField label="État à la pesée" value={form.weighingState} onChange={(value) => update('weighingState', value)} required />
        <SelectField
          label="Méthode de tare"
          value={form.tareMode}
          onChange={(value) => update('tareMode', value)}
          options={[
            { value: 'fixed', label: 'Fixe / moyenne' },
            { value: 'paired', label: 'Appariée par tube' },
            { value: 'destructive', label: 'Destructive' },
          ]}
        />
        {form.tareMode === 'fixed' ? (
          <>
            <DecimalField label="Tare moyenne" value={form.fixedTareMeanG} onChange={(e) => update('fixedTareMeanG', e.target.value)} unit="g" />
            <DecimalField label="Nombre de tubes tare" value={form.fixedTareSampleSize} onChange={(e) => update('fixedTareSampleSize', e.target.value)} unit="tubes" />
            <DecimalField label="Écart-type tare" value={form.fixedTareStandardDeviationG} onChange={(e) => update('fixedTareStandardDeviationG', e.target.value)} unit="g" hint="Facultatif mais recommandé." />
          </>
        ) : null}
        <TextField label="Source tare" value={form.tareSource} onChange={(value) => update('tareSource', value)} required={form.status === 'verified_by_me'} />
      </FormSection>

      <FormSection title="Plan de démarrage" description="Ces valeurs doivent venir de la procédure applicable, jamais du développeur.">
        <TextField label="Nom du plan" value={form.controlPlanName} onChange={(value) => update('controlPlanName', value)} required />
        <DecimalField label="Taille échantillon" value={form.sampleSize} onChange={(e) => update('sampleSize', e.target.value)} unit="tubes" />
        <SelectField
          label="Base du critère"
          value={form.criterionBasis}
          onChange={(value) => update('criterionBasis', value)}
          options={[
            { value: 'net_mass_g', label: 'Masse NETTE' },
            { value: 'gross_mass_g', label: 'Masse BRUTE' },
            { value: 'volume_ml', label: 'Volume estimé' },
          ]}
        />
        <DecimalField label="Écart moyen inférieur admis" value={form.meanLowerDeviation} onChange={(e) => update('meanLowerDeviation', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} />
        <DecimalField label="Écart moyen supérieur admis" value={form.meanUpperDeviation} onChange={(e) => update('meanUpperDeviation', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} />
        <DecimalField label="Zone sans correction" value={form.correctionDeadband} onChange={(e) => update('correctionDeadband', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} />
        <DecimalField label="Écart-type maximal" value={form.maxStandardDeviation} onChange={(e) => update('maxStandardDeviation', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} hint="Vide si la procédure n’en définit pas." />
        <DecimalField label="Étendue maximale" value={form.maxRange} onChange={(e) => update('maxRange', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} hint="Vide si non applicable." />
        <DecimalField label="Limite individuelle basse" value={form.individualLowerDeviation} onChange={(e) => update('individualLowerDeviation', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} />
        <DecimalField label="Limite individuelle haute" value={form.individualUpperDeviation} onChange={(e) => update('individualUpperDeviation', e.target.value)} unit={form.criterionBasis === 'volume_ml' ? 'mL' : 'g'} />
        <DecimalField label="Nombre maximal hors limites" value={form.maxUnitsOutsideIndividualLimits} onChange={(e) => update('maxUnitsOutsideIndividualLimits', e.target.value)} unit="tubes" />
        <DecimalField label="Correction maximale" value={form.maxCorrectionG} onChange={(e) => update('maxCorrectionG', e.target.value)} unit="g net" />
        <DecimalField label="Itérations maximales" value={form.maxIterations} onChange={(e) => update('maxIterations', e.target.value)} unit="cycles" />
        <TextField label="Source du plan" value={form.controlPlanSource} onChange={(value) => update('controlPlanSource', value)} required={form.status === 'verified_by_me'} />
      </FormSection>

      <FormSection title="Instrument" description="La balance doit être identifiable et utilisable selon la procédure.">
        <TextField label="Balance" value={form.instrumentName} onChange={(value) => update('instrumentName', value)} required />
        <TextField label="Numéro / alias" value={form.instrumentSerialNumber} onChange={(value) => update('instrumentSerialNumber', value)} required />
        <DecimalField label="Résolution" value={form.instrumentResolutionG} onChange={(e) => update('instrumentResolutionG', e.target.value)} unit="g" />
        <DecimalField label="Minimum" value={form.instrumentMinimumG} onChange={(e) => update('instrumentMinimumG', e.target.value)} unit="g" />
        <DecimalField label="Maximum" value={form.instrumentMaximumG} onChange={(e) => update('instrumentMaximumG', e.target.value)} unit="g" />
        <SelectField
          label="Statut de vérification"
          value={form.instrumentVerificationStatus}
          onChange={(value) => update('instrumentVerificationStatus', value)}
          options={[
            { value: 'valid', label: 'Valide' },
            { value: 'unknown', label: 'À confirmer' },
            { value: 'expired', label: 'Expirée' },
            { value: 'failed', label: 'Échec / interdite' },
          ]}
        />
        <label className="block">
          <span className="text-xs font-black uppercase tracking-wide text-slate-600">Valide jusqu’au</span>
          <input type="date" className={fieldClass} value={form.instrumentValidUntil} onChange={(event) => update('instrumentValidUntil', event.target.value)} />
        </label>
        <TextField label="Source instrument" value={form.instrumentSource} onChange={(value) => update('instrumentSource', value)} required={form.status === 'verified_by_me'} />
      </FormSection>

      <div className="sticky bottom-0 z-20 flex flex-col-reverse gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700">
          <X size={18} /> Annuler
        </button>
        <button type="submit" disabled={saving} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-black text-white disabled:opacity-50">
          {form.status === 'verified_by_me' ? <Check size={19} /> : <Save size={19} />}
          {saving ? 'Enregistrement…' : form.status === 'verified_by_me' ? 'Vérifier et enregistrer' : 'Enregistrer le profil'}
        </button>
      </div>
    </form>
  );
}
