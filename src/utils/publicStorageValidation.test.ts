import { describe, expect, it } from 'vitest';
import { initialChangeHistory, initialConditioningLines } from '../data/expiryData';
import { initialLogisticsRequests } from '../data/logisticsData';
import { isValidPublicStorageValue } from './publicStorageValidation';

describe('public storage schema registry', () => {
  it('accepts the current valid public demo datasets', () => {
    expect(isValidPublicStorageValue('lineops.expiry.lines', initialConditioningLines)).toBe(true);
    expect(isValidPublicStorageValue('lineops.expiry.history', initialChangeHistory)).toBe(true);
    expect(isValidPublicStorageValue('lineops.logistics.requests', initialLogisticsRequests)).toBe(true);
    expect(isValidPublicStorageValue('lineops.packing.form.inputs', {
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
    })).toBe(true);
  });

  it('keeps legacy Packing form objects readable while policy is normalized away by the caller', () => {
    expect(isValidPublicStorageValue('lineops.packing.form.inputs', {
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy: 'round-carton',
    })).toBe(true);
  });

  it('rejects partial, structurally invalid, retired, or unsafe persisted values', () => {
    expect(isValidPublicStorageValue('lineops.expiry.lines', [])).toBe(false);
    expect(isValidPublicStorageValue('lineops.expiry.lines', [{
      ...initialConditioningLines[0],
      elements: [],
    }])).toBe(false);
    expect(isValidPublicStorageValue('lineops.logistics.requests', { requests: initialLogisticsRequests })).toBe(false);
    expect(isValidPublicStorageValue('lineops.packing.form.inputs', { quantity: 30880 })).toBe(false);
    expect(isValidPublicStorageValue('lineops.packing.shipment.progress', {
      progressByCalculation: { '30880:128:40:round-carton': 2 },
    })).toBe(false);
    expect(isValidPublicStorageValue('lineops.unknown', {})).toBe(false);
  });
});
