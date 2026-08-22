import { isValidShiftGuideData } from '../../shared/shiftGuideContract.js';
import type {
  SharedLexiqueEntry,
  SharedSGAction,
  SharedSGChoiceModule,
  SharedSGModule,
  SharedSGStandardModule,
  SharedSGSubModule,
  SharedSGUrgences,
  SharedShiftGuideData,
} from '../../shared/shiftGuideContract.js';

export type SGAction = SharedSGAction;
export type SGSubModule = SharedSGSubModule;
export type SGStandardModule = SharedSGStandardModule;
export type SGChoiceModule = SharedSGChoiceModule;

// Runtime validation guarantees the stricter SharedSGModule discriminated union.
// Existing view code still performs defensive checks, so expose a conservative
// projection at the UI boundary without weakening the shared runtime contract.
export type SGModule = Omit<SharedSGModule, 'type'> & {
  type: 'standard' | 'choice';
  actions?: SGAction[];
  subModules?: SGSubModule[];
};

export type LexiqueEntry = SharedLexiqueEntry;
export type SGUrgences = SharedSGUrgences;
export interface ShiftGuideData extends Omit<SharedShiftGuideData, 'modules'> {
  modules: SGModule[];
}

export function isShiftGuideData(value: unknown): value is ShiftGuideData {
  return isValidShiftGuideData(value);
}
