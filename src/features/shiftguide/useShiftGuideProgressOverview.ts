import { useEffect, useState } from 'react';
import {
  readProgressState,
  summarizeActions,
  summarizeChoiceModule,
} from '../../../shared/shiftGuideProgress.js';
import type { SharedProgressSummary } from '../../../shared/shiftGuideProgress.js';
import { getSgModules } from '../../data/shiftguideModules';
import type { SGChoiceModule, SGModule } from '../../data/shiftguideModules';
import { subscribeShiftGuideProgress } from '../../hooks/useModuleProgress';
import { getShiftGuidePersistentStorage } from './shiftGuideStorage';
import type { StorageLike } from './shiftGuideStorage';

export interface ShiftGuideProgressOverview {
  summaries: Record<string, SharedProgressSummary>;
  treatedActions: number;
  totalActions: number;
  completionPct: number;
}

const EMPTY_SUMMARY: SharedProgressSummary = {
  treatedCount: 0,
  totalActions: 0,
  isComplete: false,
};

export function buildShiftGuideProgressOverview(
  modules: SGModule[],
  storage: StorageLike
): ShiftGuideProgressOverview {
  const state = readProgressState(storage);
  const summaries: Record<string, SharedProgressSummary> = {};

  for (const module of modules) {
    if (module.type === 'choice' && module.subModules) {
      const summary = summarizeChoiceModule(state, module as SGChoiceModule);
      summaries[module.id] = {
        treatedCount: summary.treatedCount,
        totalActions: summary.totalActions,
        isComplete: summary.isComplete,
      };
      continue;
    }

    summaries[module.id] = module.actions
      ? summarizeActions(state, module.actions.map((action) => action.id))
      : EMPTY_SUMMARY;
  }

  const treatedActions = Object.values(summaries).reduce(
    (sum, summary) => sum + summary.treatedCount,
    0
  );
  const totalActions = Object.values(summaries).reduce(
    (sum, summary) => sum + summary.totalActions,
    0
  );

  return {
    summaries,
    treatedActions,
    totalActions,
    completionPct: totalActions > 0 ? Math.round((treatedActions / totalActions) * 100) : 0,
  };
}

function readOverview() {
  return buildShiftGuideProgressOverview(getSgModules(), getShiftGuidePersistentStorage());
}

export function useShiftGuideProgressOverview() {
  const [overview, setOverview] = useState<ShiftGuideProgressOverview>(readOverview);

  useEffect(() => {
    const refresh = () => setOverview(readOverview());
    refresh();
    return subscribeShiftGuideProgress(refresh);
  }, []);

  return overview;
}
