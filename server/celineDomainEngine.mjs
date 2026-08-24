import {
  advanceCelineWorkflow,
  beginCelineWorkflow,
  clearPendingCelineQuestion,
  createCelineOperationalState,
  normalizeCelineOperationalState,
  setPendingCelineQuestion,
  withCelineState,
} from './celineOperationalState.mjs';
import { normalizeCelineSearchText, searchCelineActions } from './celineSemanticIndex.mjs';

const YES = new Set(['oui', 'ouais', 'yes', 'ok', 'd accord', 'exact', 'exactement']);
const NO = new Set(['non', 'nan', 'no', 'pas encore', 'non pas encore']);
const CHANGE_TYPES = ['lot', 'pays', 'formule', 'format'];

function emptyResponse(message, extra = {}) {
  return { message, checklist: [], followUp: null, ...extra };
}

function actionDto(authority, actionId) {
  const action = authority.actions.get(actionId);
  return action ? { actionId, ...action } : null;
}

function routeFor(authority, routeId) {
  return authority.routes.get(routeId) ?? null;
}

function inferContext(routeId) {
  if (routeId.includes('poste')) return routeId.startsWith('fin_') ? 'cloture' : 'debut_equipe';
  if (routeId.includes('oc')) return routeId.startsWith('fin_') ? 'cloture' : 'debut_oc';
  if (routeId.includes('cuve')) return 'evenement';
  if (routeId === 'production') return 'production';
  if (routeId === 'tri') return 'tri';
  return 'unknown';
}

function inferChangeType(text) {
  return CHANGE_TYPES.find((type) => text.includes(type)) ?? null;
}

function providerRouteIntent(routeId) {
  if (routeId === 'debut_oc' || routeId === 'debut_oc_precedent_ouvert') {
    return { id: 'debut_oc', changeType: null };
  }
  if (routeId === 'fin_oc') return { id: 'fin_oc', changeType: null };
  if (routeId === 'debut_cuve' || routeId === 'debut_cuve_sans_oc') {
    return { id: 'debut_cuve', changeType: null };
  }
  if (routeId === 'fin_cuve') return { id: 'fin_cuve', changeType: null };
  if (routeId === 'changement_cuve') return { id: 'changement_cuve', changeType: null };
  if (routeId === 'production') return { id: 'production', changeType: null };
  if (routeId === 'tri') return { id: 'tri', changeType: null };
  if (routeId.startsWith('debut_poste_')) return { id: 'debut_poste', changeType: null };
  if (routeId.startsWith('fin_poste_')) return { id: 'fin_poste', changeType: null };

  const change = /^changement_oc_(lot|pays|formule|format)_(cloture|ouvert)$/.exec(routeId);
  if (change) return { id: 'changement_oc', changeType: change[1] };
  return null;
}

function applyWorkflowCompletionEffects(state, workflow) {
  if (!workflow) return state;
  const routeId = workflow.routeId;
  const patch = {};

  if (routeId === 'debut_oc' || routeId === 'debut_oc_precedent_ouvert' || routeId.includes('changement_oc_')) {
    patch.ocStatus = 'open';
    patch.context = 'debut_oc';
  }
  if (routeId === 'fin_oc') {
    patch.ocStatus = 'closed';
    patch.tankStatus = state.tankStatus === 'open' ? 'open' : 'closed';
    patch.context = 'cloture';
  }
  if (routeId === 'debut_cuve' || routeId === 'debut_cuve_sans_oc' || routeId === 'changement_cuve') {
    patch.ocStatus = 'open';
    patch.tankStatus = 'open';
    patch.context = 'production';
  }
  if (routeId === 'fin_cuve') {
    patch.tankStatus = 'closed';
    patch.context = 'evenement';
  }
  if (routeId === 'production') {
    patch.lineMode = 'production';
    patch.context = 'production';
  }
  if (routeId.startsWith('fin_poste')) {
    patch.lineMode = 'stopped';
    patch.ocStatus = 'closed';
    patch.tankStatus = 'closed';
    patch.context = 'cloture';
  }
  if (routeId === 'debut_poste_production') {
    patch.lineMode = 'production';
    patch.context = 'production';
  }
  if (routeId.startsWith('debut_poste_arretee')) {
    patch.lineMode = 'stopped';
    patch.context = 'debut_equipe';
  }

  return withCelineState(state, patch);
}

