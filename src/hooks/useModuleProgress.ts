import { useCallback, useEffect, useState } from 'react';

export type ActionStatus = 'pending' | 'validated' | 'na';

interface Progress {
  [actionId: string]: ActionStatus;
}

interface StoredData {
  actions: Progress;
  updatedAt: number;
}

export function useModuleProgress(moduleId: string, actionIds: string[]) {
  const key = `shiftguide_module_${moduleId}`;

  const [progress, setProgress] = useState<Progress>(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed: StoredData = JSON.parse(saved);
        return parsed.actions ?? {};
      }
    } catch {
      // ignore
    }
    return {};
  });

  useEffect(() => {
    const data: StoredData = { actions: progress, updatedAt: Date.now() };
    localStorage.setItem(key, JSON.stringify(data));
  }, [progress, key]);

  const setAction = useCallback((actionId: string, status: ActionStatus) => {
    setProgress((prev) => {
      if (prev[actionId] === status) {
        return { ...prev, [actionId]: 'pending' };
      }
      return { ...prev, [actionId]: status };
    });
  }, []);

  const resetModule = useCallback(() => {
    setProgress({});
    localStorage.removeItem(key);
  }, [key]);

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
  try {
    const key = `shiftguide_module_${moduleId}`;
    const saved = localStorage.getItem(key);
    if (!saved) {
      return { treatedCount: 0, totalActions: actionIds.length, isComplete: false };
    }
    const parsed: StoredData = JSON.parse(saved);
    const prog = parsed.actions ?? {};
    const treatedCount = actionIds.filter(
      (id) => prog[id] === 'validated' || prog[id] === 'na'
    ).length;
    return {
      treatedCount,
      totalActions: actionIds.length,
      isComplete: treatedCount === actionIds.length && actionIds.length > 0,
    };
  } catch {
    return { treatedCount: 0, totalActions: actionIds.length, isComplete: false };
  }
}
