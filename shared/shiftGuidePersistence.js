export const CONFIG_REVISION_STORAGE_KEY = 'shiftguide_config_revision';
export const CELINE_HISTORY_STORAGE_KEY = 'shiftguide_celine_history';
export const CELINE_PROMPT_VERSION_STORAGE_KEY = 'shiftguide_prompt_version';
export const PROGRESS_STORAGE_KEY = 'shiftguide_progress_v3';
export const LEGACY_PROGRESS_V2_STORAGE_KEY = 'shiftguide_progress_v2';
export const LEGACY_PROGRESS_STORAGE_KEY = 'shiftguide_progress_v1';
export const LEGACY_MODULE_PREFIX = 'shiftguide_module_';

export function clearRevisionBoundShiftGuideData(storage) {
  storage.removeItem(CELINE_HISTORY_STORAGE_KEY);
  storage.removeItem(CELINE_PROMPT_VERSION_STORAGE_KEY);
  storage.removeItem(PROGRESS_STORAGE_KEY);
  storage.removeItem(LEGACY_PROGRESS_V2_STORAGE_KEY);
  storage.removeItem(LEGACY_PROGRESS_STORAGE_KEY);

  const legacyModuleKeys = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.startsWith(LEGACY_MODULE_PREFIX)) {
      legacyModuleKeys.push(key);
    }
  }
  for (const key of legacyModuleKeys) storage.removeItem(key);
}

export function reconcileShiftGuideConfigRevision(storage, configRevision) {
  if (typeof configRevision !== 'string' || configRevision.length === 0) return false;

  const previousRevision = storage.getItem(CONFIG_REVISION_STORAGE_KEY);
  if (previousRevision !== configRevision) {
    clearRevisionBoundShiftGuideData(storage);
    storage.setItem(CONFIG_REVISION_STORAGE_KEY, configRevision);
    return true;
  }

  return false;
}
