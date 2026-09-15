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

export function parsePackingProductionStart(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const parsed = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day ||
    parsed.getHours() !== hour ||
    parsed.getMinutes() !== minute
  ) return null;
  return parsed;
}

function validateStart(value: string): PackingPreparationFieldValidation {
  if (value.trim() === '') return { state: 'empty', message: 'Valeur obligatoire.' };
  if (!parsePackingProductionStart(value)) {
    return { state: 'invalid', message: 'Choisissez une date et une heure valides.' };
  }
  return { state: 'valid', message: null };
}

export function validatePackingPreparation(
  values: PackingPreparationValues,
  selectedPolicy: PackingPolicy | null,
): PackingPreparationValidation {
  const fields = {
    quantity: validatePositiveInteger(values.quantity),
    unitsPerCarton: validatePositiveInteger(values.unitsPerCarton),
    cartonsPerPalette: validatePositiveInteger(values.cartonsPerPalette),
    productionStartTime: validateStart(values.productionStartTime),
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
