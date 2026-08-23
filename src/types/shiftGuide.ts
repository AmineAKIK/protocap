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
export type SGModule = SharedSGModule;
export type LexiqueEntry = SharedLexiqueEntry;
export type SGUrgences = SharedSGUrgences;
export type ShiftGuideData = SharedShiftGuideData;

export function isShiftGuideData(value: unknown): value is ShiftGuideData {
  return isValidShiftGuideData(value);
}
