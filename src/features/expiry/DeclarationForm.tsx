import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Button } from '../../components/Button';
import type { ConditioningLine } from '../../types/expiry';
import { DECLARATION_LIMITS, type DeclarationDraft, type DeclarationError, type DeclarationKind } from './declaration';
import { browserTimeZone, formatLocalMinute, parseLocalMinute } from './time';

interface Props {
  line: ConditioningLine;
  kind: DeclarationKind;
  onCancel: () => void;
  onDeclare: (draft: DeclarationDraft) => Promise<DeclarationError | null> | DeclarationError | null;
}

export function DeclarationForm({ line, kind, onCancel, onDeclare }: Props) {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<DeclarationDraft>(() => {
    const timeZone = browserTimeZone();
    return { changedAt: formatLocalMinute(new Date(), timeZone), timeZone, occurrence: '', operator: '', vat: line.vat, comment: '' };
  });
  const [error, setError] = useState<DeclarationError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inspection = parseLocalMinute(draft.changedAt, draft.timeZone);
  const candidates = !inspection.ok && inspection.code === 'overlap' ? inspection.candidates : [];
  const helpId = `${id}-time-help`;
  const errorId = `${id}-error`;

  useEffect(() => {
    if (!error) return;
    const control = formRef.current?.elements.namedItem(error.field);
    if (control instanceof HTMLElement) control.focus();
    else summaryRef.current?.focus();
  }, [error]);

  function update(field: keyof DeclarationDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value, ...(field === 'changedAt' ? { occurrence: '' } : {}) }));
    // Errors are announced only after a submission, never on a clock tick or each keystroke.
    setError(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittedRef.current || submitting) return;
    setSubmitting(true);
    try {
      const result = await onDeclare(draft);
      if (result === null) submittedRef.current = true;
      setError(result);
    } finally {
      setSubmitting(false);
    }
  }
  const invalid = (field: DeclarationError['field']) => error?.field === field ? true : undefined;
  const describedBy = (field: DeclarationError['field']) => [field === 'changedAt' ? helpId : '', error?.field === field ? errorId : ''].filter(Boolean).join(' ') || undefined;

  return (
    <form ref={formRef} className="space-y-4" onSubmit={submit} noValidate>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        {kind === 'replacement' ? `Remplacement du bloc de remplissage — ${line.name}`
          : `Matière inchangée : ${line.product}. Cette trace ne prolonge pas la validité du bloc.`}
      </div>
      <p id={helpId} className="break-normal text-sm text-slate-600">
        Fuseau de saisie : <strong>{draft.timeZone || 'indisponible'}</strong>. Déclarez une intervention réalisée,
        pas une planification ni une correction historique. La validité utilise des jours calendaires dans le fuseau de la déclaration.
      </p>
      {error && <div ref={summaryRef} id={errorId} role="alert" tabIndex={-1} className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">{error.message}</div>}
      {kind === 'refill' && <label className="block min-w-0">
        <span className="label">Cuve rechargée</span>
        <input className="field mt-1" name="vat" value={draft.vat} onChange={(event) => update('vat', event.target.value)} required maxLength={DECLARATION_LIMITS.vat} aria-invalid={invalid('vat')} aria-describedby={describedBy('vat')} />
      </label>}
      <label className="block min-w-0">
        <span className="label">{kind === 'replacement' ? 'Date / heure du remplacement' : 'Date / heure'}</span>
        <input className="field mt-1" name="changedAt" type="datetime-local" step={60} value={draft.changedAt} onChange={(event) => update('changedAt', event.target.value)} required aria-invalid={invalid('changedAt')} aria-describedby={describedBy('changedAt')} />
      </label>
      {candidates.length > 1 && <label className="block min-w-0">
        <span className="label">Occurrence de l’heure répétée</span>
        <select className="field mt-1" name="occurrence" value={draft.occurrence} onChange={(event) => update('occurrence', event.target.value)} aria-invalid={invalid('occurrence')} aria-describedby={describedBy('occurrence')} required>
          <option value="">Choisir explicitement</option>
          {candidates.map((candidate) => <option key={candidate.occurrence} value={candidate.occurrence}>
            {candidate.occurrence === 'earlier' ? 'Première occurrence' : 'Seconde occurrence'} (UTC{candidate.offset})
          </option>)}
        </select>
      </label>}
      <label className="block min-w-0">
        <span className="label">Opérateur</span>
        <input className="field mt-1" name="operator" value={draft.operator} onChange={(event) => update('operator', event.target.value)} required maxLength={DECLARATION_LIMITS.operator} autoComplete="name" aria-invalid={invalid('operator')} aria-describedby={describedBy('operator')} />
      </label>
      <div className="block min-w-0">
        <label className="label" htmlFor={`${id}-comment`}>Commentaire</label>
        <textarea id={`${id}-comment`} className="field mt-1 min-h-20" name="comment" value={draft.comment} onChange={(event) => update('comment', event.target.value)} maxLength={DECLARATION_LIMITS.comment} aria-invalid={invalid('comment')} aria-describedby={describedBy('comment')} />
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button className="w-full sm:w-auto" type="button" variant="ghost" onClick={onCancel}>Annuler</Button>
        <Button className="w-full sm:w-auto" type="submit" disabled={submitting}>{submitting ? 'Enregistrement…' : kind === 'replacement' ? 'Valider le remplacement' : 'Tracer la recharge'}</Button>
      </div>
    </form>
  );
}
