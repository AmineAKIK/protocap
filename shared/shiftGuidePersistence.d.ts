export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const CONFIG_REVISION_STORAGE_KEY: 'shiftguide_config_revision';
export const CELINE_AUTHORITY_REVISION_STORAGE_KEY: 'shiftguide_celine_authority_revision';
export const CELINE_HISTORY_STORAGE_KEY: 'shiftguide_celine_history';
export const PROGRESS_STORAGE_KEY: 'shiftguide_progress_v3';
export const LEGACY_PROGRESS_V2_STORAGE_KEY: 'shiftguide_progress_v2';
export const LEGACY_PROGRESS_STORAGE_KEY: 'shiftguide_progress_v1';
export const LEGACY_MODULE_PREFIX: 'shiftguide_module_';

export function clearCelineHistory(storage: StorageLike): void;
export function clearRevisionBoundShiftGuideData(storage: StorageLike): void;
export function reconcileShiftGuideConfigRevision(storage: StorageLike, configRevision: string): boolean;
export function reconcileCelineAuthorityRevision(storage: StorageLike, authorityRevision: string): boolean;
