import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOW_REFRESH_INTERVAL_MS, useNow } from './useNow';

const base = new Date('2026-09-17T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(base);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useNow', () => {
  it('T06: advances from the periodic clock without user interaction', () => {
    const { result } = renderHook(() => useNow());
    expect(result.current.toISOString()).toBe(base.toISOString());

    act(() => { vi.advanceTimersByTime(NOW_REFRESH_INTERVAL_MS); });
    expect(result.current.getTime()).toBe(base.getTime() + NOW_REFRESH_INTERVAL_MS);
  });

  it('T07: refreshes on focus, visible return and pageshow after a suspended clock', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    const { result } = renderHook(() => useNow(60_000));

    vi.setSystemTime(new Date('2026-09-17T13:00:00.000Z'));
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.toISOString()).toBe(base.toISOString());

    visibility.mockReturnValue('visible');
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(result.current.toISOString()).toBe('2026-09-17T13:00:00.000Z');

    vi.setSystemTime(new Date('2026-09-17T14:00:00.000Z'));
    act(() => { window.dispatchEvent(new Event('focus')); });
    expect(result.current.toISOString()).toBe('2026-09-17T14:00:00.000Z');

    vi.setSystemTime(new Date('2026-09-17T15:00:00.000Z'));
    act(() => { window.dispatchEvent(new PageTransitionEvent('pageshow')); });
    expect(result.current.toISOString()).toBe('2026-09-17T15:00:00.000Z');
  });

  it('T07: removes timer and lifecycle listeners on unmount', () => {
    const addWindow = vi.spyOn(window, 'addEventListener');
    const removeWindow = vi.spyOn(window, 'removeEventListener');
    const addDocument = vi.spyOn(document, 'addEventListener');
    const removeDocument = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useNow(60_000));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);

    expect(addWindow).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(addWindow).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('focus', expect.any(Function));
    expect(removeWindow).toHaveBeenCalledWith('pageshow', expect.any(Function));
    expect(addDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    expect(removeDocument).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
