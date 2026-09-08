import {
  isValidPackingInput,
  type PackingInput,
  type PackingOption,
} from './packing';

export type PackingShipmentLoadKind = 'full-pallet' | 'remainder';

export interface PackingShipmentLoad {
  index: number;
  kind: PackingShipmentLoadKind;
  cartons: number;
  looseUnits: number;
  totalUnits: number;
}

export interface PackingShipmentPlan {
  fullLoadCount: number;
  remainderLoad: Omit<PackingShipmentLoad, 'index'> | null;
  totalLoads: number;
  totalUnits: number;
  cartonsPerFullLoad: number;
  unitsPerFullLoad: number;
}

export interface PackingShipmentProgress {
  shippedLoads: number;
  remainingLoads: number;
  shippedUnits: number;
  remainingUnits: number;
  loadProgressRatio: number;
  unitProgressRatio: number;
  nextLoad: PackingShipmentLoad | null;
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function assertValidPackingOption(option: PackingOption): void {
  if (
    !isNonNegativeSafeInteger(option.palettes) ||
    !isNonNegativeSafeInteger(option.cartons) ||
    !isNonNegativeSafeInteger(option.units) ||
    !isNonNegativeSafeInteger(option.totalPrepared) ||
    !isNonNegativeSafeInteger(option.variance)
  ) {
    throw new RangeError('Packing option must contain non-negative safe integer totals.');
  }
}

/**
 * Build the physical shipment plan without allocating one object per pallet.
 *
 * Complete pallets are represented first. Cartons that fill an additional complete
 * pallet are normalized into that complete-load count. At most one final physical
 * pallet then carries the remaining cartons and/or loose units.
 */
export function createPackingShipmentPlan(
  input: PackingInput,
  option: PackingOption,
): PackingShipmentPlan {
  if (!isValidPackingInput(input)) {
    throw new RangeError('Packing shipment input must be a valid packing input.');
  }
  assertValidPackingOption(option);

  const unitsPerFullLoad = input.unitsPerCarton * input.cartonsPerPalette;
  const extraFullLoads = Math.floor(option.cartons / input.cartonsPerPalette);
  const remainderCartons = option.cartons % input.cartonsPerPalette;
  const fullLoadCount = option.palettes + extraFullLoads;
  const remainderUnits = remainderCartons * input.unitsPerCarton + option.units;

  if (
    option.units >= input.unitsPerCarton ||
    !Number.isSafeInteger(extraFullLoads) ||
    !Number.isSafeInteger(fullLoadCount) ||
    !Number.isSafeInteger(remainderUnits)
  ) {
    throw new RangeError('Packing option cannot be normalized into physical shipment loads.');
  }

  const hasRemainder = remainderUnits > 0;
  const totalLoads = fullLoadCount + (hasRemainder ? 1 : 0);
  const fullLoadUnits = fullLoadCount * unitsPerFullLoad;
  const totalUnits = fullLoadUnits + remainderUnits;

  if (
    !Number.isSafeInteger(totalLoads) ||
    !Number.isSafeInteger(fullLoadUnits) ||
    !Number.isSafeInteger(totalUnits) ||
    totalUnits !== option.totalPrepared
  ) {
    throw new RangeError('Packing shipment plan is inconsistent with the selected packing option.');
  }

  return {
    fullLoadCount,
    remainderLoad: hasRemainder
      ? {
          kind: 'remainder',
          cartons: remainderCartons,
          looseUnits: option.units,
          totalUnits: remainderUnits,
        }
      : null,
    totalLoads,
    totalUnits,
    cartonsPerFullLoad: input.cartonsPerPalette,
    unitsPerFullLoad,
  };
}

export function getPackingShipmentLoad(
  plan: PackingShipmentPlan,
  index: number,
): PackingShipmentLoad | null {
  if (!Number.isSafeInteger(index) || index < 0 || index >= plan.totalLoads) return null;

  if (index < plan.fullLoadCount) {
    return {
      index,
      kind: 'full-pallet',
      cartons: plan.cartonsPerFullLoad,
      looseUnits: 0,
      totalUnits: plan.unitsPerFullLoad,
    };
  }

  if (!plan.remainderLoad) return null;
  return { index, ...plan.remainderLoad };
}

function normalizeShippedLoads(value: number, totalLoads: number): number {
  if (!Number.isSafeInteger(value)) return 0;
  return Math.min(totalLoads, Math.max(0, value));
}

/**
 * Calculate operational load progress and exact unit-volume progress separately.
 *
 * Unit progress is exact under this plan's deterministic order: complete pallets
 * first, final remainder load last. If a future UI permits out-of-order selection,
 * it must track load identity rather than reuse this sequential-counter contract.
 */
export function getPackingShipmentProgress(
  plan: PackingShipmentPlan,
  shippedLoadsValue: number,
): PackingShipmentProgress {
  const shippedLoads = normalizeShippedLoads(shippedLoadsValue, plan.totalLoads);
  const shippedFullLoads = Math.min(shippedLoads, plan.fullLoadCount);
  const remainderShipped = Boolean(plan.remainderLoad) && shippedLoads > plan.fullLoadCount;
  const shippedFullUnits = shippedFullLoads * plan.unitsPerFullLoad;
  const shippedRemainderUnits = remainderShipped && plan.remainderLoad
    ? plan.remainderLoad.totalUnits
    : 0;
  const shippedUnits = shippedFullUnits + shippedRemainderUnits;

  if (!Number.isSafeInteger(shippedFullUnits) || !Number.isSafeInteger(shippedUnits)) {
    throw new RangeError('Packing shipment progress exceeds exact integer range.');
  }

  const remainingLoads = plan.totalLoads - shippedLoads;
  const remainingUnits = plan.totalUnits - shippedUnits;
  const loadProgressRatio = plan.totalLoads === 0 ? 1 : shippedLoads / plan.totalLoads;
  const unitProgressRatio = plan.totalUnits === 0 ? 1 : shippedUnits / plan.totalUnits;

  return {
    shippedLoads,
    remainingLoads,
    shippedUnits,
    remainingUnits,
    loadProgressRatio,
    unitProgressRatio,
    nextLoad: getPackingShipmentLoad(plan, shippedLoads),
  };
}
