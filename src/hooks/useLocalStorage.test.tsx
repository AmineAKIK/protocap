import { StrictMode, type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
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

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('useLocalStorage non-destructive hydration', () => {
  it.each([
    ['wrong schema', JSON.stringify({ quantity: 30880 })],
    ['malformed JSON', '{not-json'],
    ['empty payload', ''],
  ])('T15: keeps %s bytes untouched and falls back only in memory', (_label, raw) => {
    localStorage.setItem(packingFormKey, raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    expect(result.current[0]).toEqual(defaultPackingForm);
    expect(result.current[2]).toBe('recovered');
    expect(localStorage.getItem(packingFormKey)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it('normalizes accepted legacy values in memory without rewriting historical bytes', () => {
    const raw = JSON.stringify({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
      policy: 'round-carton',
    });
    localStorage.setItem(packingFormKey, raw);
    const writes = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    expect(result.current[0]).toEqual({
      quantity: '30880',
      unitsPerCarton: '128',
      cartonsPerPalette: '40',
    });
    expect(result.current[2]).toBe('recovered');
    expect(localStorage.getItem(packingFormKey)).toBe(raw);
    expect(writes).not.toHaveBeenCalled();
  });

  it('T17: does not write defaults on an empty mount or under StrictMode', () => {
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

    const { result } = renderHook(
      () => useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm),
      { wrapper },
    );

    expect(result.current[2]).toBe('memory');
    expect(result.current[0]).toEqual(defaultPackingForm);
    expect(writes).not.toHaveBeenCalled();
    expect(localStorage.getItem(packingFormKey)).toBeNull();
  });

  it('T17: changing the logical key reloads without a parasitic write', () => {
    localStorage.setItem('lineops.expiry.lines.v8', '[]');
    localStorage.setItem('lineops.expiry.history.v8', '[]');
    const writes = vi.spyOn(Storage.prototype, 'setItem');

    const { result, rerender } = renderHook(
      ({ logicalKey }) => useLocalStorage<unknown[]>(logicalKey, []),
      { initialProps: { logicalKey: 'lineops.expiry.lines' } },
    );
    expect(result.current[2]).toBe('persisted');

    rerender({ logicalKey: 'lineops.expiry.history' });
    expect(result.current[2]).toBe('persisted');
    expect(writes).not.toHaveBeenCalled();
  });

  it('T10: reports a read access failure without attempting a repair write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });
    const writes = vi.spyOn(Storage.prototype, 'setItem');

    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    expect(result.current[2]).toBe('degraded');
    expect(result.current[0]).toEqual(defaultPackingForm);
    expect(writes).not.toHaveBeenCalled();
  });
});

describe('useLocalStorage explicit writes', () => {
  it('returns a verified persisted result and updates memory', () => {
    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );

    let write;
    act(() => {
      write = result.current[1]({ ...defaultPackingForm, quantity: '42' });
    });

    expect(write).toEqual({ status: 'persisted', key: packingFormKey });
    expect(result.current[0].quantity).toBe('42');
    expect(result.current[2]).toBe('persisted');
    expect(JSON.parse(localStorage.getItem(packingFormKey) ?? 'null').quantity).toBe('42');
  });

  it('T10: distinguishes blocked access and preserves the unsaved draft in memory', () => {
    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError');
    });

    let write;
    act(() => {
      write = result.current[1]({ ...defaultPackingForm, quantity: '43' });
    });

    expect(write).toMatchObject({ status: 'degraded', reason: 'access', errorName: 'SecurityError' });
    expect(result.current[0].quantity).toBe('43');
    expect(result.current[2]).toBe('degraded');
    expect(localStorage.getItem(packingFormKey)).toBeNull();
  });

  it('T10: distinguishes quota rejection', () => {
    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });

    let write;
    act(() => {
      write = result.current[1]({ ...defaultPackingForm, quantity: '44' });
    });

    expect(write).toMatchObject({ status: 'degraded', reason: 'quota', errorName: 'QuotaExceededError' });
    expect(result.current[2]).toBe('degraded');
  });

  it('T10: distinguishes serialization failure before touching storage', () => {
    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    const circular = { ...defaultPackingForm, quantity: '45' } as typeof defaultPackingForm & { cycle?: unknown };
    circular.cycle = circular;

    let write;
    act(() => {
      write = result.current[1](circular);
    });

    expect(write).toMatchObject({ status: 'degraded', reason: 'serialize' });
    expect(result.current[0].quantity).toBe('45');
    expect(result.current[2]).toBe('degraded');
    expect(writes).not.toHaveBeenCalled();
  });

  it('T15: refuses durable writes when a future public schema version exists', () => {
    localStorage.setItem('lineops.packing.form.inputs.v9', JSON.stringify(defaultPackingForm));
    const { result } = renderHook(() =>
      useLocalStorage('lineops.packing.form.inputs', defaultPackingForm, normalizePackingForm)
    );
    expect(result.current[2]).toBe('readonly');

    let write;
    act(() => {
      write = result.current[1]({ ...defaultPackingForm, quantity: '46' });
    });

    expect(write).toMatchObject({ status: 'degraded', reason: 'future-version', futureVersion: 9 });
    expect(result.current[0].quantity).toBe('46');
    expect(result.current[2]).toBe('readonly');
    expect(localStorage.getItem(packingFormKey)).toBeNull();
    expect(JSON.parse(localStorage.getItem('lineops.packing.form.inputs.v9') ?? 'null')).toEqual(defaultPackingForm);
  });
});
