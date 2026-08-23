import {
  CONFIG_REVISION_STORAGE_KEY,
  LEGACY_MODULE_PREFIX,
  LEGACY_PROGRESS_STORAGE_KEY,
  LEGACY_PROGRESS_V2_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
} from './shiftGuidePersistence.js';

export {
  CONFIG_REVISION_STORAGE_KEY,
  LEGACY_MODULE_PREFIX,
  LEGACY_PROGRESS_STORAGE_KEY,
  LEGACY_PROGRESS_V2_STORAGE_KEY,
  PROGRESS_STORAGE_KEY,
} from './shiftGuidePersistence.js';

export const PROGRESS_VERSION = 3;

const VALID_STATUSES = new Set(['validated', 'na']);

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseJson(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function safeGetItem(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(storage, key, value) {
  try {
    storage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(storage, key) {
  try {
    storage.removeItem(key);
  } catch {
    // Progress persistence is optional at runtime; callers may keep state in memory.
  }
}

function sanitizeActions(value) {
  if (!isRecord(value)) return {};
  const actions = {};
  for (const [actionId, status] of Object.entries(value)) {
    if (typeof actionId === 'string' && actionId && VALID_STATUSES.has(status)) {
      actions[actionId] = status;
    }
  }
  return actions;
}

function sanitizeActiveChoices(value) {
  if (!isRecord(value)) return {};
  const activeChoices = {};
  for (const [moduleId, subModuleId] of Object.entries(value)) {
    if (
      typeof moduleId === 'string' && moduleId &&
      typeof subModuleId === 'string' && subModuleId
    ) {
      activeChoices[moduleId] = subModuleId;
    }
  }
  return activeChoices;
}

function normalizeCurrentState(value, configRevision) {
  if (!isRecord(value)) return null;
  if (value.version !== PROGRESS_VERSION) return null;
  if (value.configRevision !== configRevision) return null;
  return {
    version: PROGRESS_VERSION,
    configRevision,
    actions: sanitizeActions(value.actions),
    activeChoices: sanitizeActiveChoices(value.activeChoices),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function emptyState(configRevision) {
  return {
    version: PROGRESS_VERSION,
    configRevision,
    actions: {},
    activeChoices: {},
    updatedAt: 0,
  };
}

function getLegacyKeys(storage) {
  const keys = [];
  let length;
  try {
    length = storage.length;
  } catch {
    return keys;
  }
  for (let index = 0; index < length; index += 1) {
    try {
      const key = storage.key(index);
      if (typeof key === 'string' && key.startsWith(LEGACY_MODULE_PREFIX)) keys.push(key);
    } catch {
      return keys;
    }
  }
  return keys;
}

function clearLegacyProgress(storage) {
  safeRemoveItem(storage, LEGACY_PROGRESS_STORAGE_KEY);
  safeRemoveItem(storage, LEGACY_PROGRESS_V2_STORAGE_KEY);
  for (const key of getLegacyKeys(storage)) safeRemoveItem(storage, key);
}

export function readProgressState(storage) {
  const configRevision = safeGetItem(storage, CONFIG_REVISION_STORAGE_KEY);
  if (!configRevision) return emptyState('');

  const current = normalizeCurrentState(parseJson(safeGetItem(storage, PROGRESS_STORAGE_KEY)), configRevision);
  const hasLegacy =
    safeGetItem(storage, LEGACY_PROGRESS_STORAGE_KEY) !== null ||
    safeGetItem(storage, LEGACY_PROGRESS_V2_STORAGE_KEY) !== null ||
    getLegacyKeys(storage).length > 0;

  if (current && !hasLegacy) return current;

  clearLegacyProgress(storage);
  if (current) return current;

  const fresh = { ...emptyState(configRevision), updatedAt: Date.now() };
  safeSetItem(storage, PROGRESS_STORAGE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function writeProgressState(storage, state) {
  const configRevision = safeGetItem(storage, CONFIG_REVISION_STORAGE_KEY);
  if (!configRevision) return emptyState('');

  const normalized = normalizeCurrentState(state, configRevision) ?? emptyState(configRevision);
  const next = { ...normalized, updatedAt: Date.now() };
  safeSetItem(storage, PROGRESS_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function withActionStatus(state, actionId, status) {
  const actions = { ...state.actions };
  if (status === 'pending') delete actions[actionId];
  else if (VALID_STATUSES.has(status)) actions[actionId] = status;
  return { ...state, actions };
}

export function withActiveChoice(state, moduleId, subModuleId) {
  return {
    ...state,
    activeChoices: { ...state.activeChoices, [moduleId]: subModuleId },
  };
}

export function withoutActions(state, actionIds) {
  const actions = { ...state.actions };
  for (const actionId of actionIds) delete actions[actionId];
  return { ...state, actions };
}

export function getActionStatus(state, actionId) {
  return state.actions[actionId] ?? 'pending';
}

export function getActionProgress(state, actionIds) {
  return Object.fromEntries(actionIds.map((actionId) => [actionId, getActionStatus(state, actionId)]));
}

export function summarizeActions(state, actionIds) {
  const treatedCount = actionIds.filter((actionId) => {
    const status = getActionStatus(state, actionId);
    return status === 'validated' || status === 'na';
  }).length;
  return {
    treatedCount,
    totalActions: actionIds.length,
    isComplete: actionIds.length > 0 && treatedCount === actionIds.length,
  };
}

export function resolveActiveChoice(state, module) {
  if (!module || module.type !== 'choice' || !Array.isArray(module.subModules)) return null;

  const configured = state.activeChoices[module.id];
  if (configured && module.subModules.some((subModule) => subModule.id === configured)) {
    return configured;
  }

  let best = null;
  let bestTreated = 0;
  for (const subModule of module.subModules) {
    const summary = summarizeActions(state, subModule.actions.map((action) => action.id));
    if (summary.treatedCount > bestTreated) {
      best = subModule.id;
      bestTreated = summary.treatedCount;
    }
  }
  return best;
}

export function summarizeChoiceModule(state, module) {
  const activeSubModuleId = resolveActiveChoice(state, module);
  if (!activeSubModuleId) {
    return { treatedCount: 0, totalActions: 0, isComplete: false, activeSubModuleId: null };
  }
  const activeSubModule = module.subModules.find((subModule) => subModule.id === activeSubModuleId);
  if (!activeSubModule) {
    return { treatedCount: 0, totalActions: 0, isComplete: false, activeSubModuleId: null };
  }
  return {
    ...summarizeActions(state, activeSubModule.actions.map((action) => action.id)),
    activeSubModuleId,
  };
}
