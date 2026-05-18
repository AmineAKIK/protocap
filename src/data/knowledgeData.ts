import type { ProcedureDoc } from '../types/knowledge';

export const knowledgeCategories = [
  'Tous',
  'Démarrage',
  'Bloc de remplissage',
  'Changement de format',
  'Contrôle qualité',
  'Flux palettes',
  'Nettoyage',
  'Sécurité'
];

export const procedureDocs: ProcedureDoc[] = [
  {
    id: 'sop-start-line',
    code: 'SOP-COND-001',
    title: 'Démarrage ligne de conditionnement',
    category: 'Démarrage',
    type: 'SOP',
    status: 'active',
    version: 'v3.2',
    lineArea: 'Toutes lignes',
    summary: 'Séquence de mise en route à respecter avant toute production. Couvre la vérification du bloc de remplissage, la cuve, les réglages format et les contrôles démarrage.',
    steps: [
      { action: 'Identifier la ligne et la cuve associée', expected: 'Cuve référencée, matière confirmée' },
      { action: 'Contrôler la validité du bloc de remplissage', expected: 'Bloc dans sa période de validité (≤ 5 j)' },
      { action: 'Vérifier les réglages de format', expected: "Format conforme à l'ordre de fabrication" },
      { action: 'Réaliser le contrôle de démarrage', expected: 'Tous les points validés avant lancement' }
    ],
    keyChecks: [
      'Bloc de remplissage non expiré',
      'Cuve identifiée et matière conforme',
      'Réglages format vérifiés',
      'Zone palette dégagée'
    ],
    watchPoints: [
      'Ne jamais démarrer si le bloc est expiré ou si un changement de matière est en attente.',
      "Un écart sur le format doit être signalé avant lancement, pas après."
    ],
    author: 'Équipe méthodes',
    validator: 'Référent conditionnement',
    updatedAt: '2026-03-12T09:30:00.000Z',
    nextReviewAt: '2026-09-12T09:30:00.000Z',
    relatedDocs: ['SOP-COND-002', 'CHECK-COND-001']
  },
  {
    id: 'sop-bloc-remplissage',
    code: 'SOP-COND-002',
    title: 'Remplacement du bloc de remplissage',
    category: 'Bloc de remplissage',
    type: 'SOP',
    status: 'active',
    version: 'v2.1',
    lineArea: 'Toutes lignes',
    summary: 'Procédure de remplacement du bloc de remplissage en contact produit. Obligatoire tous les 5 jours ou lors de tout changement de matière.',
    steps: [
      { action: 'Arrêter la ligne et sécuriser le poste', expected: "Ligne à l'arrêt, aucun produit en cours" },
      { action: 'Retirer le bloc de remplissage en place', expected: 'Bloc retiré sans contamination du poste' },
      { action: 'Installer le bloc propre identifié', expected: 'Bloc posé, raccordements vérifiés' },
      { action: "Déclarer la date et l'opérateur dans le suivi", expected: 'Trace enregistrée, date limite calculée' }
    ],
    keyChecks: [
      'Bloc retiré proprement',
      'Bloc neuf propre et identifié',
      'Raccordements vérifiés',
      'Déclaration tracée avec date et opérateur'
    ],
    watchPoints: [
      "Tout changement de matière impose ce remplacement, même si le bloc est encore dans sa période.",
      "La date de pose doit être enregistrée immédiatement — pas en fin de poste."
    ],
    author: 'Support terrain',
    validator: 'Coordinateur qualité',
    updatedAt: '2026-02-18T14:00:00.000Z',
    nextReviewAt: '2026-08-18T14:00:00.000Z',
    relatedDocs: ['SOP-COND-001', 'CHECK-COND-002']
  },
  {
    id: 'check-demarrage',
    code: 'CHECK-COND-001',
    title: 'Check-list contrôle démarrage',
    category: 'Démarrage',
    type: 'CHECK',
    status: 'active',
    version: 'v1.4',
    lineArea: 'Toutes lignes',
    summary: 'Points de contrôle à valider avant toute autorisation de démarrage. Document à parcourir systématiquement, sans exception.',
    steps: [
      { action: 'Bloc de remplissage : date de pose et péremption', expected: 'Dans la période de validité' },
      { action: 'Cuve : référence et matière', expected: "Conforme à l'ordre de fabrication" },
      { action: 'Format : réglages machine', expected: 'Réglages conformes au format en cours' },
      { action: 'Zone palette : dégagée', expected: 'Aucun obstacle, palette vide disponible' }
    ],
    keyChecks: [
      'Bloc de remplissage valide',
      'Cuve et matière conformes',
      'Format vérifié',
      'Zone palette opérationnelle'
    ],
    watchPoints: [
      "Tout point non conforme bloque le démarrage jusqu'à correction.",
      "Ne pas valider par défaut — chaque point doit être physiquement vérifié."
    ],
    author: 'Équipe méthodes',
    validator: 'Référent conditionnement',
    updatedAt: '2026-04-05T08:00:00.000Z',
    nextReviewAt: '2026-10-05T08:00:00.000Z',
    relatedDocs: ['SOP-COND-001']
  },
  {
    id: 'sop-changement-format',
    code: 'SOP-COND-003',
    title: 'Changement de format',
    category: 'Changement de format',
    type: 'SOP',
    status: 'active',
    version: 'v4.0',
    lineArea: 'Toutes lignes',
    summary: "Séquence de changement de format entre deux ordres de fabrication. Couvre l'arrêt propre, le changement des éléments format, les réglages et le contrôle de reprise.",
    steps: [
      { action: 'Clôturer le lot précédent', expected: 'Quantités confirmées, traçabilité complète' },
      { action: 'Vider et nettoyer les zones en contact produit', expected: 'Aucun résidu du lot précédent' },
      { action: 'Changer les éléments format', expected: 'Éléments du nouveau format posés et vérifiés' },
      { action: 'Réaliser un contrôle de reprise', expected: 'Premiers flacons conformes avant lancement série' }
    ],
    keyChecks: [
      'Lot précédent clôturé',
      'Pas de mélange de composants',
      'Éléments format changés',
      'Contrôle de reprise réalisé'
    ],
    watchPoints: [
      "Vérifier les étiquettes avant de lancer — un mélange de références est un incident qualité majeur.",
      "Le contrôle de reprise n'est pas optionnel."
    ],
    author: 'Équipe méthodes',
    validator: 'Référent conditionnement',
    updatedAt: '2026-02-07T16:30:00.000Z',
    nextReviewAt: '2026-08-07T16:30:00.000Z',
    relatedDocs: ['SOP-COND-001', 'CHECK-COND-001']
  },
  {
    id: 'sop-palette',
    code: 'SOP-LOG-001',
    title: 'Gestion des palettes en fin de ligne',
    category: 'Flux palettes',
    type: 'SOP',
    status: 'active',
    version: 'v1.1',
    lineArea: 'Toutes lignes',
    summary: "Mode opératoire pour la gestion des palettes finies : signalement logistique, attente, évacuation.",
    steps: [
      { action: 'Identifier la ligne et la zone palette', expected: 'Ligne et zone correctement renseignées' },
      { action: 'Créer l\'appel logistique avec priorité', expected: 'Appel visible sur le board logistique' },
      { action: 'Attendre la confirmation de prise en charge', expected: 'Statut "En route" visible' }
    ],
    keyChecks: [
      'Zone palette correctement identifiée',
      'Nombre de palettes exact',
      'Priorité correctement évaluée',
      'Appel envoyé'
    ],
    watchPoints: [
      "Utiliser la priorité haute uniquement si la zone bloque la production.",
      "Un appel non pris en charge après 15 minutes doit être signalé."
    ],
    author: 'Équipe amélioration continue',
    validator: 'Référent logistique',
    updatedAt: '2026-04-02T10:15:00.000Z',
    nextReviewAt: '2026-10-02T10:15:00.000Z',
    relatedDocs: ['SOP-COND-001']
  },
  {
    id: 'react-anomalie',
    code: 'REACT-COND-001',
    title: "Réaction en cas d'anomalie ligne",
    category: 'Contrôle qualité',
    type: 'REACT',
    status: 'active',
    version: 'v2.3',
    lineArea: 'Toutes lignes',
    summary: "Réflexes à adopter face à une anomalie détectée sur la ligne. Priorité : isoler, signaler, tracer.",
    steps: [
      { action: 'Stopper la ligne dès détection', expected: "Ligne arrêtée, pas de produit douteux libéré" },
      { action: 'Isoler les unités concernées', expected: 'Unités douteuses clairement écartées' },
      { action: 'Prévenir le référent qualité', expected: 'Référent informé avec les faits observés' },
      { action: "Documenter l'anomalie", expected: 'Fiche anomalie remplie avant de redémarrer' }
    ],
    keyChecks: [
      'Ligne arrêtée immédiatement',
      'Unités douteuses isolées',
      'Référent informé',
      'Anomalie documentée'
    ],
    watchPoints: [
      "Ne jamais libérer de produit douteux sans validation du référent qualité.",
      "Documenter les faits — pas les interprétations."
    ],
    author: 'Équipe qualité',
    validator: 'Responsable atelier',
    updatedAt: '2026-01-28T08:45:00.000Z',
    nextReviewAt: '2026-07-28T08:45:00.000Z',
    relatedDocs: ['CHECK-COND-001']
  },
  {
    id: 'sop-nettoyage',
    code: 'SOP-HYG-001',
    title: 'Nettoyage de poste entre deux lots',
    category: 'Nettoyage',
    type: 'SOP',
    status: 'active',
    version: 'v2.0',
    lineArea: 'Toutes lignes',
    summary: 'Séquence de nettoyage du poste de conditionnement entre deux phases de production. Obligatoire avant tout changement de lot ou de format.',
    steps: [
      { action: 'Retirer les déchets et emballages vides', expected: 'Poste dégagé de tout déchet' },
      { action: 'Nettoyer les surfaces de travail', expected: 'Surfaces propres, sans résidu produit' },
      { action: "Contrôler les zones difficiles d'accès", expected: 'Aucun résidu dans les angles et dessous machine' },
      { action: 'Validation visuelle du poste', expected: 'Poste validé propre avant reprise' }
    ],
    keyChecks: [
      'Aucun déchet visible',
      'Surfaces de travail nettoyées',
      "Zones difficiles d'accès contrôlées",
      'Validation visuelle effectuée'
    ],
    watchPoints: [
      'Utiliser uniquement les produits et consommables prévus pour ce type de nettoyage.',
      'Signaler tout élément endommagé découvert pendant le nettoyage.'
    ],
    author: 'Support terrain',
    validator: 'Référent hygiène',
    updatedAt: '2026-03-05T11:20:00.000Z',
    nextReviewAt: '2026-09-05T11:20:00.000Z',
    relatedDocs: ['SOP-COND-003']
  }
];
