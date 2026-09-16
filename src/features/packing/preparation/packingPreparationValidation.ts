import { isValidPackingInput, MAX_PACKING_CADENCE_UNITS_PER_MINUTE, MAX_PACKING_UNITS, parsePositiveIntegerInput, type PackingInput, type PackingPolicy } from '../../../utils/packing';

export type PackingPreparationField =
  | 'quantity'
  | 'unitsPerCarton'
  | 'cartonsPerPalette'
  | 'productionStartTime'
  | 'referenceCadence';

export type PackingPreparationFieldState = 'empty' | 'invalid' | 'valid';

export interface PackingPreparationValues {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
  productionStartTime: string;
  referenceCadence: string;
}

export interface PackingPreparationFieldValidation {
  state: PackingPreparationFieldState;
  message: string | null;
}

export interface PackingPreparationValidation {
  fields: Record<PackingPreparationField, PackingPreparationFieldValidation>;
  input: PackingInput | null;
  combinationInvalid: boolean;
  canLaunch: boolean;
  launchGuidance: string | null;
}

interface LocalDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

type TimezoneOffsetResolver = (epochMs: number) => number;

const fieldLabels: Record<PackingPreparationField, string> = {
  quantity: 'Quantité demandée',
  unitsPerCarton: 'Unités par carton',
  cartonsPerPalette: 'Cartons par palette',
  productionStartTime: 'Début OC',
  referenceCadence: 'Cadence réf.',
};

function validatePositiveInteger(value: string, maximum?: number): PackingPreparationFieldValidation {
  if (value.trim() === '') return { state: 'empty', message: 'Valeur obligatoire.' };
  const parsed = parsePositiveIntegerInput(value);
  if (parsed === null) {
    return { state: 'invalid', message: 'Saisissez un entier supérieur à 0.' };
  }
  if (maximum !== undefined && parsed > maximum) {
    return { state: 'invalid', message: `La valeur maximale autorisée est ${new Intl.NumberFormat('fr-FR').format(maximum)}.` };
  }
  return { state: 'valid', message: null };
}

function parseLocalDateTimeParts(value: string): LocalDateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const parts = {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
  const calendarCheck = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute));
  if (
    calendarCheck.getUTCFullYear() !== parts.year ||
    calendarCheck.getUTCMonth() !== parts.month - 1 ||
    calendarCheck.getUTCDate() !== parts.day ||
    calendarCheck.getUTCHours() !== parts.hour ||
    calendarCheck.getUTCMinutes() !== parts.minute
  ) return null;
  return parts;
}

function browserTimezoneOffset(epochMs: number): number {
  return new Date(epochMs).getTimezoneOffset();
}

function resolveLocalDateTime(
  value: string,
  getTimezoneOffset: TimezoneOffsetResolver,
): { date: Date | null; ambiguous: boolean } | null {
  const parts = parseLocalDateTimeParts(value);
  if (!parts) return null;

  const wallClockUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    const offset = getTimezoneOffset(wallClockUtc + hours * 60 * 60 * 1000);
    if (Number.isFinite(offset)) offsets.add(offset);
  }

  const candidates = Array.from(offsets)
    .map((offsetMinutes) => wallClockUtc + offsetMinutes * 60_000)
    .filter((candidateMs) => getTimezoneOffset(candidateMs) === (candidateMs - wallClockUtc) / 60_000);

  const uniqueCandidates = Array.from(new Set(candidates));
  if (uniqueCandidates.length === 0) return { date: null, ambiguous: false };
  if (uniqueCandidates.length > 1) return { date: null, ambiguous: true };
  return { date: new Date(uniqueCandidates[0]), ambiguous: false };
}

export function parsePackingProductionStart(
  value: string,
  getTimezoneOffset: TimezoneOffsetResolver = browserTimezoneOffset,
): Date | null {
  const parsed = resolveLocalDateTime(value, getTimezoneOffset);
  return parsed && !parsed.ambiguous ? parsed.date : null;
}

function validateStart(value: string, now: Date): PackingPreparationFieldValidation {
  if (value.trim() === '') return { state: 'empty', message: 'Valeur obligatoire.' };
  const parsed = resolveLocalDateTime(value, browserTimezoneOffset);
  if (!parsed || (!parsed.date && !parsed.ambiguous)) {
    return { state: 'invalid', message: 'Choisissez une date et une heure valides.' };
  }
  if (parsed.ambiguous) {
    return { state: 'invalid', message: 'Cette heure est ambiguë lors du changement d’heure. Choisissez une heure non ambiguë.' };
  }
  if (!parsed.date || !Number.isFinite(now.getTime())) {
    return { state: 'invalid', message: 'Impossible de vérifier l’heure de début. Réessayez.' };
  }
  if (parsed.date.getTime() > now.getTime()) {
    return { state: 'invalid', message: 'Le début OC ne peut pas être dans le futur.' };
  }
  return { state: 'valid', message: null };
}

export function validatePackingPreparation(
  values: PackingPreparationValues,
  selectedPolicy: PackingPolicy | null,
  now: Date = new Date(),
): PackingPreparationValidation {
  const fields = {
    quantity: validatePositiveInteger(values.quantity, MAX_PACKING_UNITS),
    unitsPerCarton: validatePositiveInteger(values.unitsPerCarton),
    cartonsPerPalette: validatePositiveInteger(values.cartonsPerPalette),
    productionStartTime: validateStart(values.productionStartTime, now),
    referenceCadence: validatePositiveInteger(values.referenceCadence, MAX_PACKING_CADENCE_UNITS_PER_MINUTE),
  } satisfies Record<PackingPreparationField, PackingPreparationFieldValidation>;

  let input: PackingInput | null = null;
  if (
    fields.quantity.state === 'valid' &&
    fields.unitsPerCarton.state === 'valid' &&
    fields.cartonsPerPalette.state === 'valid'
  ) {
    const candidate = {
      quantity: parsePositiveIntegerInput(values.quantity)!,
      unitsPerCarton: parsePositiveIntegerInput(values.unitsPerCarton)!,
      cartonsPerPalette: parsePositiveIntegerInput(values.cartonsPerPalette)!,
    };
    input = isValidPackingInput(candidate) ? candidate : null;
  }

  const combinationInvalid =
    fields.quantity.state === 'valid' &&
    fields.unitsPerCarton.state === 'valid' &&
    fields.cartonsPerPalette.state === 'valid' &&
    input === null;

  const invalidFields = (Object.keys(fields) as PackingPreparationField[])
    .filter((field) => fields[field].state === 'invalid')
    .map((field) => fieldLabels[field]);
  const emptyFields = (Object.keys(fields) as PackingPreparationField[])
    .filter((field) => fields[field].state === 'empty')
    .map((field) => fieldLabels[field]);

  let launchGuidance: string | null = null;
  if (combinationInvalid) {
    launchGuidance = 'Vérifiez les paramètres saisis avant de lancer le suivi.';
  } else if (invalidFields.length > 0) {
    launchGuidance = `Corrigez : ${invalidFields.join(' · ')}`;
  } else if (emptyFields.length > 0) {
    launchGuidance = `À compléter : ${emptyFields.join(' · ')}`;
  } else if (!selectedPolicy) {
    launchGuidance = 'Choisissez une stratégie de conditionnement pour lancer le suivi.';
  }

  return {
    fields,
    input,
    combinationInvalid,
    canLaunch: Boolean(input && selectedPolicy && fields.productionStartTime.state === 'valid' && fields.referenceCadence.state === 'valid'),
    launchGuidance,
  };
}
