import { createHash } from 'node:crypto';
import { CONFIG_BUDGETS } from '../shared/configBudgets.js';

const PROTOCOL_REVISION = 'decision-v2';

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function validateStringBudget(value, path, errors, maxChars) {
  if (typeof value === 'string' && value.length > maxChars) {
    errors.push(`${path} must contain at most ${maxChars} characters`);
  }
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function collectActionIds(modules) {
  const ids = new Set();
  for (const module of modules) {
    if (module.type === 'choice') {
      for (const subModule of module.subModules) {
        for (const action of subModule.actions) ids.add(action.id);
      }
    } else {
      for (const action of module.actions) ids.add(action.id);
    }
  }
  return ids;
}

function canonicalizeValidRoutingSpec(spec) {
  return {
    version: spec.version,
    routes: spec.routes.map((route) => ({
      id: route.id,
      label: route.label,
      decisionGuide: route.decisionGuide,
      actionIds: [...route.actionIds],
    })),
    clarifications: spec.clarifications.map((clarification) => ({
      id: clarification.id,
      question: clarification.question,
      decisionGuide: clarification.decisionGuide,
    })),
    classifierRules: [...spec.classifierRules],
  };
}

export function validateCelineRoutingSpec(spec, shiftGuideConfig) {
  const errors = [];
  if (!isRecord(spec)) return { ok: false, errors: ['Celine routing spec must be an object'] };
  if (!Number.isInteger(spec.version) || spec.version < 1) errors.push('routing.version must be a positive integer');
  if (!Array.isArray(spec.routes) || spec.routes.length === 0 || spec.routes.length > CONFIG_BUDGETS.routes) {
    errors.push(`routing.routes must contain between 1 and ${CONFIG_BUDGETS.routes} routes`);
  }
  if (!Array.isArray(spec.clarifications) || spec.clarifications.length === 0 || spec.clarifications.length > CONFIG_BUDGETS.clarifications) {
    errors.push(`routing.clarifications must contain between 1 and ${CONFIG_BUDGETS.clarifications} clarifications`);
  }
  if (!Array.isArray(spec.classifierRules) || spec.classifierRules.length === 0 || spec.classifierRules.length > CONFIG_BUDGETS.classifierRules) {
    errors.push(`routing.classifierRules must contain between 1 and ${CONFIG_BUDGETS.classifierRules} rules`);
  }

  const actionIds = collectActionIds(shiftGuideConfig.modules);
  const routeIds = new Set();
  const clarificationIds = new Set();

  if (Array.isArray(spec.routes)) {
    spec.routes.forEach((route, index) => {
      const path = `routing.routes[${index}]`;
      if (!isRecord(route)) {
        errors.push(`${path} must be an object`);
        return;
      }
      if (!isNonEmptyString(route.id)) errors.push(`${path}.id must be a non-empty string`);
      if (!isNonEmptyString(route.label)) errors.push(`${path}.label must be a non-empty string`);
      if (!isNonEmptyString(route.decisionGuide)) errors.push(`${path}.decisionGuide must be a non-empty string`);
      validateStringBudget(route.id, `${path}.id`, errors, CONFIG_BUDGETS.idChars);
      validateStringBudget(route.label, `${path}.label`, errors, CONFIG_BUDGETS.shortTextChars);
      validateStringBudget(route.decisionGuide, `${path}.decisionGuide`, errors, CONFIG_BUDGETS.textChars);
      if (!Array.isArray(route.actionIds) || route.actionIds.length === 0 || route.actionIds.length > CONFIG_BUDGETS.routeActions) {
        errors.push(`${path}.actionIds must contain between 1 and ${CONFIG_BUDGETS.routeActions} action ids`);
      } else {
        const seen = new Set();
        for (const actionId of route.actionIds) {
          if (!isNonEmptyString(actionId)) {
            errors.push(`${path}.actionIds must contain only non-empty strings`);
            continue;
          }
          validateStringBudget(actionId, `${path}.actionIds`, errors, CONFIG_BUDGETS.idChars);
          if (seen.has(actionId)) errors.push(`${path}.actionIds duplicates "${actionId}"`);
          seen.add(actionId);
          if (!actionIds.has(actionId)) errors.push(`${path}.actionIds references unknown action "${actionId}"`);
        }
      }
      if (isNonEmptyString(route.id)) {
        if (routeIds.has(route.id)) errors.push(`${path}.id duplicates route "${route.id}"`);
        routeIds.add(route.id);
      }
    });
  }

  if (Array.isArray(spec.clarifications)) {
    spec.clarifications.forEach((clarification, index) => {
      const path = `routing.clarifications[${index}]`;
      if (!isRecord(clarification)) {
        errors.push(`${path} must be an object`);
        return;
      }
      if (!isNonEmptyString(clarification.id)) errors.push(`${path}.id must be a non-empty string`);
      if (!isNonEmptyString(clarification.question)) errors.push(`${path}.question must be a non-empty string`);
      if (!isNonEmptyString(clarification.decisionGuide)) errors.push(`${path}.decisionGuide must be a non-empty string`);
      validateStringBudget(clarification.id, `${path}.id`, errors, CONFIG_BUDGETS.idChars);
      validateStringBudget(clarification.question, `${path}.question`, errors, CONFIG_BUDGETS.textChars);
      validateStringBudget(clarification.decisionGuide, `${path}.decisionGuide`, errors, CONFIG_BUDGETS.textChars);
      if (isNonEmptyString(clarification.id)) {
        if (clarificationIds.has(clarification.id)) errors.push(`${path}.id duplicates clarification "${clarification.id}"`);
        clarificationIds.add(clarification.id);
      }
    });
  }

  if (Array.isArray(spec.classifierRules)) {
    spec.classifierRules.forEach((rule, index) => {
      if (!isNonEmptyString(rule)) errors.push(`routing.classifierRules[${index}] must be a non-empty string`);
      validateStringBudget(rule, `routing.classifierRules[${index}]`, errors, CONFIG_BUDGETS.textChars);
    });
  }

  return { ok: errors.length === 0, errors };
}

export function parseCelineRoutingSpec(spec, shiftGuideConfig) {
  const validation = validateCelineRoutingSpec(spec, shiftGuideConfig);
  if (!validation.ok) return { ...validation, value: null };
  return { ok: true, errors: [], value: canonicalizeValidRoutingSpec(spec) };
}

export function createCelineAuthorityRevision(routingSpec) {
  const semanticSpec = canonicalizeValidRoutingSpec(routingSpec);
  const canonical = stableSerialize({ protocolRevision: PROTOCOL_REVISION, routingSpec: semanticSpec });
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