function renderWorkflowStep(authority, state) {
  const workflow = state.activeWorkflow;
  if (!workflow) return null;
  const actionId = workflow.actionIds[workflow.currentIndex];
  const action = actionDto(authority, actionId);
  if (!action) return null;
  const position = workflow.currentIndex + 1;
  return {
    message: `${workflow.label} — étape ${position}/${workflow.actionIds.length}.`,
    checklist: [action],
    followUp: null,
    presentation: 'focus',
    workflow: {
      runId: workflow.runId,
      routeId: workflow.routeId,
      label: workflow.label,
      currentIndex: workflow.currentIndex,
      totalActions: workflow.actionIds.length,
    },
  };
}

function startRoute(authority, state, routeId) {
  const route = routeFor(authority, routeId);
  if (!route) return { handled: false, state };
  const nextState = beginCelineWorkflow(withCelineState(state, { context: inferContext(routeId) }), route);
  return {
    handled: true,
    state: nextState,
    response: renderWorkflowStep(authority, nextState),
    decision: { kind: 'route', id: routeId },
  };
}

function ask(state, id, question, resume = null) {
  return {
    handled: true,
    state: setPendingCelineQuestion(state, id, resume),
    response: emptyResponse(question, { presentation: 'question' }),
    decision: { kind: 'clarify', id },
  };
}

function finishPoste(authority, state) {
  if (state.ocStatus === 'unknown') {
    return ask(state, 'fin_poste_oc', 'Y a-t-il encore un OC ouvert ?', { kind: 'start', id: 'fin_poste' });
  }
  if (state.ocStatus !== 'open') {
    return startRoute(authority, withCelineState(state, { tankStatus: 'closed' }), 'fin_poste_cloture');
  }
  if (state.tankStatus === 'unknown') {
    return ask(state, 'fin_poste_cuve', 'Une cuve est-elle encore ouverte ?', { kind: 'start', id: 'fin_poste' });
  }
  return startRoute(authority, state, state.tankStatus === 'open' ? 'fin_poste_avec_cuve_oc' : 'fin_poste_avec_oc');
}

function startPoste(authority, state) {
  if (state.lineMode === 'unknown') {
    return ask(state, 'debut_poste_etat', 'La ligne est arrêtée ou déjà en production ?', { kind: 'start', id: 'debut_poste' });
  }
  if (state.lineMode === 'production') return startRoute(authority, state, 'debut_poste_production');
  return ask(state, 'debut_poste_oc', 'As-tu un OC à lancer dans la foulée ?', { kind: 'start', id: 'debut_poste' });
}

function changeOc(authority, state, type = null) {
  const changeType = type ?? state.changeType;
  if (!changeType) {
    return ask(state, 'changement_oc_type', 'Quel est le type de changement : Lot, Pays, Formule ou Format ?', { kind: 'start', id: 'changement_oc' });
  }
  const typedState = withCelineState(state, { changeType });
  if (typedState.ocStatus === 'unknown') {
    return ask(typedState, 'changement_oc_precedent', 'L’OC précédent est-il déjà clôturé ?', { kind: 'start', id: 'changement_oc' });
  }
  const suffix = typedState.ocStatus === 'open' ? 'ouvert' : 'cloture';
  return startRoute(authority, typedState, `changement_oc_${changeType}_${suffix}`);
}

