import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { PROGRESS_STORAGE_KEY } from '../../shared/shiftGuideProgress.js';
import { shiftGuideFixture } from '../test/shiftGuideFixture';
import { useModuleProgress } from './useModuleProgress';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sessionStorage.setItem('shiftguide_auth_token', 'test-token');
  sessionStorage.setItem('shiftguide_data', JSON.stringify(shiftGuideFixture));
});

describe('useModuleProgress', () => {
  it('persists an action through the canonical v2 store and updates the hook subscriber', async () => {
    const { result } = renderHook(() =>
      useModuleProgress('module_standard', ['action_1', 'action_2'])
    );

    expect(result.current.progress.action_1).toBe('pending');
    expect(result.current.treatedCount).toBe(0);

    act(() => result.current.setAction('action_1', 'validated'));

    await waitFor(() => expect(result.current.progress.action_1).toBe('validated'));
    expect(result.current.treatedCount).toBe(1);

    const stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as {
      version?: number;
      actions?: Record<string, string>;
    };
    expect(stored.version).toBe(2);
    expect(stored.actions).toEqual({ action_1: 'validated' });
  });

  it('toggles a repeated status back to pending without retaining a stale action entry', async () => {
    const { result } = renderHook(() => useModuleProgress('module_standard', ['action_1']));

    act(() => result.current.setAction('action_1', 'na'));
    await waitFor(() => expect(result.current.progress.action_1).toBe('na'));

    act(() => result.current.setAction('action_1', 'na'));
    await waitFor(() => expect(result.current.progress.action_1).toBe('pending'));

    const stored = JSON.parse(localStorage.getItem(PROGRESS_STORAGE_KEY) ?? '{}') as {
      actions?: Record<string, string>;
    };
    expect(stored.actions).toEqual({});
  });
});
