import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PackingRun } from '../domain/packingRun';
import { PackingCockpitSummary } from './PackingCockpitSummary';

function makeRun(declaredUnits = 0): PackingRun {
  return {
    id: 'run-pr5',
    createdAt: '2026-09-14T12:00:00.000Z',
    requestedUnits: 400000,
    unitsPerCarton: 480,
    cartonsPerLoad: 50,
    selectedPolicy: 'round-carton',
    plannedUnits: 400320,
    varianceUnits: 320,
    referenceCadenceUnitsPerMinute: 60,
    declarations: declaredUnits === 0
      ? []
      : [{
          id: 'declaration-1',
          createdAt: '2026-09-14T13:00:00.000Z',
          completeCartons: declaredUnits / 480,
          partialCartonUnits: 0,
        }],
  };
}

describe('PackingCockpitSummary', () => {
  it('groups the manager reading level around the active run truth', () => {
    render(<PackingCockpitSummary run={makeRun()} />);

    const cockpit = screen.getByRole('region', { name: 'État de production' });
    expect(within(cockpit).getByText('400 320')).toBeTruthy();
    expect(within(cockpit).getByText('400 000 demandées')).toBeTruthy();
    expect(within(cockpit).getByText('60 u/min')).toBeTruthy();
    expect(within(cockpit).getByText('111 h 12 min', { selector: '.tabular-nums' })).toBeTruthy();
    expect(within(cockpit).getByText('+320')).toBeTruthy();
  });

  it('recomputes declared, progress, remaining and remaining time from history', () => {
    render(<PackingCockpitSummary run={makeRun(168000)} />);

    const cockpit = screen.getByRole('region', { name: 'État de production' });
    expect(within(cockpit).getByText('168 000')).toBeTruthy();
    expect(within(cockpit).getByText('41 %')).toBeTruthy();
    expect(within(cockpit).getByText('232 320')).toBeTruthy();
    expect(within(cockpit).getByText('64 h 32 min')).toBeTruthy();
  });
});
