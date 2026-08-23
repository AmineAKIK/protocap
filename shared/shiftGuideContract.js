import { CONFIG_BUDGETS } from './configBudgets.js';

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

function validateStringBudget(value, path, errors, maxChars) {
  if (typeof value === 'string' && value.length > maxChars) {
    errors.push(`${path} must contain at most ${maxChars} characters`);
  }
}

function validateArrayBudget(value, path, errors, maxItems) {
  if (Array.isArray(value) && value.length > maxItems) {
    errors.push(`${path} must contain at most ${maxItems} entries`);
  }
}

function validateAction(value, path, errors, actionIds, counters) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
  if (!isNonEmptyString(value.text)) errors.push(`${path}.text must be a non-empty string`);
  if (!isOptionalString(value.note)) errors.push(`${path}.note must be a string when provided`);
  validateStringBudget(value.id, `${path}.id`, errors, CONFIG_BUDGETS.idChars);
  validateStringBudget(value.text, `${path}.text`, errors, CONFIG_BUDGETS.textChars);
  validateStringBudget(value.note, `${path}.note`, errors, CONFIG_BUDGETS.textChars);

  counters.actions += 1;

  if (isNonEmptyString(value.id)) {
    if (actionIds.has(value.id)) errors.push(`${path}.id duplicates action id "${value.id}"`);
    actionIds.add(value.id);
  }
}

function validateSubModule(value, path, errors, scopeIds, actionIds, counters) {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }
  if (!isNonEmptyString(value.id)) errors.push(`${path}.id must be a non-empty string`);
  if (!isNonEmptyString(value.title)) errors.push(`${path}.title must be a non-empty string`);
  if (!isOptionalString(value.description)) errors.push(`${path}.description must be a string when provided`);
  if (!isOptionalString(value.footerNote)) errors.push(`${path}.footerNote must be a string when provided`);
  validateStringBudget(value.id, `${path}.id`, errors, CONFIG_BUDGETS.idChars);
  validateStringBudget(value.title, `${path}.title`, errors, CONFIG_BUDGETS.shortTextChars);
  validateStringBudget(value.description, `${path}.description`, errors, CONFIG_BUDGETS.textChars);
  validateStringBudget(value.footerNote, `${path}.footerNote`, errors, CONFIG_BUDGETS.textChars);

  if (isNonEmptyString(value.id)) {
    if (scopeIds.has(value.id)) errors.push(`${path}.id duplicates module/submodule id "${value.id}"`);
    scopeIds.add(value.id);
  }

  if (!isNonEmptyArray(value.actions)) {
    errors.push(`${path}.actions must contain at least one action`);
  } else {
    validateArrayBudget(value.actions, `${path}.actions`, errors, CONFIG_BUDGETS.actionsPerScope);
    value.actions.forEach((action, index) => validateAction(action, `${path}.actions[${index}]`, errors, actionIds, counters));
  }
}

