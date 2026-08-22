export const PROGRESS_STORAGE_KEY = 'shiftguide_progress_v2';
export const LEGACY_PROGRESS_STORAGE_KEY = 'shiftguide_progress_v1';
export const LEGACY_MODULE_PREFIX = 'shiftguide_module_';
export const PROGRESS_VERSION = 2;

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

function normalizeCurrentState(value) {
  if (!isRecord(value)) return null;
  return {
    version: PROGRESS_VERSION,
    actions: sanitizeActions(value.actions),
    activeChoices: sanitizeActiveChoices(value.activeChoices),
    updatedAt: typeof value.updatedAt === 'number' ? value.updatedAt : 0,
  };
}

function emptyState() {
  return {
    version: PROGRESS_VERSION,
    actions: {},
    activeChoices: {},
    updatedAt: 0,
  };
}

function getLegacyKeys(storage) {
  const keys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(LEGACY_MODULE_PREFIX)) keys.push(key);
  }
  return keys;
}

function mergeLegacyActions(target, raw) {
  const parsed = parseJson(raw);
  const legacyActions = sanitizeActions(isRecord(parsed) ? parsed.actions : null);
  for (const [actionId, status] of Object.entries(legacyActions)) {
    if (!target[actionId]) target[actionId] = status;
  }
}

export function readProgressState(storage) {
  const current = normalizeCurrentState(parseJson(storage.getItem(PROGRESS_STORAGE_KEY)));
  const state = current ?? emptyState();
  const legacyKeys = getLegacyKeys(storage);
  const hasLegacyGlobal = storage.getItem(LEGACY_PROGRESS_STORAGE_KEY) !== null;
  const needsMigration = !current || hasLegacyGlobal || legacyKeys.length > 0;

  if (!needsMigration) return state;

  mergeLegacyActions(state.actions, storage.getItem(LEGACY_PROGRESS_STORAGE_KEY));
  for (const key of legacyKeys) mergeLegacyActions(state.actions, storage.getItem(key));

  const migrated = { ...state, updatedAt: Date.now() };
  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(migrated));
  storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);
  for (const key of legacyKeys) storage.removeItem(key);
  return migrated;
}

export function writeProgressState(storage, state) {
  const normalized = normalizeCurrentState(state) ?? emptyState();
  const next = { ...normalized, updatedAt: Date.now() };
  storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(next));
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
