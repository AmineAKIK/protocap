export type PackingPolicy = 'no-overrun' | 'round-carton' | 'round-pallet';

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

  return {
    unitsPerPalette,
    palettesCompletes,
    resteApresPalettes,
    cartonsComplets,
    unitesRestantes
  };
}

export function isValidPackingInput(input: PackingInput): boolean {
  if (
    !isPositiveInteger(input.quantity) ||
    !isPositiveInteger(input.unitsPerCarton) ||
    !isPositiveInteger(input.cartonsPerPalette)
  ) {
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
    Number.isSafeInteger(roundPaletteTotal) &&
    Number.isSafeInteger(roundPaletteTotal - input.quantity)
  );
}

function assertValidPackingInput(input: PackingInput): void {
  if (!isValidPackingInput(input)) {
    throw new RangeError('Packing input must use positive safe integers with exactly representable derived totals.');
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
    label: 'Exact, sans dépassement',
    palettes: exact.palettesCompletes,
    cartons: exact.cartonsComplets,
    units: exact.unitesRestantes,
    totalPrepared: input.quantity,
    variance: 0
  };

  const cartonCount = exact.unitesRestantes > 0 ? exact.cartonsComplets + 1 : exact.cartonsComplets;
  const roundCartonTotal = exact.palettesCompletes * exact.unitsPerPalette + cartonCount * input.unitsPerCarton;
  const roundCartonOption: PackingOption = {
    policy: 'round-carton',
    label: 'Arrondi au carton supérieur',
    palettes: exact.palettesCompletes,
    cartons: cartonCount,
    units: 0,
    totalPrepared: roundCartonTotal,
    variance: roundCartonTotal - input.quantity
  };

  const paletteCount = exact.resteApresPalettes > 0 ? exact.palettesCompletes + 1 : exact.palettesCompletes;
  const roundPaletteTotal = paletteCount * exact.unitsPerPalette;
  const roundPaletteOption: PackingOption = {
    policy: 'round-pallet',
    label: 'Arrondi à la palette supérieure',
    palettes: paletteCount,
    cartons: 0,
    units: 0,
    totalPrepared: roundPaletteTotal,
    variance: roundPaletteTotal - input.quantity
  };

  return [exactOption, roundCartonOption, roundPaletteOption];
}

export function getPackingRecommendation(options: PackingOption[]): PackingOption {
  const exact = options.find((option) => option.policy === 'no-overrun') ?? options[0];
  const carton = options.find((option) => option.policy === 'round-carton') ?? exact;

  if (carton.variance === 0) return exact;
  return carton;
}
