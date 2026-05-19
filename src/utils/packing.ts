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
  return Number.isFinite(value) && Number.isInteger(value) && value > 0;
}

export function parsePositiveIntegerInput(value: string): number | null {
  const normalized = value.replace(/[\s\u00a0\u202f]/g, '');
  if (!/^\d+$/.test(normalized)) return null;

  const parsed = Number(normalized);
  return isPositiveInteger(parsed) ? parsed : null;
}

export function isValidPackingInput(input: PackingInput): boolean {
  return (
    isPositiveInteger(input.quantity) &&
    isPositiveInteger(input.unitsPerCarton) &&
    isPositiveInteger(input.cartonsPerPalette)
  );
}

export function calculateExactPacking(input: PackingInput): PackingExactResult {
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

export function calculatePackingOptions(input: PackingInput): PackingOption[] {
  const exact = calculateExactPacking(input);
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

export function getPackingRecommendation(options: PackingOption[], policy: PackingPolicy, unitsPerCarton: number): PackingOption {
  const exact = options.find((option) => option.policy === 'no-overrun') ?? options[0];
  const carton = options.find((option) => option.policy === 'round-carton') ?? exact;

  if (policy === 'no-overrun') return exact;

  const lowCartonOverrun = carton.variance > 0 && carton.variance <= Math.ceil(unitsPerCarton / 2);
  return lowCartonOverrun ? carton : exact;
}
