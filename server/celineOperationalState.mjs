const VALID_CONTEXTS = new Set([
  'unknown',
  'debut_equipe',
  'debut_oc',
  'production',
  'evenement',
  'cloture',
  'tri',
  'reprise',
]);

const VALID_LINE_MODES = new Set(['unknown', 'stopped', 'production']);
const VALID_ENTITY_STATES = new Set(['unknown', 'none', 'open', 'closed']);
const VALID_CHANGE_TYPES = new Set(['lot', 'pays', 'formule', 'format']);

export function createCelineOperationalState() {
  return {
    context: 'unknown',
    lineMode: 'unknown',
    ocStatus: 'unknown',
    tankStatus: 'unknown',
    changeType: null,
    activeWorkflow: null,
    pendingQuestion: null,
    updatedAt: Date.now(),
  };
}

function safeString(value, max = 200) {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function sanitizeWorkflow(value) {
  if (!value || typeof value !== 'object') return null;
  const routeId = safeString(value.routeId);
  if (!routeId || !Array.isArray(value.actionIds) || value.actionIds.length === 0) return null;
  const actionIds = value.actionIds.filter((id) => safeString(id));
  if (actionIds.length !== value.actionIds.length || actionIds.length > 100) return null;
  const currentIndex = Number.isInteger(value.currentIndex) ? value.currentIndex : 0;
  if (currentIndex < 0 || currentIndex >= actionIds.length) return null;
  return {
    runId: safeString(value.runId) ?? `workflow_${Date.now()}`,
    routeId,
    label: safeString(value.label, 400) ?? routeId,
    actionIds,
    currentIndex,
    startedAt: Number.isFinite(value.startedAt) ? value.startedAt : Date.now(),
  };
}

function sanitizePendingQuestion(value) {
  if (!value || typeof value !== 'object') return null;
  const id = safeString(value.id);
  if (!id) return null;
  const resume = value.resume && typeof value.resume === 'object'
    ? {
        kind: safeString(value.resume.kind) ?? 'none',
        id: safeString(value.resume.id),
      }
    : null;
  return { id, resume };
}

export function normalizeCelineOperationalState(value) {
  const base = createCelineOperationalState();
  if (!value || typeof value !== 'object') return base;
  return {
    context: VALID_CONTEXTS.has(value.context) ? value.context : base.context,
    lineMode: VALID_LINE_MODES.has(value.lineMode) ? value.lineMode : base.lineMode,
    ocStatus: VALID_ENTITY_STATES.has(value.ocStatus) ? value.ocStatus : base.ocStatus,
    tankStatus: VALID_ENTITY_STATES.has(value.tankStatus) ? value.tankStatus : base.tankStatus,
    changeType: VALID_CHANGE_TYPES.has(value.changeType) ? value.changeType : null,
    activeWorkflow: sanitizeWorkflow(value.activeWorkflow),
    pendingQuestion: sanitizePendingQuestion(value.pendingQuestion),
    updatedAt: Number.isFinite(value.updatedAt) ? value.updatedAt : base.updatedAt,
  };
}

export function withCelineState(state, patch) {
  return normalizeCelineOperationalState({
    ...normalizeCelineOperationalState(state),
    ...patch,
    updatedAt: Date.now(),
  });
}

export function beginCelineWorkflow(state, route) {
  if (!route || !Array.isArray(route.actionIds) || route.actionIds.length === 0) return state;
  return withCelineState(state, {
    activeWorkflow: {
      runId: `${route.id}_${Date.now()}`,
      routeId: route.id,
      label: route.label,
      actionIds: [...route.actionIds],
      currentIndex: 0,
      startedAt: Date.now(),
    },
    pendingQuestion: null,
  });
}

export function advanceCelineWorkflow(state) {
  const normalized = normalizeCelineOperationalState(state);
  const workflow = normalized.activeWorkflow;
  if (!workflow) return { state: normalized, completed: false, advanced: false };
  if (workflow.currentIndex >= workflow.actionIds.length - 1) {
    return {
      state: withCelineState(normalized, { activeWorkflow: null }),
      completed: true,
      advanced: false,
      workflow,
    };
  }
  return {
    state: withCelineState(normalized, {
      activeWorkflow: { ...workflow, currentIndex: workflow.currentIndex + 1 },
    }),
    completed: false,
    advanced: true,
  };
}

export function setPendingCelineQuestion(state, id, resume = null) {
  return withCelineState(state, {
    pendingQuestion: { id, resume },
  });
}

export function clearPendingCelineQuestion(state) {
  return withCelineState(state, { pendingQuestion: null });
}
