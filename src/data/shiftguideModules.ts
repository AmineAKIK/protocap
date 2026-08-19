import { getShiftGuideData } from '../hooks/useShiftGuideAuth';
import type { LexiqueEntry, SGModule } from '../types/shiftGuide';

export type { LexiqueEntry, SGAction, SGModule, SGSubModule } from '../types/shiftGuide';

export function getSgModules(): SGModule[] {
  return getShiftGuideData()?.modules ?? [];
}

export function getLexiqueEntries(): LexiqueEntry[] {
  return getShiftGuideData()?.lexique ?? [];
}
