function sequence(prefix, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) =>
    `${prefix}_${String(start + index).padStart(2, '0')}`
  );
}

const FIN_POSTE_AFTER_FIN_OC = ['fp_01', 'fp_03', 'fp_04', 'fp_06', 'bf_01', 'bf_02'];

export const DEFAULT_CELINE_ROUTING_SPEC = {
  version: 1,
  routes: [
    { id: 'badgeage_debut', label: 'Badgeage début', decisionGuide: 'Badgeage de début de poste.', actionIds: sequence('bd', 1, 2) },
    { id: 'badgeage_fin', label: 'Badgeage fin', decisionGuide: 'Badgeage de fin de poste.', actionIds: sequence('bf', 1, 2) },
    { id: 'debut_poste_arretee_oc', label: 'Début de poste — ligne arrêtée avec OC à lancer', decisionGuide: 'Début de poste, ligne arrêtée, avec OC à lancer immédiatement.', actionIds: ['dp_01', 'dp_02', 'dp_03', 'dp_08', 'dp_10', 'dp_11', 'dp_12', ...sequence('doc', 1, 16)] },
    { id: 'debut_poste_arretee_sans_oc', label: 'Début de poste — ligne arrêtée sans OC immédiat', decisionGuide: 'Début de poste, ligne arrêtée, sans OC à lancer immédiatement.', actionIds: sequence('dp', 1, 12) },
    { id: 'debut_poste_production', label: 'Début de poste — ligne en production', decisionGuide: 'Début de poste alors que la ligne est déjà en production.', actionIds: ['dp_01', 'dp_02', 'dp_03', 'dp_05', 'dp_07', 'dp_10', 'dp_11'] },
    { id: 'fin_poste_cloture', label: 'Fin de poste — ligne prête à clôturer', decisionGuide: 'Fin de poste avec aucun OC ni cuve restant ouverts.', actionIds: ['fp_01', 'fp_02', 'fp_03', 'fp_04', 'fp_06', 'bf_01', 'bf_02'] },
    { id: 'fin_poste_avec_oc', label: 'Fin de poste — OC ouvert', decisionGuide: 'Fin de poste avec OC ouvert et aucune cuve ouverte.', actionIds: [...sequence('foc', 1, 10), ...FIN_POSTE_AFTER_FIN_OC] },
    { id: 'fin_poste_avec_cuve_oc', label: 'Fin de poste — cuve et OC ouverts', decisionGuide: 'Fin de poste avec cuve et OC encore ouverts.', actionIds: [...sequence('fc', 1, 3), ...sequence('foc', 1, 10), ...FIN_POSTE_AFTER_FIN_OC] },
    { id: 'debut_oc', label: 'Début OC', decisionGuide: 'Début d’un OC quand le précédent est déjà clôturé.', actionIds: sequence('doc', 1, 16) },
    { id: 'debut_oc_precedent_ouvert', label: 'Début OC — clôturer d’abord l’OC précédent', decisionGuide: 'Début d’un nouvel OC alors que le précédent est encore ouvert.', actionIds: [...sequence('foc', 1, 10), ...sequence('doc', 1, 16)] },
    { id: 'fin_oc', label: 'Fin OC', decisionGuide: 'Clôture d’un OC effectivement ouvert.', actionIds: sequence('foc', 1, 10) },
    { id: 'debut_cuve', label: 'Début cuve', decisionGuide: 'Début de cuve avec OC déjà ouvert.', actionIds: sequence('dc', 1, 6) },
    { id: 'debut_cuve_sans_oc', label: 'Début cuve — ouvrir d’abord un OC', decisionGuide: 'Début de cuve alors qu’aucun OC n’est ouvert.', actionIds: [...sequence('doc', 1, 16), ...sequence('dc', 1, 6)] },
    { id: 'fin_cuve', label: 'Fin cuve', decisionGuide: 'Fin d’une cuve effectivement ouverte.', actionIds: sequence('fc', 1, 3) },
    { id: 'changement_cuve', label: 'Changement cuve', decisionGuide: 'Changement de cuve : fin de la cuve courante puis début de la suivante.', actionIds: [...sequence('fc', 1, 3), ...sequence('dc', 1, 6)] },
    { id: 'production', label: 'Production', decisionGuide: 'Guidage des contrôles récurrents en production.', actionIds: sequence('prod', 1, 10) },
    { id: 'tri', label: 'Tri', decisionGuide: 'Mission de tri.', actionIds: sequence('tri', 1, 6) },
    ...[
      ['lot', ['chl_01']],
      ['pays', ['chp_01']],
      ['formule', sequence('chf', 1, 3)],
      ['format', sequence('chfmt', 1, 4)],
    ].flatMap(([kind, changeIds]) => [
      { id: `changement_oc_${kind}_cloture`, label: `Changement OC ${kind} — OC précédent clôturé`, decisionGuide: `Changement OC de type ${kind}, OC précédent déjà clôturé.`, actionIds: [...changeIds, ...sequence('doc', 1, 16)] },
      { id: `changement_oc_${kind}_ouvert`, label: `Changement OC ${kind} — OC précédent encore ouvert`, decisionGuide: `Changement OC de type ${kind}, OC précédent encore ouvert.`, actionIds: [...sequence('foc', 1, 10), ...changeIds, ...sequence('doc', 1, 16)] },
    ]),
  ],
  clarifications: [
    { id: 'debut_poste_etat', question: 'La ligne est arrêtée ou déjà en production ?', decisionGuide: 'Utiliser si l’état de ligne manque au début de poste.' },
    { id: 'debut_poste_oc', question: 'Si la ligne est arrêtée, as-tu un OC à lancer dans la foulée ?', decisionGuide: 'Utiliser si la ligne est arrêtée mais qu’on ignore si un OC doit suivre.' },
    { id: 'fin_poste_etat', question: 'Y a-t-il encore un OC en cours et/ou une cuve ouverte ?', decisionGuide: 'Utiliser si l’état OC/cuve manque en fin de poste.' },
    { id: 'debut_oc_precedent', question: 'L’OC précédent est-il déjà clôturé ?', decisionGuide: 'Utiliser au début d’un OC si l’état du précédent est inconnu.' },
    { id: 'fin_oc_ouvert', question: 'Y a-t-il bien un OC ouvert à clôturer maintenant ?', decisionGuide: 'Utiliser avant fin OC si on ignore si un OC est réellement ouvert.' },
    { id: 'fin_oc_ambigu', question: 'Tu as déjà clôturé l’OC dans le système, ou tu veux le faire maintenant ?', decisionGuide: 'Utiliser pour une formulation ambiguë comme « j’ai fini mon OC ».' },
    { id: 'changement_oc_contexte', question: 'Quel est le type de changement — Lot, Pays, Formule ou Format — et l’OC précédent est-il déjà clôturé ?', decisionGuide: 'Utiliser si le type de changement ou l’état de l’OC précédent manque.' },
    { id: 'debut_cuve_oc', question: 'Un OC est-il déjà ouvert ?', decisionGuide: 'Utiliser au début cuve si l’état OC est inconnu.' },
    { id: 'fin_cuve_ouverte', question: 'La cuve est-elle bien encore ouverte ?', decisionGuide: 'Utiliser avant fin cuve si l’état de la cuve est inconnu.' },
    { id: 'clarifier_situation', question: 'Peux-tu préciser la situation terrain et ce que tu veux faire maintenant ?', decisionGuide: 'Utiliser quand la situation ne permet pas encore une classification fiable.' },
  ],
  classifierRules: [
    'Le message courant prime sur l’historique en cas de conflit.',
    'Ne jamais supposer un état absent : utiliser une clarification lorsque le prérequis manque.',
    '« je clôture l’OC » signifie une action à faire ; « l’OC est clôturé » signifie un état déjà acquis.',
    'Un changement OC exige le type Lot/Pays/Formule/Format et l’état de clôture de l’OC précédent.',
    'Ne jamais sélectionner une route uniquement parce que son nom ressemble au message : respecter son decisionGuide.',
  ],
};
