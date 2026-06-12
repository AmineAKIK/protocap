import { getShiftGuideData } from '../hooks/useShiftGuideAuth';

export interface SGAction {
  id: string;
  text: string;
  note?: string;
}

export interface SGSubModule {
  id: string;
  title: string;
  description?: string;
  actions: SGAction[];
  footerNote?: string;
}

export interface SGModule {
  id: string;
  title: string;
  icon: string;
  description: string;
  type: 'standard' | 'choice';
  actions?: SGAction[];
  subModules?: SGSubModule[];
  footerNote?: string;
}

export interface LexiqueEntry {
  sigle: string;
  definition: string;
}

export function getSgModules(): SGModule[] {
  const data = getShiftGuideData();
  return (data?.modules as SGModule[]) ?? [];
}

export function getLexiqueEntries(): LexiqueEntry[] {
  const data = getShiftGuideData();
  return (data?.lexique as LexiqueEntry[]) ?? [];
}
