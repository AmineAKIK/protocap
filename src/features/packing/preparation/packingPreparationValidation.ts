import { isValidPackingInput, parsePositiveIntegerInput, type PackingInput, type PackingPolicy } from '../../../utils/packing';

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

const fieldLabels: Record<PackingPreparationField, string> = {
  quantity: 'Quantité demandée',
  unitsPerCarton: 'Unités par carton',
  cartonsPerPalette: 'Cartons par palette',
  productionStartTime: 'Début OC',
  referenceCadence: 'Cadence réf.',
};

function validatePositiveInteger(value: string): PackingPreparationFieldValidation {
  if (value.trim() === '') return { state: 'empty', message: 'Valeur obligatoire.' };
  if (parsePositiveIntegerInput(value) === null) {
    return { state: 'invalid', message: 'Saisissez un entier supérieur à 0.' };
  }
  return { state: 'valid', message: null };
}

function parseLocalDateTimeParts(value: string): LocalDateTimeParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  return {
    year: Number(yearText),
    month: Number(monthText),
    day: Number(dayText),
    hour: Number(hourText),
    minute: Number(minuteText),
  };
}

function matchesLocalParts(date: Date, parts: LocalDateTimeParts): boolean {
  return (
    date.getFullYear() === parts.year &&
    date.getMonth() === parts.month - 1 &&
    date.getDate() === parts.day &&
    date.getHours() === parts.hour &&
    date.getMinutes() === parts.minute
  );
}

function parseUnambiguousLocalDateTime(value: string): { date: Date; ambiguous: boolean } | null {
  const parts = parseLocalDateTimeParts(value);
  if (!parts) return null;
  const parsed = new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  if (!Number.isFinite(parsed.getTime()) || !matchesLocalParts(parsed, parts)) return null;

  const wallClockUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
  const offsets = new Set<number>();
  for (const hours of [-36, -24, -12, 0, 12, 24, 36]) {
    offsets.add(new Date(parsed.getTime() + hours * 60 * 60 * 1000).getTimezoneOffset());
  }
  const ambiguous = Array.from(offsets).some((offsetMinutes) => {
    const candidate = new Date(wallClockUtc + offsetMinutes * 60_000);
    return candidate.getTime() !== parsed.getTime() && matchesLocalParts(candidate, parts);
  });

  return { date: parsed, ambiguous };
}

export function parsePackingProductionStart(value: string): Date | null {
  const parsed = parseUnambiguousLocalDateTime(value);
  return parsed && !parsed.ambiguous ? parsed.date : null;
}

function validateStart(value: string, now: Date): PackingPreparationFieldValidation {
  if (value.trim() === '') return { state: 'empty', message: 'Valeur obligatoire.' };
  const parsed = parseUnambiguousLocalDateTime(value);
  if (!parsed) {
    return { state: 'invalid', message: 'Choisissez une date et une heure valides.' };
  }
  if (parsed.ambiguous) {
    return { state: 'invalid', message: 'Cette heure est ambiguë lors du changement d’heure. Choisissez une heure non ambiguë.' };
  }
  if (!Number.isFinite(now.getTime())) {
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
    quantity: validatePositiveInteger(values.quantity),
    unitsPerCarton: validatePositiveInteger(values.unitsPerCarton),
    cartonsPerPalette: validatePositiveInteger(values.cartonsPerPalette),
    productionStartTime: validateStart(values.productionStartTime, now),
    referenceCadence: validatePositiveInteger(values.referenceCadence),
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
