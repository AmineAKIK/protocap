import { createHash } from 'node:crypto';

const PROTOCOL_REVISION = 'decision-v2';
const MAX_ROUTE_ACTIONS = 200;
const MAX_RULES = 100;

function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
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

export function validateCelineRoutingSpec(spec, shiftGuideConfig) {
  const errors = [];
  if (!isRecord(spec)) return { ok: false, errors: ['Celine routing spec must be an object'] };
  if (!Number.isInteger(spec.version) || spec.version < 1) errors.push('routing.version must be a positive integer');
  if (!Array.isArray(spec.routes) || spec.routes.length === 0) errors.push('routing.routes must contain at least one route');
  if (!Array.isArray(spec.clarifications) || spec.clarifications.length === 0) errors.push('routing.clarifications must contain at least one clarification');
  if (!Array.isArray(spec.classifierRules) || spec.classifierRules.length === 0 || spec.classifierRules.length > MAX_RULES) {
    errors.push(`routing.classifierRules must contain between 1 and ${MAX_RULES} rules`);
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
      if (!Array.isArray(route.actionIds) || route.actionIds.length === 0 || route.actionIds.length > MAX_ROUTE_ACTIONS) {
        errors.push(`${path}.actionIds must contain between 1 and ${MAX_ROUTE_ACTIONS} action ids`);
      } else {
        const seen = new Set();
        for (const actionId of route.actionIds) {
          if (!isNonEmptyString(actionId)) {
            errors.push(`${path}.actionIds must contain only non-empty strings`);
            continue;
          }
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
      if (isNonEmptyString(clarification.id)) {
        if (clarificationIds.has(clarification.id)) errors.push(`${path}.id duplicates clarification "${clarification.id}"`);
        clarificationIds.add(clarification.id);
      }
    });
  }

  if (Array.isArray(spec.classifierRules)) {
    spec.classifierRules.forEach((rule, index) => {
      if (!isNonEmptyString(rule)) errors.push(`routing.classifierRules[${index}] must be a non-empty string`);
    });
  }

  return { ok: errors.length === 0, errors };
}

export function createCelineAuthorityRevision(routingSpec) {
  const canonical = stableSerialize({ protocolRevision: PROTOCOL_REVISION, routingSpec });
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
