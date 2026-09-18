import { describe, expect, it } from 'vitest';
import type { LogisticsRequest, LogisticsStatus } from '../../types/logistics';
import { canTransitionLogisticsStatus, transitionLogisticsRequest } from './logisticsModel';

const base: LogisticsRequest = {
  id: 'LOG-301', line: 'Ligne A', zone: 'Sortie', palletCount: 1, priority: 'normal',
  nature: 'Palette pleine à évacuer', createdAt: '2026-09-18T08:00:00.000Z', status: 'waiting',
};

describe('Logistics transitions', () => {
  it.each([
    ['waiting', 'seen'], ['waiting', 'inProgress'], ['waiting', 'pickedUp'], ['waiting', 'cancelled'],
    ['seen', 'inProgress'], ['seen', 'pickedUp'], ['seen', 'cancelled'],
    ['inProgress', 'pickedUp'], ['inProgress', 'cancelled'],
  ] as [LogisticsStatus, LogisticsStatus][])('T22: allows %s -> %s', (from, to) => {
    expect(canTransitionLogisticsStatus(from, to)).toBe(true);
  });

  it.each([
    ['seen', 'waiting'], ['inProgress', 'seen'], ['inProgress', 'inProgress'],
    ['pickedUp', 'waiting'], ['pickedUp', 'cancelled'], ['cancelled', 'waiting'], ['cancelled', 'pickedUp'],
  ] as [LogisticsStatus, LogisticsStatus][])('T22: rejects %s -> %s', (from, to) => {
    expect(canTransitionLogisticsStatus(from, to)).toBe(false);
  });

  it('T22: non-terminal transitions do not invent a completion time', () => {
    expect(transitionLogisticsRequest(base, 'seen', '2026-09-18T08:10:00.000Z')).toEqual({
      ok: true,
      request: { ...base, status: 'seen' },
    });
  });

  it('T20/T22: terminal transition gets the real closure time and terminals stay stable', () => {
    const done = transitionLogisticsRequest(base, 'pickedUp', '2026-09-18T08:15:00.000Z');
    expect(done).toEqual({
      ok: true,
      request: { ...base, status: 'pickedUp', completedAt: '2026-09-18T08:15:00.000Z' },
    });
    if (!done.ok) throw new Error('fixture transition failed');
    expect(transitionLogisticsRequest(done.request, 'cancelled', '2026-09-18T08:20:00.000Z')).toEqual({
      ok: false,
      reason: 'invalid-transition',
    });
  });
});
