const ROUTE_FOLLOW_UP = 'Dis-moi quand la checklist est traitée.';
const UNKNOWN_MESSAGE = "Je n’ai pas cette information dans le référentiel ShiftGuide. Vois avec ton responsable.";

function sequence(prefix, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) =>
    `${prefix}_${String(start + index).padStart(2, '0')}`
  );
}

const FIXED_ROUTE_SPECS = [
  {
    id: 'badgeage_debut',
    label: 'Badgeage début',
    actionIds: sequence('bd', 1, 2),
  },
  {
    id: 'badgeage_fin',
    label: 'Badgeage fin',
    actionIds: sequence('bf', 1, 2),
  },
  {
    id: 'debut_poste_arretee_oc',
    label: 'Début de poste — ligne arrêtée avec OC à lancer',
    actionIds: ['dp_01', 'dp_02', 'dp_03', 'dp_08', 'dp_10', 'dp_11', 'dp_12', ...sequence('doc', 1, 16)],
  },
  {
    id: 'debut_poste_arretee_sans_oc',
    label: 'Début de poste — ligne arrêtée sans OC immédiat',
    actionIds: sequence('dp', 1, 12),
  },
  {
    id: 'debut_poste_production',
    label: 'Début de poste — ligne en production',
    actionIds: ['dp_01', 'dp_02', 'dp_03', 'dp_05', 'dp_07', 'dp_10', 'dp_11'],
  },
  {
    id: 'fin_poste_cloture',
    label: 'Fin de poste — ligne prête à clôturer',
    actionIds: ['fp_01', 'fp_02', 'fp_03', 'fp_04', 'fp_06', 'bf_01', 'bf_02'],
  },
  {
    id: 'fin_poste_avec_oc',
    label: 'Fin de poste — OC ouvert',
    actionIds: [...sequence('foc', 1, 10), 'fp_01', 'fp_02', 'fp_03', 'fp_04', 'fp_06', 'bf_01', 'bf_02'],
  },
  {
    id: 'fin_poste_avec_cuve_oc',
    label: 'Fin de poste — cuve et OC ouverts',
    actionIds: [...sequence('fc', 1, 3), ...sequence('foc', 1, 10), 'fp_01', 'fp_02', 'fp_03', 'fp_04', 'fp_06', 'bf_01', 'bf_02'],
  },
  {
    id: 'debut_oc',
    label: 'Début OC',
    actionIds: sequence('doc', 1, 16),
  },
  {
    id: 'fin_oc',
    label: 'Fin OC',
    actionIds: sequence('foc', 1, 10),
  },
  {
    id: 'debut_cuve',
    label: 'Début cuve',
    actionIds: sequence('dc', 1, 6),
  },
  {
    id: 'fin_cuve',
    label: 'Fin cuve',
    actionIds: sequence('fc', 1, 3),
  },
  {
    id: 'changement_cuve',
    label: 'Changement cuve',
    actionIds: [...sequence('fc', 1, 3), ...sequence('dc', 1, 6)],
  },
  {
    id: 'production',
    label: 'Production',
    actionIds: sequence('prod', 1, 10),
  },
  {
    id: 'tri',
    label: 'Tri',
    actionIds: sequence('tri', 1, 6),
  },
  ...[
    ['lot', ['chl_01']],
    ['pays', ['chp_01']],
    ['formule', sequence('chf', 1, 3)],
    ['format', sequence('chfmt', 1, 4)],
  ].flatMap(([kind, changeIds]) => [
    {
      id: `changement_oc_${kind}_cloture`,
      label: `Changement OC ${kind} — OC précédent clôturé`,
      actionIds: [...changeIds, ...sequence('doc', 1, 16)],
    },
    {
      id: `changement_oc_${kind}_ouvert`,
      label: `Changement OC ${kind} — OC précédent encore ouvert`,
      actionIds: [...sequence('foc', 1, 10), ...changeIds, ...sequence('doc', 1, 16)],
    },
  ]),
];

export const CELINE_CLARIFICATIONS = new Map([
  ['debut_poste_etat', 'La ligne est arrêtée ou déjà en production ?'],
  ['debut_poste_oc', 'Si la ligne est arrêtée, as-tu un OC à lancer dans la foulée ?'],
  ['fin_poste_etat', 'Y a-t-il encore un OC en cours et/ou une cuve ouverte ?'],
  ['debut_oc_precedent', 'L’OC précédent est-il déjà clôturé ?'],
  ['fin_oc_ouvert', 'Y a-t-il bien un OC ouvert à clôturer maintenant ?'],
  ['fin_oc_ambigu', 'Tu as déjà clôturé l’OC dans le système, ou tu veux le faire maintenant ?'],
  ['changement_oc_contexte', 'Quel est le type de changement — Lot, Pays, Formule ou Format — et l’OC précédent est-il déjà clôturé ?'],
  ['debut_cuve_oc', 'Un OC est-il déjà ouvert ?'],
  ['fin_cuve_ouverte', 'La cuve est-elle bien encore ouverte ?'],
  ['clarifier_situation', 'Peux-tu préciser la situation terrain et ce que tu veux faire maintenant ?'],
]);

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

function addConfiguredModuleRoutes(routes, modules) {
  for (const module of modules) {
    if (module.type === 'standard') {
      routes.set(`module:${module.id}`, {
        id: `module:${module.id}`,
        label: module.title,
        actionIds: module.actions.map((action) => action.id),
      });
      continue;
    }
    for (const subModule of module.subModules) {
      routes.set(`submodule:${subModule.id}`, {
        id: `submodule:${subModule.id}`,
        label: `${module.title} — ${subModule.title}`,
        actionIds: subModule.actions.map((action) => action.id),
      });
    }
  }
}

export function createCelineAuthority(config) {
  const actions = collectActions(config.modules);
  const routes = new Map();
  addConfiguredModuleRoutes(routes, config.modules);

  for (const route of FIXED_ROUTE_SPECS) {
    if (route.actionIds.every((actionId) => actions.has(actionId))) {
      routes.set(route.id, route);
    }
  }

  const lexicon = new Map(
    config.lexique.map((entry) => [entry.sigle.trim().toLocaleUpperCase('fr-FR'), entry.definition])
  );

  return { actions, routes, clarifications: CELINE_CLARIFICATIONS, lexicon, urgences: config.urgences };
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
  const message = authority.clarifications.get(clarificationId);
  if (!message) return null;
  return { message, checklist: [], followUp: null };
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
