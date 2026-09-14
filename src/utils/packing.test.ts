import { describe, expect, it } from 'vitest';
import {
  calculateExactPacking,
  calculatePackingOptions,
  isPositiveInteger,
  isValidPackingInput,
  parsePositiveIntegerInput,
  summarizePackingLoads,
} from './packing';

describe('packing exact integer domain', () => {
  it('accepts normal exact inputs and preserves expected packing arithmetic', () => {
    const input = { quantity: 30_880, unitsPerCarton: 128, cartonsPerPalette: 40 };
    expect(isValidPackingInput(input)).toBe(true);
    expect(calculateExactPacking(input)).toEqual({
      unitsPerPalette: 5_120,
      palettesCompletes: 6,
      resteApresPalettes: 160,
      cartonsComplets: 1,
      unitesRestantes: 32,
    });
    const options = calculatePackingOptions(input);
    expect(options.map((option) => option.totalPrepared)).toEqual([30_880, 30_976, 35_840]);
    expect(options.map((option) => summarizePackingLoads(input, option).totalLoads)).toEqual([7, 7, 7]);
  });

  it('does not add a partial load when the selected result uses complete pallets only', () => {
    const input = {
      quantity: 30_720,
      unitsPerCarton: 128,
      cartonsPerPalette: 40,
    };
    const options = calculatePackingOptions(input);

    expect(options.map((option) => summarizePackingLoads(input, option))).toEqual([
      { fullLoadCount: 6, partialLoadCount: 0, totalLoads: 6 },
      { fullLoadCount: 6, partialLoadCount: 0, totalLoads: 6 },
      { fullLoadCount: 6, partialLoadCount: 0, totalLoads: 6 },
    ]);
  });

  it('summarizes partial preparation without implying sequential execution', () => {
    const input = { quantity: 30_880, unitsPerCarton: 128, cartonsPerPalette: 40 };
    const [exact, roundCarton, roundPallet] = calculatePackingOptions(input);

    expect(summarizePackingLoads(input, exact)).toEqual({
      fullLoadCount: 6,
      partialLoadCount: 1,
      totalLoads: 7,
    });
    expect(summarizePackingLoads(input, roundCarton)).toEqual({
      fullLoadCount: 6,
      partialLoadCount: 1,
      totalLoads: 7,
    });
    expect(summarizePackingLoads(input, roundPallet)).toEqual({
      fullLoadCount: 7,
      partialLoadCount: 0,
      totalLoads: 7,
    });
  });

  it('promotes a carton remainder that fills a pallet into a complete load summary', () => {
    const input = { quantity: 5_000, unitsPerCarton: 128, cartonsPerPalette: 40 };
    const selected = calculatePackingOptions(input).find((option) => option.policy === 'round-carton');
    if (!selected) throw new Error('Missing round-carton option');

    expect(summarizePackingLoads(input, selected)).toEqual({
      fullLoadCount: 1,
      partialLoadCount: 0,
      totalLoads: 1,
    });
  });

  it('keeps large valid load summaries constant-size', () => {
    const input = {
      quantity: 5_120_000_000,
      unitsPerCarton: 128,
      cartonsPerPalette: 40,
    };
    const selected = calculatePackingOptions(input)[0];

    expect(summarizePackingLoads(input, selected)).toEqual({
      fullLoadCount: 1_000_000,
      partialLoadCount: 0,
      totalLoads: 1_000_000,
    });
  });

  it('fails closed when a load summary cannot represent the selected prepared total', () => {
    const input = { quantity: 30_880, unitsPerCarton: 128, cartonsPerPalette: 40 };
    const selected = calculatePackingOptions(input).find((option) => option.policy === 'round-carton');
    if (!selected) throw new Error('Missing round-carton option');

    expect(() => summarizePackingLoads(input, { ...selected, totalPrepared: 30_975 })).toThrow(
      'Packing option cannot be summarized into physical loads exactly.',
    );
  });

  it('rejects integers that JavaScript cannot represent exactly', () => {
    expect(isPositiveInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isPositiveInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(parsePositiveIntegerInput('9007199254740992')).toBeNull();
  });

  it('rejects safe inputs whose units-per-palette product is unsafe', () => {
    const input = {
      quantity: 10,
      unitsPerCarton: Number.MAX_SAFE_INTEGER,
      cartonsPerPalette: 2,
    };
    expect(isValidPackingInput(input)).toBe(false);
    expect(() => calculateExactPacking(input)).toThrow(RangeError);
  });

  it('rejects safe inputs when a rounded option would exceed exact integer range', () => {
    const input = {
      quantity: Number.MAX_SAFE_INTEGER,
      unitsPerCarton: 3_000_000_000_000_000,
      cartonsPerPalette: 1,
    };
    expect(Number.isSafeInteger(input.unitsPerCarton)).toBe(true);
    expect(isValidPackingInput(input)).toBe(false);
    expect(() => calculatePackingOptions(input)).toThrow(RangeError);
  });
});
