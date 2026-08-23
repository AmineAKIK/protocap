export type SharedActionStatus = 'pending' | 'validated' | 'na';

export interface SharedProgressState {
  version: 3;
  configRevision: string;
  actions: Record<string, Exclude<SharedActionStatus, 'pending'>>;
  activeChoices: Record<string, string>;
  updatedAt: number;
}

export interface SharedProgressSummary {
  treatedCount: number;
  totalActions: number;
  isComplete: boolean;
}

export interface SharedChoiceSummary extends SharedProgressSummary {
  activeSubModuleId: string | null;
}

export interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface ChoiceAction {
  id: string;
}

interface ChoiceSubModule {
  id: string;
  actions: ChoiceAction[];
}

interface ChoiceModule {
  id: string;
  type: 'choice';
  subModules: ChoiceSubModule[];
}

export const CONFIG_REVISION_STORAGE_KEY: 'shiftguide_config_revision';
export const PROGRESS_STORAGE_KEY: 'shiftguide_progress_v3';
export const LEGACY_PROGRESS_V2_STORAGE_KEY: 'shiftguide_progress_v2';
export const LEGACY_PROGRESS_STORAGE_KEY: 'shiftguide_progress_v1';
export const LEGACY_MODULE_PREFIX: 'shiftguide_module_';
export const PROGRESS_VERSION: 3;

export function readProgressState(storage: StorageLike): SharedProgressState;
export function writeProgressState(storage: StorageLike, state: SharedProgressState): SharedProgressState;
export function withActionStatus(
  state: SharedProgressState,
  actionId: string,
  status: SharedActionStatus
): SharedProgressState;
export function withActiveChoice(
  state: SharedProgressState,
  moduleId: string,
  subModuleId: string
): SharedProgressState;
export function withoutActions(state: SharedProgressState, actionIds: string[]): SharedProgressState;
export function getActionStatus(state: SharedProgressState, actionId: string): SharedActionStatus;
export function getActionProgress(
  state: SharedProgressState,
  actionIds: string[]
): Record<string, SharedActionStatus>;
export function summarizeActions(state: SharedProgressState, actionIds: string[]): SharedProgressSummary;
export function resolveActiveChoice(state: SharedProgressState, module: ChoiceModule): string | null;
export function summarizeChoiceModule(state: SharedProgressState, module: ChoiceModule): SharedChoiceSummary;