function startIntent(authority, state, id) {
  const normalized = normalizeCelineOperationalState(state);
  if (id === 'debut_poste') return startPoste(authority, normalized);
  if (id === 'fin_poste') return finishPoste(authority, normalized);
  if (id === 'changement_oc') return changeOc(authority, normalized);
  if (id === 'debut_oc') {
    if (normalized.ocStatus === 'unknown') {
      return ask(normalized, 'debut_oc_precedent', 'L’OC précédent est-il déjà clôturé ?', { kind: 'start', id });
    }
    return startRoute(authority, normalized, normalized.ocStatus === 'open' ? 'debut_oc_precedent_ouvert' : 'debut_oc');
  }
  if (id === 'fin_oc') {
    if (normalized.ocStatus === 'unknown') {
      return ask(normalized, 'fin_oc_ouvert', 'Y a-t-il bien un OC ouvert à clôturer maintenant ?', { kind: 'start', id });
    }
    if (normalized.ocStatus !== 'open') {
      return { handled: true, state: normalized, response: emptyResponse('Aucun OC ouvert n’est connu dans l’état courant. Dis-moi si la situation a changé.'), decision: { kind: 'unknown' } };
    }
    return startRoute(authority, normalized, 'fin_oc');
  }
  if (id === 'debut_cuve') {
    if (normalized.ocStatus === 'unknown') {
      return ask(normalized, 'debut_cuve_oc', 'Un OC est-il déjà ouvert ?', { kind: 'start', id });
    }
    return startRoute(authority, normalized, normalized.ocStatus === 'open' ? 'debut_cuve' : 'debut_cuve_sans_oc');
  }
  if (id === 'fin_cuve') {
    if (normalized.tankStatus === 'unknown') {
      return ask(normalized, 'fin_cuve_ouverte', 'La cuve est-elle bien encore ouverte ?', { kind: 'start', id });
    }
    if (normalized.tankStatus !== 'open') {
      return { handled: true, state: normalized, response: emptyResponse('Aucune cuve ouverte n’est connue dans l’état courant. Dis-moi si la situation a changé.'), decision: { kind: 'unknown' } };
    }
    return startRoute(authority, normalized, 'fin_cuve');
  }
  if (id === 'changement_cuve') {
    if (normalized.tankStatus === 'unknown') {
      return ask(
        normalized,
        'changement_cuve_ouverte',
        'Une cuve est-elle actuellement ouverte à clôturer avant de démarrer la suivante ?',
        { kind: 'start', id }
      );
    }
    if (normalized.tankStatus !== 'open') return startIntent(authority, normalized, 'debut_cuve');
    return startRoute(authority, normalized, 'changement_cuve');
  }
  if (id === 'production') return startRoute(authority, normalized, 'production');
  if (id === 'tri') return startRoute(authority, normalized, 'tri');
  if (routeFor(authority, id)) return startRoute(authority, normalized, id);
  return { handled: false, state: normalized };
}

function resolvePendingYesNo(authority, state, answer) {
  const pending = state.pendingQuestion;
  if (!pending) return null;
  const yes = answer === 'yes';
  let next = clearPendingCelineQuestion(state);

  if (pending.id === 'debut_poste_oc') {
    return startRoute(authority, next, yes ? 'debut_poste_arretee_oc' : 'debut_poste_arretee_sans_oc');
  }
  if (pending.id === 'fin_poste_oc') {
    next = withCelineState(next, { ocStatus: yes ? 'open' : 'closed' });
    return yes
      ? finishPoste(authority, next)
      : startRoute(authority, withCelineState(next, { tankStatus: 'closed' }), 'fin_poste_cloture');
  }
  if (pending.id === 'fin_poste_cuve') {
    next = withCelineState(next, { tankStatus: yes ? 'open' : 'closed' });
    return startRoute(authority, next, yes ? 'fin_poste_avec_cuve_oc' : 'fin_poste_avec_oc');
  }
  if (pending.id === 'changement_oc_precedent') {
    next = withCelineState(next, { ocStatus: yes ? 'closed' : 'open' });
    return changeOc(authority, next);
  }
  if (pending.id === 'changement_cuve_ouverte') {
    next = withCelineState(next, { tankStatus: yes ? 'open' : 'closed' });
    return yes
      ? startRoute(authority, next, 'changement_cuve')
      : startIntent(authority, next, 'debut_cuve');
  }
  if (pending.id === 'debut_oc_precedent') {
    next = withCelineState(next, { ocStatus: yes ? 'closed' : 'open' });
    return startRoute(authority, next, yes ? 'debut_oc' : 'debut_oc_precedent_ouvert');
  }
  if (pending.id === 'debut_cuve_oc') {
    next = withCelineState(next, { ocStatus: yes ? 'open' : 'none' });
    return startRoute(authority, next, yes ? 'debut_cuve' : 'debut_cuve_sans_oc');
  }
  if (pending.id === 'fin_oc_ouvert') {
    next = withCelineState(next, { ocStatus: yes ? 'open' : 'none' });
    return yes
      ? startRoute(authority, next, 'fin_oc')
      : { handled: true, state: next, response: emptyResponse('D’accord. Je ne lance pas de clôture d’OC.'), decision: { kind: 'answer', id: 'no' } };
  }
  if (pending.id === 'fin_cuve_ouverte') {
    next = withCelineState(next, { tankStatus: yes ? 'open' : 'none' });
    return yes
      ? startRoute(authority, next, 'fin_cuve')
      : { handled: true, state: next, response: emptyResponse('D’accord. Je ne lance pas de fin de cuve.'), decision: { kind: 'answer', id: 'no' } };
  }
  return null;
}