function validateModule(value, path, errors, scopeIds, actionIds, counters) {
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
  validateStringBudget(value.id, `${path}.id`, errors, CONFIG_BUDGETS.idChars);
  validateStringBudget(value.title, `${path}.title`, errors, CONFIG_BUDGETS.shortTextChars);
  validateStringBudget(value.description, `${path}.description`, errors, CONFIG_BUDGETS.textChars);
  validateStringBudget(value.icon, `${path}.icon`, errors, CONFIG_BUDGETS.shortTextChars);
  validateStringBudget(value.footerNote, `${path}.footerNote`, errors, CONFIG_BUDGETS.textChars);

  if (isNonEmptyString(value.id)) {
    if (scopeIds.has(value.id)) errors.push(`${path}.id duplicates module/submodule id "${value.id}"`);
    scopeIds.add(value.id);
  }

  if (value.type === 'standard') {
    if (!isNonEmptyArray(value.actions)) {
      errors.push(`${path}.actions must contain at least one action`);
    } else {
      validateArrayBudget(value.actions, `${path}.actions`, errors, CONFIG_BUDGETS.actionsPerScope);
      value.actions.forEach((action, index) => validateAction(action, `${path}.actions[${index}]`, errors, actionIds, counters));
    }
    return;
  }

  if (value.type === 'choice') {
    if (!isNonEmptyArray(value.subModules)) {
      errors.push(`${path}.subModules must contain at least one submodule`);
    } else {
      validateArrayBudget(value.subModules, `${path}.subModules`, errors, CONFIG_BUDGETS.subModulesPerModule);
      value.subModules.forEach((subModule, index) =>
        validateSubModule(subModule, `${path}.subModules[${index}]`, errors, scopeIds, actionIds, counters)
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
  validateStringBudget(value.sigle, `${path}.sigle`, errors, CONFIG_BUDGETS.shortTextChars);
  validateStringBudget(value.definition, `${path}.definition`, errors, CONFIG_BUDGETS.textChars);
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
  validateArrayBudget(value.emergencyNumbers, `${path}.emergencyNumbers`, errors, CONFIG_BUDGETS.emergencyNumbers);
  if (Array.isArray(value.emergencyNumbers)) {
    value.emergencyNumbers.forEach((number, index) => validateStringBudget(number, `${path}.emergencyNumbers[${index}]`, errors, CONFIG_BUDGETS.shortTextChars));
  }

  if (!isRecord(value.generalAlarm)) {
    errors.push(`${path}.generalAlarm must be an object`);
  } else {
    if (!isNonEmptyString(value.generalAlarm.signal)) errors.push(`${path}.generalAlarm.signal must be a non-empty string`);
    if (!isNonEmptyString(value.generalAlarm.instruction)) errors.push(`${path}.generalAlarm.instruction must be a non-empty string`);
    if (!isNonEmptyArray(value.generalAlarm.steps) || !value.generalAlarm.steps.every(isNonEmptyString)) {
      errors.push(`${path}.generalAlarm.steps must contain at least one non-empty string`);
    }
    validateStringBudget(value.generalAlarm.signal, `${path}.generalAlarm.signal`, errors, CONFIG_BUDGETS.shortTextChars);
    validateStringBudget(value.generalAlarm.instruction, `${path}.generalAlarm.instruction`, errors, CONFIG_BUDGETS.textChars);
    validateArrayBudget(value.generalAlarm.steps, `${path}.generalAlarm.steps`, errors, CONFIG_BUDGETS.emergencySteps);
    if (Array.isArray(value.generalAlarm.steps)) {
      value.generalAlarm.steps.forEach((step, index) => validateStringBudget(step, `${path}.generalAlarm.steps[${index}]`, errors, CONFIG_BUDGETS.textChars));
    }
  }

  if (!isRecord(value.drill)) {
    errors.push(`${path}.drill must be an object`);
  } else {
    if (!isNonEmptyString(value.drill.schedule)) errors.push(`${path}.drill.schedule must be a non-empty string`);
    if (!isNonEmptyString(value.drill.instruction)) errors.push(`${path}.drill.instruction must be a non-empty string`);
    validateStringBudget(value.drill.schedule, `${path}.drill.schedule`, errors, CONFIG_BUDGETS.shortTextChars);
    validateStringBudget(value.drill.instruction, `${path}.drill.instruction`, errors, CONFIG_BUDGETS.textChars);
  }

  for (const [field, label] of [['accidentSteps', 'accident step'], ['goldenRules', 'golden rule']]) {
    const entries = value[field];
    if (!isNonEmptyArray(entries)) {
      errors.push(`${path}.${field} must contain at least one entry`);
      continue;
    }
    validateArrayBudget(entries, `${path}.${field}`, errors, CONFIG_BUDGETS.emergencyEntries);
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
      validateStringBudget(entry.id, `${entryPath}.id`, errors, CONFIG_BUDGETS.idChars);
      validateStringBudget(entry.label, `${entryPath}.label`, errors, CONFIG_BUDGETS.shortTextChars);
      validateStringBudget(entry.description, `${entryPath}.description`, errors, CONFIG_BUDGETS.textChars);
      if (isNonEmptyString(entry.id)) {
        if (ids.has(entry.id)) errors.push(`${entryPath}.id duplicates ${label} id "${entry.id}"`);
        ids.add(entry.id);
      }
    });
  }

  if (!isNonEmptyString(value.priorityMessage)) errors.push(`${path}.priorityMessage must be a non-empty string`);
  if (!isNonEmptyString(value.priorityDescription)) errors.push(`${path}.priorityDescription must be a non-empty string`);
  validateStringBudget(value.priorityMessage, `${path}.priorityMessage`, errors, CONFIG_BUDGETS.textChars);
  validateStringBudget(value.priorityDescription, `${path}.priorityDescription`, errors, CONFIG_BUDGETS.textChars);
}

function canonicalizeAction(action) {
  return {
    id: action.id,
    text: action.text,
    ...(action.note !== undefined ? { note: action.note } : {}),
  };
}

function canonicalizeSubModule(subModule) {
  return {
    id: subModule.id,
    title: subModule.title,
    ...(subModule.description !== undefined ? { description: subModule.description } : {}),
    actions: subModule.actions.map(canonicalizeAction),
    ...(subModule.footerNote !== undefined ? { footerNote: subModule.footerNote } : {}),
  };
}

function canonicalizeModule(module) {
  const common = {
    id: module.id,
    title: module.title,
    ...(module.icon !== undefined ? { icon: module.icon } : {}),
    description: module.description,
    type: module.type,
  };

  if (module.type === 'standard') {
    return {
      ...common,
      actions: module.actions.map(canonicalizeAction),
      ...(module.footerNote !== undefined ? { footerNote: module.footerNote } : {}),
    };
  }

  return {
    ...common,
    subModules: module.subModules.map(canonicalizeSubModule),
    ...(module.footerNote !== undefined ? { footerNote: module.footerNote } : {}),
  };
}

function canonicalizeUrgencyStep(step) {
  return {
    id: step.id,
    label: step.label,
    description: step.description,
  };
}

function canonicalizeUrgences(urgences) {
  return {
    emergencyNumbers: [...urgences.emergencyNumbers],
    generalAlarm: {
      signal: urgences.generalAlarm.signal,
      instruction: urgences.generalAlarm.instruction,
      steps: [...urgences.generalAlarm.steps],
    },
    drill: {
      schedule: urgences.drill.schedule,
      instruction: urgences.drill.instruction,
    },
    accidentSteps: urgences.accidentSteps.map(canonicalizeUrgencyStep),
    goldenRules: urgences.goldenRules.map(canonicalizeUrgencyStep),
    priorityMessage: urgences.priorityMessage,
    priorityDescription: urgences.priorityDescription,
  };
}

function canonicalizeValidShiftGuideData(value) {
  return {
    modules: value.modules.map(canonicalizeModule),
    lexique: value.lexique.map((entry) => ({
      sigle: entry.sigle,
      definition: entry.definition,
    })),
    urgences: canonicalizeUrgences(value.urgences),
  };
}

export function validateShiftGuideData(value) {
  const errors = [];
  if (!isRecord(value)) return { ok: false, errors: ['ShiftGuide data must be an object'] };

  const scopeIds = new Set();
  const actionIds = new Set();
  const sigles = new Set();
  const counters = { actions: 0 };

  if (!isNonEmptyArray(value.modules)) {
    errors.push('modules must contain at least one module');
  } else {
    validateArrayBudget(value.modules, 'modules', errors, CONFIG_BUDGETS.modules);
    value.modules.forEach((module, index) =>
      validateModule(module, `modules[${index}]`, errors, scopeIds, actionIds, counters)
    );
  }

  if (counters.actions > CONFIG_BUDGETS.totalActions) {
    errors.push(`modules must contain at most ${CONFIG_BUDGETS.totalActions} actions in total`);
  }

  if (!Array.isArray(value.lexique)) {
    errors.push('lexique must be an array');
  } else {
    validateArrayBudget(value.lexique, 'lexique', errors, CONFIG_BUDGETS.lexiconEntries);
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
  const errors = [...result.errors];
  validateStringBudget(value.systemPromptExtra, 'systemPromptExtra', errors, CONFIG_BUDGETS.systemPromptExtraChars);
  return { ok: errors.length === 0, errors };
}

export function parseShiftGuideData(value) {
  const validation = validateShiftGuideData(value);
  if (!validation.ok) return { ...validation, value: null };
  return { ok: true, errors: [], value: canonicalizeValidShiftGuideData(value) };
}

export function parseShiftGuideConfig(value) {
  const validation = validateShiftGuideConfig(value);
  if (!validation.ok) return { ...validation, value: null };
  return {
    ok: true,
    errors: [],
    value: {
      ...canonicalizeValidShiftGuideData(value),
      systemPromptExtra: value.systemPromptExtra ?? null,
    },
  };
}

export function isValidShiftGuideData(value) {
  return validateShiftGuideData(value).ok;
}

export function isValidShiftGuideConfig(value) {
  return validateShiftGuideConfig(value).ok;
}
