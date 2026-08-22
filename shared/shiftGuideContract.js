function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOptionalString(value) {
  return value === undefined || typeof value === 'string';
}

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasUniqueStrings(values) {
  return new Set(values).size === values.length;
}

function validateAction(value, path, errors, actionIds) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
  if (!isNonEmptyString(value.text)) errors.push(`${path}.text must be a non-empty string`);
  if (!isOptionalString(value.note)) errors.push(`${path}.note must be a string when provided`);

  if (isNonEmptyString(value.id)) {
    if (actionIds.has(value.id)) errors.push(`${path}.id duplicates action id "${value.id}"`);
    actionIds.add(value.id);
  }
}

function validateSubModule(value, path, errors, scopeIds, actionIds) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
  if (!isNonEmptyString(value.title)) errors.push(`${path}.title must be a non-empty string`);
  if (!isOptionalString(value.description)) errors.push(`${path}.description must be a string when provided`);
  if (!isOptionalString(value.footerNote)) errors.push(`${path}.footerNote must be a string when provided`);

  if (isNonEmptyString(value.id)) {
    if (scopeIds.has(value.id)) errors.push(`${path}.id duplicates module/submodule id "${value.id}"`);
    scopeIds.add(value.id);
  }

  if (!isNonEmptyArray(value.actions)) {
    errors.push(`${path}.actions must contain at least one action`);
  } else {
    value.actions.forEach((action, index) => validateAction(action, `${path}.actions[${index}]`, errors, actionIds));
  }
}

function validateModule(value, path, errors, scopeIds, actionIds) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
  if (!isNonEmptyString(value.title)) errors.push(`${path}.title must be a non-empty string`);
  if (typeof value.description !== 'string') errors.push(`${path}.description must be a string`);
  if (!isOptionalString(value.icon)) errors.push(`${path}.icon must be a string when provided`);
  if (!isOptionalString(value.footerNote)) errors.push(`${path}.footerNote must be a string when provided`);
  if (value.type !== 'standard' && value.type !== 'choice') errors.push(`${path}.type must be "standard" or "choice"`);

  if (isNonEmptyString(value.id)) {
    if (scopeIds.has(value.id)) errors.push(`${path}.id duplicates module/submodule id "${value.id}"`);
    scopeIds.add(value.id);
  }

  if (value.type === 'standard') {
    if (!isNonEmptyArray(value.actions)) {
      errors.push(`${path}.actions must contain at least one action`);
    } else {
      value.actions.forEach((action, index) => validateAction(action, `${path}.actions[${index}]`, errors, actionIds));
    }
    return;
  }

  if (value.type === 'choice') {
    if (!isNonEmptyArray(value.subModules)) {
      errors.push(`${path}.subModules must contain at least one submodule`);
    } else {
      value.subModules.forEach((subModule, index) =>
        validateSubModule(subModule, `${path}.subModules[${index}]`, errors, scopeIds, actionIds)
      );
    }
  }
}

function validateLexique(value, path, errors, sigles) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(value.sigle)) errors.push(`${path}.sigle must be a non-empty string`);
  if (!isNonEmptyString(value.definition)) errors.push(`${path}.definition must be a non-empty string`);
  if (isNonEmptyString(value.sigle)) {
    const key = value.sigle.trim().toLocaleUpperCase('fr-FR');
    if (sigles.has(key)) errors.push(`${path}.sigle duplicates lexicon entry "${value.sigle}"`);
    sigles.add(key);
  }
}

function validateUrgences(value, path, errors) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (!isNonEmptyArray(value.emergencyNumbers) || !value.emergencyNumbers.every(isNonEmptyString)) {
    errors.push(`${path}.emergencyNumbers must contain at least one non-empty string`);
  } else if (!hasUniqueStrings(value.emergencyNumbers)) {
    errors.push(`${path}.emergencyNumbers must be unique`);
  }

  if (!isRecord(value.generalAlarm)) {
    errors.push(`${path}.generalAlarm must be an object`);
  } else {
    if (!isNonEmptyString(value.generalAlarm.signal)) errors.push(`${path}.generalAlarm.signal must be a non-empty string`);
    if (!isNonEmptyString(value.generalAlarm.instruction)) errors.push(`${path}.generalAlarm.instruction must be a non-empty string`);
    if (!isNonEmptyArray(value.generalAlarm.steps) || !value.generalAlarm.steps.every(isNonEmptyString)) {
      errors.push(`${path}.generalAlarm.steps must contain at least one non-empty string`);
    }
  }

  if (!isRecord(value.drill)) {
    errors.push(`${path}.drill must be an object`);
  } else {
    if (!isNonEmptyString(value.drill.schedule)) errors.push(`${path}.drill.schedule must be a non-empty string`);
    if (!isNonEmptyString(value.drill.instruction)) errors.push(`${path}.drill.instruction must be a non-empty string`);
  }

  for (const [field, label] of [['accidentSteps', 'accident step'], ['goldenRules', 'golden rule']]) {
    const entries = value[field];
    if (!isNonEmptyArray(entries)) {
      errors.push(`${path}.${field} must contain at least one entry`);
      continue;
    }
    const ids = new Set();
    entries.forEach((entry, index) => {
      const entryPath = `${path}.${field}[${index}]`;
      if (!isRecord(entry)) {
        errors.push(`${entryPath} must be an object`);
        return;
      }
      if (!isNonEmptyString(entry.id)) errors.push(`${entryPath}.id must be a non-empty string`);
      if (!isNonEmptyString(entry.label)) errors.push(`${entryPath}.label must be a non-empty string`);
      if (!isNonEmptyString(entry.description)) errors.push(`${entryPath}.description must be a non-empty string`);
      if (isNonEmptyString(entry.id)) {
        if (ids.has(entry.id)) errors.push(`${entryPath}.id duplicates ${label} id "${entry.id}"`);
        ids.add(entry.id);
      }
    });
  }

  if (!isNonEmptyString(value.priorityMessage)) errors.push(`${path}.priorityMessage must be a non-empty string`);
  if (!isNonEmptyString(value.priorityDescription)) errors.push(`${path}.priorityDescription must be a non-empty string`);
}

export function validateShiftGuideData(value) {
  const errors = [];
  if (!isRecord(value)) return { ok: false, errors: ['ShiftGuide data must be an object'] };

  const scopeIds = new Set();
  const actionIds = new Set();
  const sigles = new Set();

  if (!isNonEmptyArray(value.modules)) {
    errors.push('modules must contain at least one module');
  } else {
    value.modules.forEach((module, index) =>
      validateModule(module, `modules[${index}]`, errors, scopeIds, actionIds)
    );
  }

  if (!Array.isArray(value.lexique)) {
    errors.push('lexique must be an array');
  } else {
    value.lexique.forEach((entry, index) => validateLexique(entry, `lexique[${index}]`, errors, sigles));
  }

  validateUrgences(value.urgences, 'urgences', errors);
  return { ok: errors.length === 0, errors };
}

export function validateShiftGuideConfig(value) {
  const result = validateShiftGuideData(value);
  if (!isRecord(value)) return result;
  if (value.systemPromptExtra !== undefined && value.systemPromptExtra !== null && typeof value.systemPromptExtra !== 'string') {
    return { ok: false, errors: [...result.errors, 'systemPromptExtra must be a string, null or undefined'] };
  }
  return result;
}

export function isValidShiftGuideData(value) {
  return validateShiftGuideData(value).ok;
}

export function isValidShiftGuideConfig(value) {
  return validateShiftGuideConfig(value).ok;
}