function resolvePendingFreeText(authority, state, normalized) {
  const pending = state.pendingQuestion;
  if (!pending) return null;

  if (pending.id === 'debut_poste_etat') {
    if (/\b(production|tourne|marche)\b/.test(normalized)) {
      return startPoste(authority, withCelineState(clearPendingCelineQuestion(state), { lineMode: 'production' }));
    }
    if (/\b(arret|arretee|stoppee|stop)\b/.test(normalized)) {
      return startPoste(authority, withCelineState(clearPendingCelineQuestion(state), { lineMode: 'stopped' }));
    }
  }

  if (pending.id === 'changement_oc_type') {
    const type = inferChangeType(normalized);
    if (type) return changeOc(authority, withCelineState(clearPendingCelineQuestion(state), { changeType: type }), type);
  }

  return null;
}

function preferredScopes(state) {
  const scopes = [];
  if (state.activeWorkflow?.routeId) scopes.push(state.activeWorkflow.routeId);
  if (state.context === 'production') scopes.push('production');
  if (state.context === 'debut_oc') scopes.push('debut_oc');
  if (state.context === 'cloture') scopes.push('fin_oc', 'fin_poste');
  if (state.context === 'evenement') scopes.push('fin_cuve', 'debut_cuve');
  return scopes;
}

function maybeProcedureQuery(authority, semanticIndex, state, text) {
  const normalized = normalizeCelineSearchText(text);
  const looksLikeQuestion = /\b(quoi|comment|quel|quelle|quels|quelles|dois|faut|controle|verif|etape)\b/.test(normalized)
    || normalized.includes('prelev');
  if (!looksLikeQuestion) return null;
  const matches = searchCelineActions(semanticIndex, text, { preferredScopes: preferredScopes(state), limit: 3 });
  if (matches.length === 0) return null;
  const topScore = matches[0].score;
  const selected = matches.filter((match) => match.score >= Math.max(3, topScore - 1));
  const checklist = selected.map((match) => actionDto(authority, match.actionId)).filter(Boolean);
  if (checklist.length === 0) return null;
  return {
    handled: true,
    state,
    response: {
      message: checklist.length === 1
        ? 'Voici le point du référentiel qui correspond à ta demande.'
        : 'J’ai trouvé plusieurs points du référentiel qui correspondent. Je te montre uniquement les plus pertinents.',
      checklist,
      followUp: checklist.length > 1 ? 'Si tu veux, précise le moment : production, début/fin de cuve, début/fin d’OC…' : null,
      presentation: 'answer',
    },
    decision: { kind: 'query', ids: checklist.map((item) => item.actionId) },
  };
}

function advanceWorkflow(authority, state) {
  const advanced = advanceCelineWorkflow(state);
  if (!advanced.completed) {
    return {
      handled: true,
      state: advanced.state,
      response: renderWorkflowStep(authority, advanced.state),
      decision: { kind: 'navigate', id: 'next' },
    };
  }
  const completedState = applyWorkflowCompletionEffects(advanced.state, advanced.workflow);
  return {
    handled: true,
    state: completedState,
    response: emptyResponse(`${advanced.workflow.label} terminée.`, {
      presentation: 'completion',
      completedWorkflow: { routeId: advanced.workflow.routeId, label: advanced.workflow.label },
    }),
    decision: { kind: 'navigate', id: 'complete' },
  };
}

function handleProviderClarification(authority, state, clarificationId) {
  if (clarificationId === 'fin_poste_etat') return finishPoste(authority, state);
  if (clarificationId === 'changement_oc_contexte') return changeOc(authority, state);
  if (clarificationId === 'debut_poste_etat') return startPoste(authority, state);

  const clarification = authority.clarifications.get(clarificationId);
  if (!clarification) return { handled: false, state };
  return ask(state, clarificationId, clarification.question, null);
}

