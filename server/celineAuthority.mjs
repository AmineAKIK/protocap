const ROUTE_FOLLOW_UP = 'Dis-moi quand la checklist est traitée.';
const UNKNOWN_MESSAGE = "Je n’ai pas cette information dans le référentiel ShiftGuide. Vois avec ton responsable.";

function collectActions(modules) {
  const actions = new Map();
  for (const module of modules) {
    if (module.type === 'choice') {
      for (const subModule of module.subModules) {
        for (const action of subModule.actions) {
          actions.set(action.id, {
            text: action.text,
            note: action.note ?? null,
            module: subModule.title,
          });
        }
      }
      continue;
    }
    for (const action of module.actions) {
      actions.set(action.id, {
        text: action.text,
        note: action.note ?? null,
        module: module.title,
      });
    }
  }
  return actions;
}

export function createCelineAuthority(config, routingSpec) {
  const actions = collectActions(config.modules);
  const routes = new Map(
    routingSpec.routes.map((route) => [route.id, {
      id: route.id,
      label: route.label,
      decisionGuide: route.decisionGuide,
      actionIds: [...route.actionIds],
    }])
  );
  const clarifications = new Map(
    routingSpec.clarifications.map((clarification) => [clarification.id, {
      question: clarification.question,
      decisionGuide: clarification.decisionGuide,
    }])
  );
  const lexicon = new Map(
    config.lexique.map((entry) => [entry.sigle.trim().toLocaleUpperCase('fr-FR'), entry.definition])
  );

  return {
    actions,
    routes,
    clarifications,
    classifierRules: [...routingSpec.classifierRules],
    lexicon,
    urgences: config.urgences,
  };
}

function renderRoute(authority, routeId) {
  const route = authority.routes.get(routeId);
  if (!route) return null;
  return {
    message: `Suis la séquence « ${route.label} » dans l’ordre indiqué.`,
    checklist: route.actionIds.map((actionId) => ({ actionId, ...authority.actions.get(actionId) })),
    followUp: ROUTE_FOLLOW_UP,
  };
}

function renderClarification(authority, clarificationId) {
  const clarification = authority.clarifications.get(clarificationId);
  if (!clarification) return null;
  return { message: clarification.question, checklist: [], followUp: null };
}

function renderLexicon(authority, sigle) {
  if (typeof sigle !== 'string') return null;
  const normalized = sigle.trim().toLocaleUpperCase('fr-FR');
  const definition = authority.lexicon.get(normalized);
  if (!definition) return null;
  return { message: `${normalized} : ${definition}`, checklist: [], followUp: null };
}

function renderEmergency(authority, topic) {
  const urgences = authority.urgences;
  if (topic === 'numbers') {
    return { message: `Numéros d’urgence : ${urgences.emergencyNumbers.join(' ou ')}.`, checklist: [], followUp: null };
  }
  if (topic === 'general_alarm') {
    return {
      message: `${urgences.generalAlarm.signal}. ${urgences.generalAlarm.instruction} Étapes : ${urgences.generalAlarm.steps.join(' → ')}.`,
      checklist: [],
      followUp: null,
    };
  }
  if (topic === 'accident') {
    return {
      message: urgences.accidentSteps.map((step, index) => `${index + 1}. ${step.label} — ${step.description}`).join('\n'),
      checklist: [],
      followUp: null,
    };
  }
  if (topic === 'golden_rules') {
    return {
      message: urgences.goldenRules.map((rule) => `${rule.label} — ${rule.description}`).join('\n'),
      checklist: [],
      followUp: null,
    };
  }
  return null;
}

export function resolveCelineDecision(authority, decision) {
  if (!decision || typeof decision !== 'object') return null;
  if (decision.kind === 'route') return renderRoute(authority, decision.id);
  if (decision.kind === 'clarify') return renderClarification(authority, decision.id);
  if (decision.kind === 'lexicon') return renderLexicon(authority, decision.id);
  if (decision.kind === 'emergency') return renderEmergency(authority, decision.id);
  if (decision.kind === 'unknown') {
    return { message: UNKNOWN_MESSAGE, checklist: [], followUp: null };
  }
  return null;
}
