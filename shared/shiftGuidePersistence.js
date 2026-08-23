export const CONFIG_REVISION_STORAGE_KEY = 'shiftguide_config_revision';
export const CELINE_AUTHORITY_REVISION_STORAGE_KEY = 'shiftguide_celine_authority_revision';
export const CELINE_HISTORY_STORAGE_KEY = 'shiftguide_celine_history';
export const CELINE_PROMPT_VERSION_STORAGE_KEY = 'shiftguide_prompt_version';
export const PROGRESS_STORAGE_KEY = 'shiftguide_progress_v3';
export const LEGACY_PROGRESS_V2_STORAGE_KEY = 'shiftguide_progress_v2';
export const LEGACY_PROGRESS_STORAGE_KEY = 'shiftguide_progress_v1';
export const LEGACY_MODULE_PREFIX = 'shiftguide_module_';

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
    // Persistence cleanup must not crash ShiftGuide.
  }
}

function safeKeys(storage) {
  const keys = [];
  let length = 0;
  try {
    length = storage.length;
  } catch {
    return keys;
  }
  for (let index = 0; index < length; index += 1) {
    try {
      const key = storage.key(index);
      if (typeof key === 'string') keys.push(key);
    } catch {
      return keys;
    }
  }
  return keys;
}

export function clearCelineHistory(storage) {
  safeRemoveItem(storage, CELINE_HISTORY_STORAGE_KEY);
  safeRemoveItem(storage, CELINE_PROMPT_VERSION_STORAGE_KEY);
}

export function clearRevisionBoundShiftGuideData(storage) {
  clearCelineHistory(storage);
  safeRemoveItem(storage, PROGRESS_STORAGE_KEY);
  safeRemoveItem(storage, LEGACY_PROGRESS_V2_STORAGE_KEY);
  safeRemoveItem(storage, LEGACY_PROGRESS_STORAGE_KEY);

  for (const key of safeKeys(storage)) {
    if (key.startsWith(LEGACY_MODULE_PREFIX)) safeRemoveItem(storage, key);
  }
}

export function reconcileShiftGuideConfigRevision(storage, configRevision) {
  if (typeof configRevision !== 'string' || configRevision.length === 0) return false;

  const previousRevision = safeGetItem(storage, CONFIG_REVISION_STORAGE_KEY);
  if (previousRevision !== configRevision) {
    clearRevisionBoundShiftGuideData(storage);
    safeSetItem(storage, CONFIG_REVISION_STORAGE_KEY, configRevision);
    return true;
  }

  return false;
}

export function reconcileCelineAuthorityRevision(storage, authorityRevision) {
  if (typeof authorityRevision !== 'string' || authorityRevision.length === 0) return false;

  const previousRevision = safeGetItem(storage, CELINE_AUTHORITY_REVISION_STORAGE_KEY);
  if (previousRevision !== authorityRevision) {
    clearCelineHistory(storage);
    safeSetItem(storage, CELINE_AUTHORITY_REVISION_STORAGE_KEY, authorityRevision);
    return true;
  }

  return false;
}
