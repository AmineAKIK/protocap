import { Temporal } from '@js-temporal/polyfill';

/** Compatibility rule: calendar days in the declaration's zone, not days * 24 hours. */
export const CALENDAR_DAYS_RULE = 'calendar-days-v1';
export type Occurrence = '' | 'earlier' | 'later';
export interface LocalCandidate { occurrence: Exclude<Occurrence, ''>; instant: string; offset: string }
export type LocalTimeResult =
  | { ok: true; instant: string; timeZone: string }
  | { ok: false; code: 'invalid' | 'zone' | 'gap' | 'overlap'; message: string; candidates: LocalCandidate[] };

const localMinutePattern = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const instantPattern = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

/** Stored instants need an explicit offset and a real ISO calendar; Date.parse is too permissive. */
export function instantMilliseconds(value: unknown): number | null {
  if (typeof value !== 'string' || !instantPattern.test(value)) return null;
  try {
    const result = Temporal.Instant.from(value).epochMilliseconds;
    return Number.isFinite(result) ? result : null;
  } catch { return null; }
}

export function isNamedTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 100 || /^[+-]/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(value);
    return true;
  } catch { return false; }
}

export function browserTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; }
}

export function formatLocalMinute(date: Date, timeZone: string): string {
  if (!Number.isFinite(date.getTime()) || !isNamedTimeZone(timeZone)) return '';
  const local = Temporal.Instant.fromEpochMilliseconds(date.getTime()).toZonedDateTimeISO(timeZone).toPlainDateTime();
  if (local.year < 1 || local.year > 9999) return '';
  return local.toString({ smallestUnit: 'minute' });
}

/** Temporal owns all zone transitions; this adapter only exposes the two documented resolutions. */
export function parseLocalMinute(value: unknown, timeZone: unknown, occurrence: unknown = ''): LocalTimeResult {
  const fail = (code: 'invalid' | 'zone' | 'gap' | 'overlap', message: string, candidates: LocalCandidate[] = []): LocalTimeResult => ({ ok: false, code, message, candidates });
  if (!isNamedTimeZone(timeZone)) return fail('zone', 'Fuseau indisponible ou non reconnu. Aucune date ne peut être enregistrée.');
  if (typeof value !== 'string' || !localMinutePattern.test(value) || !['', 'earlier', 'later'].includes(String(occurrence))) {
    return fail('invalid', 'Renseignez une date et une heure valides, à la minute près.');
  }
  try {
    const local = Temporal.PlainDateTime.from(value, { overflow: 'reject' });
    const earlier = local.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
    const later = local.toZonedDateTime(timeZone, { disambiguation: 'later' });
    if (!earlier.toPlainDateTime().equals(local) || !later.toPlainDateTime().equals(local)) {
      return fail('gap', 'Cette heure locale n’existe pas dans ce fuseau lors du changement d’heure. Corrigez la saisie.');
    }
    const serialize = (zoned: Temporal.ZonedDateTime) => zoned.toInstant().toString({ smallestUnit: 'millisecond' });
    if (earlier.epochNanoseconds !== later.epochNanoseconds && occurrence === '') {
      return fail('overlap', 'Cette heure existe deux fois. Choisissez explicitement son décalage UTC.', [
        { occurrence: 'earlier', instant: serialize(earlier), offset: earlier.offset },
        { occurrence: 'later', instant: serialize(later), offset: later.offset },
      ]);
    }
    return { ok: true, instant: serialize(occurrence === 'later' ? later : earlier), timeZone };
  } catch { return fail('invalid', 'Date hors plage ou calendrier invalide. Aucune donnée n’a été modifiée.'); }
}

/** The expiry boundary follows Date.setDate's compatible DST behavior, explicitly versioned. */
export function addCalendarDays(instant: string, days: number, timeZone: string): string {
  if (instantMilliseconds(instant) === null || !Number.isSafeInteger(days) || days <= 0 || !isNamedTimeZone(timeZone)) {
    throw new RangeError('Invalid calendar-day validity input.');
  }
  const result = Temporal.Instant.from(instant).toZonedDateTimeISO(timeZone).add({ days }, { overflow: 'reject' });
  if (result.year < 1 || result.year > 9999) throw new RangeError('Expiry outside the supported four-digit calendar.');
  return result.toInstant().toString({ smallestUnit: 'millisecond' });
}

export function formatStoredTime(value: string): string {
  const milliseconds = instantMilliseconds(value);
  if (milliseconds === null) return 'Date à vérifier';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(milliseconds));
}