export function createCelineDomainEngine({ authority, semanticIndex }) {
  return {
    initialState() {
      return createCelineOperationalState();
    },

    handleBeforeProvider(stateValue, userMessage) {
      const state = normalizeCelineOperationalState(stateValue);
      const normalized = normalizeCelineSearchText(userMessage);

      if (/^(bonjour|salut|hello|bonsoir|coucou)\b/.test(normalized)) {
        return { handled: true, state, response: emptyResponse('Bonjour. Dis-moi ce que tu fais sur la ligne ou ce que tu cherches dans ShiftGuide.'), decision: { kind: 'conversation', id: 'greeting' } };
      }
      if (/^(merci|merci beaucoup|parfait|super)\b/.test(normalized)) {
        return { handled: true, state, response: emptyResponse('Avec plaisir. Je reste disponible pour la suite.'), decision: { kind: 'conversation', id: 'thanks' } };
      }

      if (state.pendingQuestion) {
        if (YES.has(normalized)) {
          const result = resolvePendingYesNo(authority, state, 'yes');
          if (result) return result;
        }
        if (NO.has(normalized)) {
          const result = resolvePendingYesNo(authority, state, 'no');
          if (result) return result;
        }
        const freeText = resolvePendingFreeText(authority, state, normalized);
        if (freeText) return freeText;
      }

      if (state.activeWorkflow) {
        if (/^(c est fait|fait|valide|ok c est fait)$/.test(normalized)) return advanceWorkflow(authority, state);
        if (/^(et apres|apres|suivant|et ensuite|ensuite|prochaine etape)$/.test(normalized)) return advanceWorkflow(authority, state);
        if (/\b(toute|toutes|complet|complete)\b/.test(normalized) && /\b(procedure|etapes|checklist)\b/.test(normalized)) {
          const route = routeFor(authority, state.activeWorkflow.routeId);
          if (route) {
            return {
              handled: true,
              state,
              response: {
                message: `Voici la procédure complète « ${route.label} » (${route.actionIds.length} étapes).`,
                checklist: route.actionIds.map((id) => actionDto(authority, id)).filter(Boolean),
                followUp: null,
                presentation: 'all',
              },
              decision: { kind: 'navigate', id: 'show_all' },
            };
          }
        }
      }

      if (/\b(commence|commencer|debut|prise)\b.*\b(poste|equipe)\b/.test(normalized)) return startIntent(authority, state, 'debut_poste');
      if (/\b(fin|fini|finir|termine|terminer)\b.*\b(poste|equipe)\b/.test(normalized)) return startIntent(authority, state, 'fin_poste');
      if (/\b(changement|changer)\b.*\boc\b/.test(normalized)) {
        return changeOc(authority, state, inferChangeType(normalized));
      }
      if (/\b(lance|lancer|commence|commencer|demarre|nouveau|nouvel)\b.*\boc\b/.test(normalized)) return startIntent(authority, state, 'debut_oc');
      if (/\b(fin|fini|finir|cloture|cloturer)\b.*\boc\b/.test(normalized)) return startIntent(authority, state, 'fin_oc');
      if (/\b(changement|changer|nouvelle|nouveau)\b.*\bcuve\b/.test(normalized)) return startIntent(authority, state, normalized.includes('changement') ? 'changement_cuve' : 'debut_cuve');
      if (/\b(fin|finir|termine|terminer)\b.*\bcuve\b/.test(normalized)) return startIntent(authority, state, 'fin_cuve');
      if (/\b(production|produire)\b/.test(normalized) && /\b(controle|sequence|procedure)\b/.test(normalized)) return startIntent(authority, state, 'production');
      if (/\btri\b/.test(normalized) && /\b(commence|mission|faire|lance)\b/.test(normalized)) return startIntent(authority, state, 'tri');

      for (const key of authority.lexicon.keys()) {
        if (normalized === `c est quoi ${normalizeCelineSearchText(key)}` || normalized === normalizeCelineSearchText(key)) {
          const definition = authority.lexicon.get(key);
          return { handled: true, state, response: emptyResponse(`${key} : ${definition}`), decision: { kind: 'lexicon', id: key } };
        }
      }

      const query = maybeProcedureQuery(authority, semanticIndex, state, userMessage);
      if (query) return query;
      return { handled: false, state };
    },

    handleProviderDecision(stateValue, decision, fallbackResolver) {
      const state = normalizeCelineOperationalState(stateValue);
      if (!decision || typeof decision !== 'object') return { handled: false, state };
      if (decision.kind === 'route') {
        const intent = providerRouteIntent(decision.id);
        if (intent) {
          const intentState = intent.changeType
            ? withCelineState(state, { changeType: intent.changeType })
            : state;
          return intent.id === 'changement_oc'
            ? changeOc(authority, intentState, intent.changeType)
            : startIntent(authority, intentState, intent.id);
        }
        return startRoute(authority, state, decision.id);
      }
      if (decision.kind === 'clarify') {
        return handleProviderClarification(authority, state, decision.id);
      }
      const response = fallbackResolver(decision);
      return response ? { handled: true, state, response, decision } : { handled: false, state };
    },
  };
}
