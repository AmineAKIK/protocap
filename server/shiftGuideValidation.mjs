function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isOptionalString(value) {
  return value === undefined || typeof value === 'string';
}

function isAction(value) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.text === 'string' &&
    value.text.length > 0 &&
    isOptionalString(value.note)
  );
}

function isSubModule(value) {
  return (
    isRecord(value) &&
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

function isModule(value) {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    value.id.length === 0 ||
    typeof value.title !== 'string' ||
    value.title.length === 0 ||
    !isOptionalString(value.icon) ||
    typeof value.description !== 'string' ||
    !isOptionalString(value.footerNote) ||
    (value.type !== 'standard' && value.type !== 'choice')
  ) {
    return false;
  }

  if (value.type === 'standard') {
    return Array.isArray(value.actions) && value.actions.every(isAction);
  }

  return Array.isArray(value.subModules) && value.subModules.every(isSubModule);
}

function isLexiqueEntry(value) {
  return (
    isRecord(value) &&
    typeof value.sigle === 'string' &&
    value.sigle.length > 0 &&
    typeof value.definition === 'string' &&
    value.definition.length > 0
  );
}

export function isValidShiftGuideConfig({ modules, lexique }) {
  return (
    Array.isArray(modules) &&
    modules.every(isModule) &&
    Array.isArray(lexique) &&
    lexique.every(isLexiqueEntry)
  );
}
