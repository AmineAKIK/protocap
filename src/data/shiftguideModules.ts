import { getShiftGuideData } from '../hooks/useShiftGuideAuth';
import type { LexiqueEntry, SGModule, SGUrgences } from '../types/shiftGuide';

export type {
  LexiqueEntry,
  SGAction,
  SGChoiceModule,
  SGModule,
  SGStandardModule,
  SGSubModule,
  SGUrgences,
} from '../types/shiftGuide';

export function getSgModules(): SGModule[] {
  return getShiftGuideData()?.modules ?? [];
}

export function getLexiqueEntries(): LexiqueEntry[] {
  return getShiftGuideData()?.lexique ?? [];
}

export function getSgUrgences(): SGUrgences | null {
  return getShiftGuideData()?.urgences ?? null;
}
