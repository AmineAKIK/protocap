import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

const packingFormKey = 'lineops.packing.form.inputs.v8';
const defaultPackingForm = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
};

function normalizePackingForm(value: typeof defaultPackingForm) {
  return {
    quantity: value.quantity,
    unitsPerCarton: value.unitsPerCarton,
    cartonsPerPalette: value.cartonsPerPalette,
  };
}

function expectStoredDefault() {
  return waitFor(() => {
    expect(JSON.parse(localStorage.getItem(packingFormKey) ?? 'null')).toEqual(defaultPackingForm);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useLocalStorage hydration', () => {
  it('falls back and self-heals when stored JSON has the wrong registered schema', async () => {
    localStorage.setItem(packingFormKey, JSON.stringify({ quantity: 30880 }));

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    expect(result.current[0]).toEqual(defaultPackingForm);
    await expectStoredDefault();
  });

  it('falls back and self-heals when stored JSON is malformed', async () => {
    localStorage.setItem(packingFormKey, '{not-json');

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    expect(result.current[0]).toEqual(defaultPackingForm);
    await expectStoredDefault();
  });

  it('normalizes accepted legacy values before repersisting them', async () => {
    localStorage.setItem(packingFormKey, JSON.stringify({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy: 'round-carton',
    }));

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    expect(result.current[0]).toEqual({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
    });
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(packingFormKey) ?? 'null')).toEqual({
        quantity: '30880',
        unitsPerCarton: '128',
        cartonsPerPalette: '40',
      });
    });
  });

  it('reports degraded persistence when a browser write is rejected', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    await waitFor(() => expect(result.current[2]).toBe('degraded'));
    expect(result.current[0]).toEqual(defaultPackingForm);
  });
});
