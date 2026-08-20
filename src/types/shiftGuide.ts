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
  icon?: string;
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

export interface ShiftGuideData {
  modules: SGModule[];
  lexique: LexiqueEntry[];
  urgences: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isAction(value: unknown): value is SGAction {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.text === 'string' &&
    value.text.length > 0 &&
    isOptionalString(value.note)
  );
}

function isSubModule(value: unknown): value is SGSubModule {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.title === 'string' &&
    value.title.length > 0 &&
    isOptionalString(value.description) &&
    Array.isArray(value.actions) &&
    value.actions.every(isAction) &&
    isOptionalString(value.footerNote)
  );
}

function isModule(value: unknown): value is SGModule {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.title !== 'string' ||
    value.title.length === 0 ||
    !isOptionalString(value.icon) ||
    typeof value.description !== 'string' ||
    (value.type !== 'standard' && value.type !== 'choice') ||
    !isOptionalString(value.footerNote)
  ) {
    return false;
  }

  if (value.type === 'standard') {
    return Array.isArray(value.actions) && value.actions.every(isAction);
  }

  return Array.isArray(value.subModules) && value.subModules.every(isSubModule);
}

function isLexiqueEntry(value: unknown): value is LexiqueEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.sigle === 'string' &&
    value.sigle.length > 0 &&
    typeof value.definition === 'string' &&
    value.definition.length > 0
  );
}

export function isShiftGuideData(value: unknown): value is ShiftGuideData {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.modules) &&
    value.modules.every(isModule) &&
    Array.isArray(value.lexique) &&
    value.lexique.every(isLexiqueEntry) &&
    'urgences' in value
  );
}
