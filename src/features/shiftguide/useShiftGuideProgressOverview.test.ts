import { describe, expect, it } from 'vitest';
import type { SGModule } from '../../data/shiftguideModules';
import { buildShiftGuideProgressOverview } from './useShiftGuideProgressOverview';

const CONFIG_REVISION = 'sha256:test-config-revision';

const modules: SGModule[] = [
  {
    id: 'standard',
    title: 'Standard',
    description: 'Standard module',
    type: 'standard',
    actions: [
      { id: 'std_1', text: 'One' },
      { id: 'std_2', text: 'Two' },
    ],
  },
  {
    id: 'choice',
    title: 'Choice',
    description: 'Choice module',
    type: 'choice',
    subModules: [
      {
        id: 'choice_a',
        title: 'A',
        actions: [{ id: 'choice_a_1', text: 'A1' }],
      },
      {
        id: 'choice_b',
        title: 'B',
        actions: [
          { id: 'choice_b_1', text: 'B1' },
          { id: 'choice_b_2', text: 'B2' },
        ],
      },
    ],
  },
];

function storeProgress(state: Record<string, unknown>) {
  localStorage.setItem('shiftguide_config_revision', CONFIG_REVISION);
  localStorage.setItem('shiftguide_progress_v4', JSON.stringify({
    version: 4,
    configRevision: CONFIG_REVISION,
    workflowRuns: {},
    updatedAt: 1,
    ...state,
  }));
}

describe('buildShiftGuideProgressOverview', () => {
  it('uses the active choice scenario instead of aggregating alternative branches', () => {
    storeProgress({
      actions: {
        std_1: 'validated',
        choice_a_1: 'validated',
      },
      activeChoices: { choice: 'choice_a' },
    });

    const overview = buildShiftGuideProgressOverview(modules, localStorage);

    expect(overview.summaries.standard).toEqual({
      treatedCount: 1,
      totalActions: 2,
      isComplete: false,
    });
    expect(overview.summaries.choice).toEqual({
      treatedCount: 1,
      totalActions: 1,
      isComplete: true,
    });
    expect(overview.treatedActions).toBe(2);
    expect(overview.totalActions).toBe(3);
    expect(overview.completionPct).toBe(67);
  });

  it('keeps an untouched choice module out of the global action denominator', () => {
    storeProgress({ actions: {}, activeChoices: {} });

    const overview = buildShiftGuideProgressOverview(modules, localStorage);

    expect(overview.summaries.choice).toEqual({
      treatedCount: 0,
      totalActions: 0,
      isComplete: false,
    });
    expect(overview.totalActions).toBe(2);
    expect(overview.completionPct).toBe(0);
  });
});
