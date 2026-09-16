export type PackingPolicy = 'no-overrun' | 'round-carton' | 'round-pallet';

export const MAX_PACKING_UNITS = 1_000_000_000_000;
export const MAX_PACKING_CADENCE_UNITS_PER_MINUTE = 1_000_000_000;
// Keeps projected timestamps below the ECMAScript Date ceiling, including
// contemporary production-start timestamps.
export const MAX_PACKING_DURATION_MINUTES = 100_000_000_000;

export interface PackingInput {
  quantity: number;
  unitsPerCarton: number;
  cartonsPerPalette: number;
}

export interface PackingExactResult {
  unitsPerPalette: number;
  palettesCompletes: number;
  resteApresPalettes: number;
  cartonsComplets: number;
  unitesRestantes: number;
}

export interface PackingOption {
  policy: PackingPolicy;
  label: string;
  palettes: number;
  cartons: number;
  units: number;
  totalPrepared: number;
  variance: number;
}

export interface PackingLoadSummary {
  fullLoadCount: number;
  partialLoadCount: 0 | 1;
  partialLoadCartons: number;
  partialCartonUnits: number;
  totalLoads: number;
  totalCartons: number;
  unitsPerFullLoad: number;
}

export function isPositiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function parsePositiveIntegerInput(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, '');
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return isPositiveInteger(parsed) ? parsed : null;
}

function calculateExactPackingUnchecked(input: PackingInput): PackingExactResult {
  const unitsPerPalette = input.unitsPerCarton * input.cartonsPerPalette;
  const palettesCompletes = Math.floor(input.quantity / unitsPerPalette);
  const resteApresPalettes = input.quantity % unitsPerPalette;
  const cartonsComplets = Math.floor(resteApresPalettes / input.unitsPerCarton);
  const unitesRestantes = resteApresPalettes % input.unitsPerCarton;
  return { unitsPerPalette, palettesCompletes, resteApresPalettes, cartonsComplets, unitesRestantes };
}

export function isValidPackingInput(input: PackingInput): boolean {
  if (!isPositiveInteger(input.quantity) || !isPositiveInteger(input.unitsPerCarton) || !isPositiveInteger(input.cartonsPerPalette) || input.quantity > MAX_PACKING_UNITS) {
    return false;
  }
  const unitsPerPalette = input.unitsPerCarton * input.cartonsPerPalette;
  if (!Number.isSafeInteger(unitsPerPalette)) return false;
  const exact = calculateExactPackingUnchecked(input);
  const cartonCount = exact.unitesRestantes > 0 ? exact.cartonsComplets + 1 : exact.cartonsComplets;
  const completePaletteUnits = exact.palettesCompletes * exact.unitsPerPalette;
  const roundedCartonUnits = cartonCount * input.unitsPerCarton;
  const roundCartonTotal = completePaletteUnits + roundedCartonUnits;
  const paletteCount = exact.resteApresPalettes > 0 ? exact.palettesCompletes + 1 : exact.palettesCompletes;
  const roundPaletteTotal = paletteCount * exact.unitsPerPalette;
  return (
    Number.isSafeInteger(completePaletteUnits) &&
    Number.isSafeInteger(roundedCartonUnits) &&
    Number.isSafeInteger(roundCartonTotal) &&
    Number.isSafeInteger(roundCartonTotal - input.quantity) &&
    Number.isSafeInteger(roundPaletteTotal) && roundPaletteTotal <= MAX_PACKING_UNITS &&
    Number.isSafeInteger(roundPaletteTotal - input.quantity)
  );
}

function assertValidPackingInput(input: PackingInput): void {
  if (!isValidPackingInput(input)) throw new RangeError('Packing input must use positive safe integers with exactly representable derived totals.');
}

function assertValidPackingOption(option: PackingOption): void {
  if (
    !Number.isSafeInteger(option.palettes) || option.palettes < 0 ||
    !Number.isSafeInteger(option.cartons) || option.cartons < 0 ||
    !Number.isSafeInteger(option.units) || option.units < 0 ||
    !Number.isSafeInteger(option.totalPrepared) || option.totalPrepared < 0 ||
    !Number.isSafeInteger(option.variance) || option.variance < 0
  ) {
    throw new RangeError('Packing option must contain non-negative safe integer totals.');
  }
}

