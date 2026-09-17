import type { ChangeHistoryEntry, ConditioningLine } from '../../types/expiry';
import { earliestExpiry, getLineStatus, latestChange } from '../../utils/expiry';
import { addCalendarDays, CALENDAR_DAYS_RULE, instantMilliseconds, parseLocalMinute } from './time';

export const DECLARATION_LIMITS = { operator: 120, vat: 120, comment: 1000 } as const;
export type DeclarationKind = 'replacement' | 'refill';
export interface DeclarationDraft {
  changedAt: string;
  timeZone: string;
  occurrence: string;
  operator: string;
  vat: string;
  comment: string;
}
export interface DeclarationError {
  field: 'changedAt' | 'occurrence' | 'operator' | 'vat' | 'comment' | 'form';
  message: string;
}
export type PreparedDeclaration =
  | { ok: false; error: DeclarationError }
  | { ok: true; lines: ConditioningLine[]; entry: ChangeHistoryEntry };

/** No writes, clock reads or hidden fallback: prepare and validate everything before the caller mutates. */
export function prepareDeclaration(
  lines: readonly ConditioningLine[], lineId: string, kind: DeclarationKind,
  draft: DeclarationDraft, now: Date, id: string,
): PreparedDeclaration {
  const fail = (field: DeclarationError['field'], message: string): PreparedDeclaration => ({ ok: false, error: { field, message } });
  if (!Number.isFinite(now.getTime()) || !id.trim() || !['replacement', 'refill'].includes(kind)) return fail('form', 'Déclaration impossible : contexte invalide.');
  const matches = lines.filter((line) => line.id === lineId);
  const line = matches[0];
  if (matches.length !== 1 || getLineStatus(line, now) === 'unknown') {
    return fail('form', 'Les données du bloc sont à vérifier. Une nouvelle déclaration ne doit pas corriger silencieusement son historique.');
  }
  const parsed = parseLocalMinute(draft.changedAt, draft.timeZone, draft.occurrence);
  if (!parsed.ok) return fail(parsed.code === 'overlap' ? 'occurrence' : 'changedAt', parsed.message);
  const changedAt = instantMilliseconds(parsed.instant)!;
  if (changedAt > now.getTime()) return fail('changedAt', 'Une intervention future ne peut pas être déclarée comme réalisée.');
  if (changedAt < instantMilliseconds(latestChange(line))!) {
    return fail('changedAt', 'La date précède le remplacement actif. Une correction historique doit être traitée séparément.');
  }
  for (const field of ['operator', 'comment', ...(kind === 'refill' ? ['vat'] as const : [])] as const) {
    const value = draft[field];
    if (typeof value !== 'string' || value.length > DECLARATION_LIMITS[field]
      || (field !== 'comment' && !value.trim()) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) {
      return fail(field, field === 'comment' ? 'Commentaire invalide ou trop long (1 000 caractères maximum).'
        : field === 'operator' ? 'Renseignez un opérateur (120 caractères maximum, pas seulement des espaces).'
          : 'Renseignez la référence de cuve (120 caractères maximum, pas seulement des espaces).');
    }
  }
  if (kind === 'refill' && (getLineStatus(line, now) === 'nonConform' || changedAt >= instantMilliseconds(earliestExpiry(line))!)) {
    return fail('changedAt', 'Le bloc est expiré. Déclarez un remplacement avant une nouvelle recharge.');
  }
  const operator = draft.operator.trim();
  const comment = draft.comment.trim();
  const previousExpiresAt = earliestExpiry(line);
  let updated: ConditioningLine;
  let newExpiresAt = previousExpiresAt;
  try {
    if (kind === 'replacement') {
      const elements = line.elements.map((element) => ({
        ...element, lastChangedAt: parsed.instant,
        expiresAt: addCalendarDays(parsed.instant, element.validityDays, parsed.timeZone),
        operator, comment, timeZone: parsed.timeZone, validityRule: CALENDAR_DAYS_RULE,
      }));
      updated = { ...line, elements };
      newExpiresAt = earliestExpiry(updated);
    } else { updated = { ...line, vat: draft.vat.trim() }; }
  } catch { return fail('changedAt', 'La date limite calculée est hors plage. Aucune donnée n’a été modifiée.'); }
  const entry: ChangeHistoryEntry = {
    id, lineId: line.id, lineName: line.name,
    elementLabel: kind === 'replacement' ? 'Bloc de remplissage' : 'Recharge de cuve - même matière',
    changedAt: parsed.instant, operator, comment, previousExpiresAt, newExpiresAt,
    timeZone: parsed.timeZone,
    ...(kind === 'replacement' ? { validityRule: CALENDAR_DAYS_RULE } : {}),
  };
  return { ok: true, lines: lines.map((current) => current.id === lineId ? updated : current), entry };
}
