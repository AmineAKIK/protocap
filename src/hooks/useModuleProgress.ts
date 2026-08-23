import { useCallback, useEffect, useState } from 'react';
import {
  getActionProgress,
  getActionStatus,
  PROGRESS_STORAGE_KEY,
  readProgressState,
  resolveActiveChoice,
  summarizeActions,
  summarizeChoiceModule,
  withActionStatus,
  withActiveChoice,
  withoutActions,
  writeProgressState,
} from '../../shared/shiftGuideProgress.js';
import type { SharedProgressSummary } from '../../shared/shiftGuideProgress.js';
import { getSgModules } from '../data/shiftguideModules';
import type { SGChoiceModule, SGSubModule } from '../data/shiftguideModules';
import { runShiftGuideProgressTransaction } from '../features/shiftguide/shiftGuideConcurrency';
import { getShiftGuidePersistentStorage } from '../features/shiftguide/shiftGuideStorage';

export type ActionStatus = 'pending' | 'validated' | 'na';

interface Progress {
  [actionId: string]: ActionStatus;
}

interface ChoiceTarget {
  module: SGChoiceModule;
  subModule: SGSubModule;
}

const PROGRESS_EVENT = 'shiftguide:progress';
const ACTION_IDS_SEPARATOR = '\u001f';

function notifyProgressChanged() {
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

function findChoiceParentForSubModule(subModuleId: string): ChoiceTarget | null {
  for (const module of getSgModules()) {
    if (module.type !== 'choice' || !module.subModules) continue;
    const choiceModule = module as SGChoiceModule;
    const subModule = choiceModule.subModules.find((candidate) => candidate.id === subModuleId);
    if (subModule) return { module: choiceModule, subModule };
  }
  return null;
}

function readState() {
  return readProgressState(getShiftGuidePersistentStorage());
}

function writeState(state: ReturnType<typeof readState>) {
  writeProgressState(getShiftGuidePersistentStorage(), state);
  notifyProgressChanged();
}

function mutateState(
  mutation: (state: ReturnType<typeof readState>) => ReturnType<typeof readState>
) {
  return runShiftGuideProgressTransaction(() => {
    const current = readState();
    const next = mutation(current);
    writeState(next);
    return next;
  });
}

function applyChoiceScope(
  state: ReturnType<typeof readState>,
  moduleId?: string
): ReturnType<typeof readState> {
  if (!moduleId) return state;
  const choiceTarget = findChoiceParentForSubModule(moduleId);
  if (!choiceTarget) return state;
  return withActiveChoice(state, choiceTarget.module.id, choiceTarget.subModule.id);
}

function getModuleProgress(moduleId: string, actionIds: string[]): Progress {
  const state = readState();
  const choiceTarget = findChoiceParentForSubModule(moduleId);
  if (choiceTarget) {
    const activeSubModuleId = resolveActiveChoice(state, choiceTarget.module);
    if (activeSubModuleId && activeSubModuleId !== moduleId) {
      return Object.fromEntries(actionIds.map((actionId) => [actionId, 'pending'])) as Progress;
    }
  }
  return getActionProgress(state, actionIds) as Progress;
}

export function getSharedActionStatus(actionId: string): ActionStatus {
  return getActionStatus(readState(), actionId) as ActionStatus;
}

export function setSharedActionStatus(
  actionId: string,
  status: ActionStatus,
  moduleId?: string
) {
  return mutateState((state) => {
    const next = withActionStatus(state, actionId, status);
    return applyChoiceScope(next, moduleId);
  });
}

function toggleSharedActionStatus(
  actionId: string,
  status: ActionStatus,
  moduleId?: string
) {
  return mutateState((state) => {
    const current = getActionStatus(state, actionId) as ActionStatus;
    const nextStatus: ActionStatus = current === status ? 'pending' : status;
    const next = withActionStatus(state, actionId, nextStatus);
    return applyChoiceScope(next, moduleId);
  });
}

export function setActiveChoiceModule(moduleId: string, subModuleId: string) {
  return mutateState((state) => withActiveChoice(state, moduleId, subModuleId));
}

export function subscribeShiftGuideProgress(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === PROGRESS_STORAGE_KEY) listener();
  };
  window.addEventListener(PROGRESS_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useModuleProgress(moduleId: string, actionIds: string[]) {
  const actionIdsKey = actionIds.join(ACTION_IDS_SEPARATOR);
  const [progress, setProgress] = useState<Progress>(() => getModuleProgress(moduleId, actionIds));

  useEffect(() => {
    const stableActionIds = actionIdsKey ? actionIdsKey.split(ACTION_IDS_SEPARATOR) : [];
    const refresh = () => setProgress(getModuleProgress(moduleId, stableActionIds));
    refresh();
    return subscribeShiftGuideProgress(refresh);
  }, [moduleId, actionIdsKey]);

  const setAction = useCallback((actionId: string, status: ActionStatus) => {
    void toggleSharedActionStatus(actionId, status, moduleId);
  }, [moduleId]);

  const resetModule = useCallback(() => {
    const stableActionIds = actionIdsKey ? actionIdsKey.split(ACTION_IDS_SEPARATOR) : [];
    void mutateState((state) => withoutActions(state, stableActionIds));
  }, [actionIdsKey]);

  const treatedCount = actionIds.filter((id) => {
    const status = progress[id];
    return status === 'validated' || status === 'na';
  }).length;

  const totalActions = actionIds.length;
  const completionRate = totalActions > 0 ? treatedCount / totalActions : 0;
  const isComplete = totalActions > 0 && treatedCount === totalActions;

  return {
    progress,
    setAction,
    resetModule,
    completionRate,
    totalActions,
    treatedCount,
    isComplete,
  };
}

export function isModuleProgressComplete(moduleId: string, actionIds: string[]) {
  if (actionIds.length === 0) return true;
  return getModuleProgressSummary(moduleId, actionIds).isComplete;
}

export function getModuleProgressSummary(
  moduleId: string,
  actionIds: string[]
): SharedProgressSummary {
  const state = readState();
  const choiceTarget = findChoiceParentForSubModule(moduleId);
  if (choiceTarget) {
    const choiceSummary = summarizeChoiceModule(state, choiceTarget.module);
    if (choiceSummary.activeSubModuleId !== moduleId) {
      return { treatedCount: 0, totalActions: 0, isComplete: false };
    }
  }
  return summarizeActions(state, actionIds);
}
