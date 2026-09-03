import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLocalStorage } from './useLocalStorage';

const packingFormKey = 'lineops.packing.form.inputs.v8';
const defaultPackingForm = {
  quantity: '',
  unitsPerCarton: '',
  cartonsPerPalette: '',
  policy: 'no-overrun' as const,
};

describe('useLocalStorage hydration', () => {
  it('falls back and self-heals when stored JSON has the wrong registered schema', async () => {
    localStorage.setItem(packingFormKey, JSON.stringify({ quantity: 30880 }));

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm)
    );

    expect(result.current[0]).toEqual(defaultPackingForm);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(packingFormKey) ?? 'null')).toEqual(defaultPackingForm);
    });
  });
});
