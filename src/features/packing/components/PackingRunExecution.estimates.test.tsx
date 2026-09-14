import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PackingRunExecution } from './PackingRunExecution';
import type { PackingRun } from '../domain/packingRun';

function makeRun(declaredUnits = 0): PackingRun {
  return {
    id: 'run-pr4',
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

describe('PackingRunExecution production estimates', () => {
  it('shows reference cadence and total duration from planned units', () => {
    render(
      <PackingRunExecution
        run={makeRun()}
        persistenceStatus="persisted"
        onRunChange={() => undefined}
        onNewRun={() => undefined}
      />,
    );

    const estimates = screen.getByRole('region', { name: 'Cadence et durées estimées' });
    expect(within(estimates).getByText('60 u/min')).toBeTruthy();
    expect(within(estimates).getAllByText('111 h 12 min')).toHaveLength(2);
  });

  it('recomputes remaining duration from declared production without changing total estimate', () => {
    const view = render(
      <PackingRunExecution
        run={makeRun()}
        persistenceStatus="persisted"
        onRunChange={() => undefined}
        onNewRun={() => undefined}
      />,
    );

    view.rerender(
      <PackingRunExecution
        run={makeRun(168000)}
        persistenceStatus="persisted"
        onRunChange={() => undefined}
        onNewRun={() => undefined}
      />,
    );

    const estimates = screen.getByRole('region', { name: 'Cadence et durées estimées' });
    expect(within(estimates).getByText('111 h 12 min')).toBeTruthy();
    expect(within(estimates).getByText('64 h 32 min')).toBeTruthy();
    expect(screen.getByText(/232\s320/)).toBeTruthy();
  });
});
