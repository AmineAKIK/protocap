import { describe, expect, it } from 'vitest';
import {
  calculateExactPacking,
  calculatePackingOptions,
  getShipmentPalletCount,
  isPositiveInteger,
  isValidPackingInput,
  parsePositiveIntegerInput,
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
    expect(options.map(getShipmentPalletCount)).toEqual([7, 7, 7]);
  });

  it('does not add a remainder pallet when the selected result uses complete pallets only', () => {
    const options = calculatePackingOptions({
      quantity: 30_720,
      unitsPerCarton: 128,
      cartonsPerPalette: 40,
    });

    expect(options.map(getShipmentPalletCount)).toEqual([6, 6, 6]);
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
