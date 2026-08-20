import { useCallback, useEffect, useState } from 'react';

export type ActionStatus = 'pending' | 'validated' | 'na';

interface Progress {
  [actionId: string]: ActionStatus;
}

interface StoredData {
  actions: Progress;
  updatedAt: number;
}

const GLOBAL_PROGRESS_KEY = 'shiftguide_progress_v1';
const PROGRESS_EVENT = 'shiftguide:progress';

function readStoredData(key: string): StoredData {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return { actions: {}, updatedAt: 0 };
    const parsed = JSON.parse(saved) as Partial<StoredData>;
    return {
      actions: parsed.actions && typeof parsed.actions === 'object' ? parsed.actions : {},
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
    };
  } catch {
    return { actions: {}, updatedAt: 0 };
  }
}

function writeStoredData(key: string, actions: Progress) {
  localStorage.setItem(key, JSON.stringify({ actions, updatedAt: Date.now() } satisfies StoredData));
}

function readGlobalProgress(): Progress {
  return readStoredData(GLOBAL_PROGRESS_KEY).actions;
}

function notifyProgressChanged() {
  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

function migrateLegacyModule(moduleId: string): Progress {
  const legacyKey = `shiftguide_module_${moduleId}`;
  const legacy = readStoredData(legacyKey).actions;
  const global = readGlobalProgress();
  let changed = false;

  for (const [actionId, status] of Object.entries(legacy)) {
    if (!global[actionId] && status !== 'pending') {
      global[actionId] = status;
      changed = true;
    }
  }

  if (changed) writeStoredData(GLOBAL_PROGRESS_KEY, global);
  return global;
}

function getModuleProgress(moduleId: string, actionIds: string[]): Progress {
  const global = migrateLegacyModule(moduleId);
  return Object.fromEntries(actionIds.map((actionId) => [actionId, global[actionId] ?? 'pending']));
}

export function getSharedActionStatus(actionId: string): ActionStatus {
  return readGlobalProgress()[actionId] ?? 'pending';
}

export function setSharedActionStatus(
  actionId: string,
  status: ActionStatus,
  moduleId?: string
) {
  const global = readGlobalProgress();
  if (status === 'pending') delete global[actionId];
  else global[actionId] = status;
  writeStoredData(GLOBAL_PROGRESS_KEY, global);

  // Compatibility mirror while legacy module readers are still present.
  if (moduleId) {
    const legacyKey = `shiftguide_module_${moduleId}`;
    const legacy = readStoredData(legacyKey).actions;
    if (status === 'pending') delete legacy[actionId];
    else legacy[actionId] = status;
    writeStoredData(legacyKey, legacy);
  }

  notifyProgressChanged();
}

export function subscribeShiftGuideProgress(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === GLOBAL_PROGRESS_KEY || event.key?.startsWith('shiftguide_module_')) {
      listener();
    }
  };
  window.addEventListener(PROGRESS_EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(PROGRESS_EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useModuleProgress(moduleId: string, actionIds: string[]) {
  const [progress, setProgress] = useState<Progress>(() => getModuleProgress(moduleId, actionIds));

  useEffect(() => {
    const refresh = () => setProgress(getModuleProgress(moduleId, actionIds));
    refresh();
    return subscribeShiftGuideProgress(refresh);
  }, [moduleId, actionIds]);

  const setAction = useCallback((actionId: string, status: ActionStatus) => {
    const current = getSharedActionStatus(actionId);
    const next = current === status ? 'pending' : status;
    setSharedActionStatus(actionId, next, moduleId);
  }, [moduleId]);

  const resetModule = useCallback(() => {
    const global = readGlobalProgress();
    for (const actionId of actionIds) delete global[actionId];
    writeStoredData(GLOBAL_PROGRESS_KEY, global);
    localStorage.removeItem(`shiftguide_module_${moduleId}`);
    notifyProgressChanged();
  }, [actionIds, moduleId]);

  const treatedCount = actionIds.filter((id) => {
    const s = progress[id];
    return s === 'validated' || s === 'na';
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

export function getModuleProgressSummary(
  moduleId: string,
  actionIds: string[]
): { treatedCount: number; totalActions: number; isComplete: boolean } {
  const progress = getModuleProgress(moduleId, actionIds);
  const treatedCount = actionIds.filter(
    (id) => progress[id] === 'validated' || progress[id] === 'na'
  ).length;
  return {
    treatedCount,
    totalActions: actionIds.length,
    isComplete: treatedCount === actionIds.length && actionIds.length > 0,
  };
}