export function calculateExactPacking(input: PackingInput): PackingExactResult {
  assertValidPackingInput(input);
  return calculateExactPackingUnchecked(input);
}

export function calculatePackingOptions(input: PackingInput): PackingOption[] {
  assertValidPackingInput(input);
  const exact = calculateExactPackingUnchecked(input);
  const exactOption: PackingOption = {
    policy: 'no-overrun',
    label: 'Sans dépassement',
    palettes: exact.palettesCompletes,
    cartons: exact.cartonsComplets,
    units: exact.unitesRestantes,
    totalPrepared: input.quantity,
    variance: 0,
  };
  const cartonCount = exact.unitesRestantes > 0 ? exact.cartonsComplets + 1 : exact.cartonsComplets;
  const roundCartonTotal = exact.palettesCompletes * exact.unitsPerPalette + cartonCount * input.unitsPerCarton;
  const roundCartonOption: PackingOption = {
    policy: 'round-carton',
    label: 'Carton complet',
    palettes: exact.palettesCompletes,
    cartons: cartonCount,
    units: 0,
    totalPrepared: roundCartonTotal,
    variance: roundCartonTotal - input.quantity,
  };
  const paletteCount = exact.resteApresPalettes > 0 ? exact.palettesCompletes + 1 : exact.palettesCompletes;
  const roundPaletteTotal = paletteCount * exact.unitsPerPalette;
  const roundPaletteOption: PackingOption = {
    policy: 'round-pallet',
    label: 'Palette complète',
    palettes: paletteCount,
    cartons: 0,
    units: 0,
    totalPrepared: roundPaletteTotal,
    variance: roundPaletteTotal - input.quantity,
  };
  return [exactOption, roundCartonOption, roundPaletteOption];
}

export function getPackingRecommendation(options: PackingOption[]): PackingOption {
  const exact = options.find((option) => option.policy === 'no-overrun') ?? options[0];
  const carton = options.find((option) => option.policy === 'round-carton') ?? exact;
  if (carton.variance === 0) return exact;
  return carton;
}

export function summarizePackingLoads(input: PackingInput, option: PackingOption): PackingLoadSummary {
  assertValidPackingInput(input);
  assertValidPackingOption(option);
  if (option.units >= input.unitsPerCarton) throw new RangeError('Packing option units must fit inside one partial carton.');

  const unitsPerFullLoad = input.unitsPerCarton * input.cartonsPerPalette;
  const extraFullLoads = Math.floor(option.cartons / input.cartonsPerPalette);
  const partialLoadCartons = option.cartons % input.cartonsPerPalette;
  const fullLoadCount = option.palettes + extraFullLoads;
  const remainderUnits = partialLoadCartons * input.unitsPerCarton + option.units;
  const partialLoadCount: 0 | 1 = remainderUnits > 0 ? 1 : 0;
  const totalLoads = fullLoadCount + partialLoadCount;
  const totalCartons = fullLoadCount * input.cartonsPerPalette + partialLoadCartons + (option.units > 0 ? 1 : 0);
  const representedUnits = fullLoadCount * unitsPerFullLoad + remainderUnits;

  if (
    !Number.isSafeInteger(extraFullLoads) ||
    !Number.isSafeInteger(fullLoadCount) ||
    !Number.isSafeInteger(remainderUnits) ||
    !Number.isSafeInteger(totalLoads) ||
    !Number.isSafeInteger(totalCartons) ||
    !Number.isSafeInteger(representedUnits) ||
    representedUnits !== option.totalPrepared
  ) {
    throw new RangeError('Packing option cannot be summarized into physical loads exactly.');
  }

  return {
    fullLoadCount,
    partialLoadCount,
    partialLoadCartons,
    partialCartonUnits: option.units,
    totalLoads,
    totalCartons,
    unitsPerFullLoad,
  };
}
