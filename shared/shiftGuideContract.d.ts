export interface SharedSGAction {
  id: string;
  text: string;
  note?: string;
}

export interface SharedSGSubModule {
  id: string;
  title: string;
  description?: string;
  actions: SharedSGAction[];
  footerNote?: string;
}

export interface SharedSGStandardModule {
  id: string;
  title: string;
  icon?: string;
  description: string;
  type: 'standard';
  actions: SharedSGAction[];
  footerNote?: string;
}

export interface SharedSGChoiceModule {
  id: string;
  title: string;
  icon?: string;
  description: string;
  type: 'choice';
  subModules: SharedSGSubModule[];
  footerNote?: string;
}

export type SharedSGModule = SharedSGStandardModule | SharedSGChoiceModule;

export interface SharedLexiqueEntry {
  sigle: string;
  definition: string;
}

export interface SharedUrgencyStep {
  id: string;
  label: string;
  description: string;
}

export interface SharedSGUrgences {
  emergencyNumbers: string[];
  generalAlarm: {
    signal: string;
    instruction: string;
    steps: string[];
  };
  drill: {
    schedule: string;
    instruction: string;
  };
  accidentSteps: SharedUrgencyStep[];
  goldenRules: SharedUrgencyStep[];
  priorityMessage: string;
  priorityDescription: string;
}

export interface SharedShiftGuideData {
  modules: SharedSGModule[];
  lexique: SharedLexiqueEntry[];
  urgences: SharedSGUrgences;
}

export interface SharedShiftGuideConfig extends SharedShiftGuideData {
  systemPromptExtra?: string | null;
}

export interface CanonicalShiftGuideConfig extends SharedShiftGuideData {
  systemPromptExtra: string | null;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export type ParseResult<T> =
  | { ok: true; errors: []; value: T }
  | { ok: false; errors: string[]; value: null };

export function validateShiftGuideData(value: unknown): ValidationResult;
export function validateShiftGuideConfig(value: unknown): ValidationResult;
export function parseShiftGuideData(value: unknown): ParseResult<SharedShiftGuideData>;
export function parseShiftGuideConfig(value: unknown): ParseResult<CanonicalShiftGuideConfig>;
export function isValidShiftGuideData(value: unknown): value is SharedShiftGuideData;
export function isValidShiftGuideConfig(value: unknown): value is SharedShiftGuideConfig;
