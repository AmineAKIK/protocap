import { describe, expect, it } from 'vitest';
import { calculatePackingOptions, type PackingInput, type PackingOption } from './packing';
import {
  createPackingShipmentPlan,
  getPackingShipmentLoad,
  getPackingShipmentProgress,
} from './packingShipment';

const referenceInput: PackingInput = {
  quantity: 30_880,
  unitsPerCarton: 128,
  cartonsPerPalette: 40,
};

function option(policy: PackingOption['policy']) {
  return calculatePackingOptions(referenceInput).find((candidate) => candidate.policy === policy)!;
}

describe('packing shipment plans', () => {
  it('models exact packing as complete pallets followed by one remainder load', () => {
    const plan = createPackingShipmentPlan(referenceInput, option('no-overrun'));

    expect(plan).toEqual({
      fullLoadCount: 6,
      remainderLoad: {
        kind: 'remainder',
        cartons: 1,
        looseUnits: 32,
        totalUnits: 160,
      },
      totalLoads: 7,
      totalUnits: 30_880,
      cartonsPerFullLoad: 40,
      unitsPerFullLoad: 5_120,
    });

    expect(getPackingShipmentLoad(plan, 0)).toEqual({
      index: 0,
      kind: 'full-pallet',
      cartons: 40,
      looseUnits: 0,
      totalUnits: 5_120,
    });
    expect(getPackingShipmentLoad(plan, 6)).toEqual({
      index: 6,
      kind: 'remainder',
      cartons: 1,
      looseUnits: 32,
      totalUnits: 160,
    });
    expect(getPackingShipmentLoad(plan, 7)).toBeNull();
  });

  it('models carton rounding as complete pallets plus the exact carton remainder', () => {
    const plan = createPackingShipmentPlan(referenceInput, option('round-carton'));

    expect(plan.fullLoadCount).toBe(6);
    expect(plan.totalLoads).toBe(7);
    expect(plan.totalUnits).toBe(30_976);
    expect(plan.remainderLoad).toEqual({
      kind: 'remainder',
      cartons: 2,
      looseUnits: 0,
      totalUnits: 256,
    });
  });

  it('models pallet rounding using only complete physical loads', () => {
    const plan = createPackingShipmentPlan(referenceInput, option('round-pallet'));

    expect(plan.fullLoadCount).toBe(7);
    expect(plan.totalLoads).toBe(7);
    expect(plan.totalUnits).toBe(35_840);
    expect(plan.remainderLoad).toBeNull();
    expect(getPackingShipmentLoad(plan, 6)).toEqual({
      index: 6,
      kind: 'full-pallet',
      cartons: 40,
      looseUnits: 0,
      totalUnits: 5_120,
    });
  });

  it('preserves total prepared units for every existing packing policy', () => {
    for (const selected of calculatePackingOptions(referenceInput)) {
      const plan = createPackingShipmentPlan(referenceInput, selected);
      const representedUnits =
        plan.fullLoadCount * plan.unitsPerFullLoad + (plan.remainderLoad?.totalUnits ?? 0);

      expect(plan.totalUnits).toBe(selected.totalPrepared);
      expect(representedUnits).toBe(selected.totalPrepared);
    }
  });

  it('does not allocate one object per pallet for very large valid plans', () => {
    const input: PackingInput = {
      quantity: 5_120_000_000,
      unitsPerCarton: 128,
      cartonsPerPalette: 40,
    };
    const selected = calculatePackingOptions(input)[0];
    const plan = createPackingShipmentPlan(input, selected);

    expect(plan.fullLoadCount).toBe(1_000_000);
    expect(plan.totalLoads).toBe(1_000_000);
    expect(plan.remainderLoad).toBeNull();
    expect(getPackingShipmentLoad(plan, 999_999)?.totalUnits).toBe(5_120);
  });

  it('fails closed when an option is inconsistent with its declared prepared total', () => {
    const selected = { ...option('round-carton'), totalPrepared: 30_975 };

    expect(() => createPackingShipmentPlan(referenceInput, selected)).toThrow(
      'Packing shipment plan is inconsistent with the selected packing option.',
    );
  });
});

describe('packing shipment progress', () => {
  it('tracks load progress and exact shipped volume independently', () => {
    const plan = createPackingShipmentPlan(referenceInput, option('round-carton'));
    const progress = getPackingShipmentProgress(plan, 6);

    expect(progress.shippedLoads).toBe(6);
    expect(progress.remainingLoads).toBe(1);
    expect(progress.shippedUnits).toBe(30_720);
    expect(progress.remainingUnits).toBe(256);
    expect(progress.loadProgressRatio).toBeCloseTo(6 / 7, 10);
    expect(progress.unitProgressRatio).toBeCloseTo(30_720 / 30_976, 10);
    expect(progress.nextLoad).toEqual({
      index: 6,
      kind: 'remainder',
      cartons: 2,
      looseUnits: 0,
      totalUnits: 256,
    });
  });

  it('reaches exact completion only after the remainder load is shipped', () => {
    const plan = createPackingShipmentPlan(referenceInput, option('no-overrun'));
    const progress = getPackingShipmentProgress(plan, 7);

    expect(progress).toMatchObject({
      shippedLoads: 7,
      remainingLoads: 0,
      shippedUnits: 30_880,
      remainingUnits: 0,
      loadProgressRatio: 1,
      unitProgressRatio: 1,
      nextLoad: null,
    });
  });

  it('clamps persisted counts to the current plan bounds', () => {
    const plan = createPackingShipmentPlan(referenceInput, option('round-carton'));

    expect(getPackingShipmentProgress(plan, -3).shippedLoads).toBe(0);
    expect(getPackingShipmentProgress(plan, 99).shippedLoads).toBe(7);
    expect(getPackingShipmentProgress(plan, Number.NaN).shippedLoads).toBe(0);
  });
});
