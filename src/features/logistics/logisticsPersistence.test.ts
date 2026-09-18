import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LogisticsRequest } from '../../types/logistics';
import {
  LOGISTICS_LEGACY_KEY,
  LOGISTICS_WORKSPACE_KEY,
  loadLogisticsWorkspace,
  persistLogisticsWorkspace,
} from './logisticsPersistence';

const request: LogisticsRequest = {
  id: 'LOG-201',
  line: 'Ligne A',
  zone: 'Sortie',
  palletCount: 1,
  priority: 'normal',
  nature: 'Palette',
  createdAt: '2026-09-18T08:00:00.000Z',
  status: 'waiting',
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('Logistics revisioned persistence', () => {
  it('T40: v8 is migrated non-destructively into v9', () => {
    const raw = JSON.stringify([request]);
    localStorage.setItem(LOGISTICS_LEGACY_KEY, raw);

    const loaded = loadLogisticsWorkspace([]);
    expect(loaded).toMatchObject({
      status: 'migration-pending',
      workspace: { schemaVersion: 9, revision: 0, requests: [request] },
    });
    const persisted = persistLogisticsWorkspace(0, loaded.workspace.requests);
    expect(persisted).toMatchObject({ status: 'persisted', workspace: { revision: 1 } });
    expect(localStorage.getItem(LOGISTICS_LEGACY_KEY)).toBe(raw);
  });

  it('T23: rejects stale revisions and preserves the newer request list', () => {
    expect(persistLogisticsWorkspace(0, [request])).toMatchObject({ status: 'persisted', workspace: { revision: 1 } });
    const newer = { ...request, id: 'LOG-202', zone: 'Onglet A' };
    expect(persistLogisticsWorkspace(1, [newer, request])).toMatchObject({ status: 'persisted', workspace: { revision: 2 } });
    expect(persistLogisticsWorkspace(1, [{ ...request, id: 'LOG-203' }, request])).toMatchObject({ status: 'degraded', reason: 'conflict' });

    const stored = JSON.parse(localStorage.getItem(LOGISTICS_WORKSPACE_KEY)!);
    expect(stored.revision).toBe(2);
    expect(stored.requests.map((entry: LogisticsRequest) => entry.id)).toEqual(['LOG-202', 'LOG-201']);
  });

  it('T10/T31: a write that cannot be read back is not reported as persisted', () => {
    const nativeGetItem = Storage.prototype.getItem;
    let workspaceReads = 0;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function getItem(
      this: Storage,
      key: string,
    ) {
      if (key === LOGISTICS_WORKSPACE_KEY) {
        workspaceReads += 1;
        if (workspaceReads === 2) return '{"tampered":true}';
      }
      return nativeGetItem.call(this, key);
    });

    expect(persistLogisticsWorkspace(0, [request])).toMatchObject({
      status: 'degraded',
      reason: 'verify',
    });
  });

  it('T41: a future v10 makes the v9 reader read-only', () => {
    localStorage.setItem('lineops.logistics.requests.v10', JSON.stringify({ schemaVersion: 10 }));
    const loaded = loadLogisticsWorkspace([request]);
    expect(loaded).toMatchObject({ status: 'readonly', futureVersion: 10 });
    expect(persistLogisticsWorkspace(0, [request])).toMatchObject({ status: 'degraded', reason: 'future-version', futureVersion: 10 });
  });
});
