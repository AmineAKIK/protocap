import { describe, expect, it } from 'vitest';
import { addPackingDeclaration, getPackingRunTiming, type PackingRun } from './packingRun';

function workflowRun(): PackingRun {
  return {
    id: 'workflow-run',
    createdAt: '2026-09-15T07:29:00.000Z',
    productionStartedAt: '2026-09-15T07:30:00.000Z',
    requestedUnits: 30_880,
    unitsPerCarton: 128,
    cartonsPerLoad: 40,
    selectedPolicy: 'round-carton',
    plannedUnits: 30_976,
    varianceUnits: 96,
    referenceCadenceUnitsPerMinute: 60,
    declarations: [
      { id: 'd-1', createdAt: '2026-09-15T09:24:00.000Z', completeCartons: 40, partialCartonUnits: 0 },
      { id: 'd-2', createdAt: '2026-09-15T09:56:00.000Z', completeCartons: 40, partialCartonUnits: 0 },
      { id: 'd-3', createdAt: '2026-09-15T10:28:00.000Z', completeCartons: 40, partialCartonUnits: 0 },
    ],
  };
}

describe('packing reference timing', () => {
  it('derives +240 units and four minutes ahead for the validated workflow example', () => {
    const timing = getPackingRunTiming(workflowRun(), new Date('2026-09-15T11:42:00.000Z'));

    expect(timing.elapsedMinutes).toBe(252);
    expect(timing.referenceExpectedUnits).toBe(15_120);
    expect(timing.varianceUnitsVsReference).toBe(240);
    expect(timing.varianceMinutesVsReference).toBe(4);
    expect(timing.projectedFinishAt).toBe('2026-09-15T16:02:16.000Z');
  });

  it('freezes timing at the final declaration instead of letting a completed run drift', () => {
    const completed = addPackingDeclaration(
      {
        ...workflowRun(),
        requestedUnits: 30_976,
        selectedPolicy: 'no-overrun',
        varianceUnits: 0,
      },
      {
        id: 'complete',
        createdAt: '2026-09-15T16:00:00.000Z',
        completeCartons: 122,
        partialCartonUnits: 0,
      },
    );

    const atCompletion = getPackingRunTiming(completed, new Date('2026-09-15T16:00:00.000Z'));
    const muchLater = getPackingRunTiming(completed, new Date('2026-09-16T10:00:00.000Z'));

    expect(muchLater.effectiveNow).toBe('2026-09-15T16:00:00.000Z');
    expect(muchLater).toEqual(atCompletion);
  });
});
