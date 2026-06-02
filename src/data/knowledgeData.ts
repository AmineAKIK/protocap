import type { ProcedureDoc } from '../types/knowledge';

export const knowledgeCategories = [
  'Tous',
  'Démarrage',
  'Bloc de remplissage',
  'Changement de format',
  'Contrôle qualité',
  'Flux palettes',
  'Nettoyage',
  'Sécurité',
  'Halal'
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
      { action: "Créer l'appel logistique avec priorité", expected: 'Appel visible sur le board logistique' },
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
  },

  // ─── HALAL ────────────────────────────────────────────────────────────────

  {
    id: 'opl-hal-formation-operateur',
    code: 'OPL-HAL-001',
    title: "Ce que tout opérateur doit savoir sur le halal",
    category: 'Halal',
    type: 'OPL',
    status: 'active',
    version: 'v1.0',
    lineArea: 'Lignes halal',
    summary: "Leçon ponctuelle destinée à tous les opérateurs travaillant sur une ligne sous certification halal. Les auditeurs du client interviewer directement les opérateurs pour vérifier leur niveau de connaissance. Ce document prépare à ces questions.",
    steps: [
      {
        action: 'Comprendre ce qu\'est le halal dans notre contexte',
        expected: "Halal signifie « licite » en arabe. Pour nos produits de soins, cela signifie : aucun ingrédient d'origine porcine, pas d'alcool éthylique issu de fermentation alcoolique (type khamr), aucune contamination croisée avec des matières interdites. Les alcools gras végétaux et l'éthanol de synthèse industrielle ont un statut différent — voir SOP-HAL-001. Le client indonésien vend nos produits à des consommateurs qui font confiance à cette certification."
      },
      {
        action: 'Savoir identifier les deux grandes catégories d\'ingrédients interdits',
        expected: "1. Tout ce qui vient du porc : gélatine porcine, glycérine porcine, collagène porcin, graisse animale non certifiée. 2. L'alcool éthylique issu de fermentation (dit khamr). Attention : les alcools gras comme l'alcool cétylique ou stéarylique sont autorisés — ce sont des cires végétales, pas des alcools au sens religieux."
      },
      {
        action: 'Connaître son rôle concret sur la ligne',
        expected: "L'opérateur ne choisit pas les matières premières — c'est la qualité. Mais l'opérateur doit : respecter la ségrégation de la zone, ne jamais introduire de matière non validée dans la zone halal, signaler immédiatement toute anomalie ou doute au responsable halal."
      },
      {
        action: 'Savoir quoi répondre si un auditeur pose la question : « Que faites-vous si vous détectez une contamination ? »',
        expected: "Réponse attendue : « J'arrête immédiatement la production, j'isole les produits concernés, j'appelle le responsable halal. Je ne redémarre pas sans son autorisation. »"
      },
      {
        action: 'Comprendre pourquoi la traçabilité et les documents sont essentiels',
        expected: "Les auditeurs demandent à voir les enregistrements de formation, les fiches de suivi, les certificats fournisseurs. Un site bien organisé sans documents écrits n'obtient pas la certification."
      }
    ],
    keyChecks: [
      'Je sais ce qu\'est le halal et pourquoi c\'est important pour notre client',
      'Je connais les deux catégories d\'ingrédients interdits (porc + alcool de fermentation)',
      'Je sais que les alcools gras végétaux (cétylique, stéarylique) sont autorisés',
      'Je connais mon rôle : respecter la zone, signaler, ne pas décider seul',
      'Je sais quoi faire en cas de contamination : stop, isoler, appeler le responsable halal'
    ],
    watchPoints: [
      "Les auditeurs posent souvent des questions simples mais directes aux opérateurs : « C'est quoi le halal ? », « Qu'est-ce qui est interdit ? », « Que faites-vous en cas de doute ? » — savoir répondre clairement est aussi important que le reste.",
      "Ne jamais dire « je ne sais pas, ce n'est pas mon rôle ». La bonne réponse est toujours : « je signale immédiatement au responsable halal ».",
      "L'alcool cétylique et l'alcool stéarylique présents dans nos formules ne posent aucun problème halal — ce sont des émulsifiants végétaux. Ne pas les confondre avec l'éthanol."
    ],
    author: 'Responsable certification halal',
    validator: 'Direction qualité',
    updatedAt: '2026-05-26T08:00:00.000Z',
    nextReviewAt: '2026-11-26T08:00:00.000Z',
    relatedDocs: ['SOP-HAL-001', 'SOP-HAL-002', 'CHECK-HAL-001']
  },
  {
    id: 'sop-hal-ingredients',
    code: 'SOP-HAL-001',
    title: 'Ingrédients halal : autorisés, interdits, à vérifier',
    category: 'Halal',
    type: 'SOP',
    status: 'active',
    version: 'v1.1',
    lineArea: 'Lignes halal',
    summary: "Référentiel pratique des ingrédients utilisés en production de produits de soins sous certification halal. Chaque matière première doit être classée avant d'entrer en zone halal. Ce document est remis aux auditeurs et consultable par les opérateurs.",
    steps: [
      {
        action: 'Vérifier la source de la glycérine utilisée',
        expected: "Glycérine végétale (huile de palme, coprah) ou synthétique : autorisée. Glycérine animale non certifiée ou d'origine porcine : interdite. Le certificat halal du fournisseur doit le préciser explicitement."
      },
      {
        action: 'Identifier le type d\'alcool présent dans la formule',
        expected: "Alcools gras (alcool cétylique, alcool stéarylique, alcool cétéarylique) : autorisés — ce sont des cires végétales non intoxicantes. Éthanol issu de fermentation (bière, vin, levure) : interdit. Éthanol de synthèse chimique : toléré si le fournisseur fournit une attestation d'origine non-fermentation."
      },
      {
        action: 'Vérifier la source de tout collagène, gélatine ou kératine',
        expected: "Collagène marin (poisson) : autorisé. Collagène bovin avec certificat d'abattage halal : autorisé. Collagène porcin ou sans certificat : interdit. Gélatine : même règle — vérifier la source et le certificat."
      },
      {
        action: 'Contrôler les autres dérivés animaux (lanoline, acide hyaluronique, etc.)',
        expected: "Lanoline (issue de la laine de mouton) : autorisée si certifiée halal. Acide hyaluronique : généralement d'origine biotechnologique, vérifier le certificat fournisseur. Tout dérivé animal sans certificat halal valide est bloqué."
      },
      {
        action: 'Enregistrer chaque matière première dans le fichier matière-maître halal',
        expected: "Pour chaque ingrédient : nom, fournisseur, origine déclarée, statut halal (autorisé / interdit / à vérifier), numéro de certificat halal, date d'expiration du certificat. Ce fichier est contrôlé à chaque audit."
      }
    ],
    keyChecks: [
      'Glycérine : origine végétale ou synthétique confirmée par certificat',
      'Alcools gras végétaux autorisés — éthanol de fermentation interdit sans exception',
      'Collagène et gélatine : source marine ou bovine halal certifiée uniquement',
      'Aucune matière animale sans certificat halal fournisseur valide en zone',
      'Fichier matière-maître halal à jour et consultable immédiatement'
    ],
    watchPoints: [
      "Le critère pour l'alcool n'est pas la concentration — c'est l'origine. Un éthanol synthétique à 70 % peut être halal. Un éthanol de fermentation à 1 % ne l'est pas.",
      "Un certificat halal fournisseur expiré équivaut à une absence de certificat lors d'un audit. Vérifier les dates d'expiration avant la visite.",
      "Phénoxyéthanol, alcool benzylique, isopropanol : ces composés sont chimiquement distincts de l'éthanol — ils sont généralement acceptés, mais exiger le certificat fournisseur pour chacun.",
      "En cas de doute sur une matière, remonter l'information au responsable halal ou à la qualité — c'est à eux de trancher, pas à l'opérateur. La matière attend en dehors de la zone le temps de la décision."
    ],
    author: 'Responsable certification halal',
    validator: 'Direction qualité',
    updatedAt: '2026-05-26T08:30:00.000Z',
    nextReviewAt: '2026-11-26T08:30:00.000Z',
    relatedDocs: ['OPL-HAL-001', 'CHECK-HAL-001', 'REACT-HAL-001']
  },
  {
    id: 'sop-hal-demarrage-ligne',
    code: 'SOP-HAL-002',
    title: 'Démarrage et changement de matière — ligne halal',
    category: 'Halal',
    type: 'SOP',
    status: 'active',
    version: 'v1.2',
    lineArea: 'Lignes halal',
    summary: "Procédure de démarrage et de changement de matière sur une ligne sous certification halal. Chaque étape est tracée. Le responsable halal valide avant toute mise en production.",
    steps: [
      {
        action: 'Vérifier que la ligne est en état halal avant toute entrée de matière',
        expected: "Équipements propres, zone dégagée de toute matière non certifiée halal, affichage halal en place. Aucune trace de production non-halal précédente sans nettoyage validé."
      },
      {
        action: 'Contrôler le certificat halal de la matière entrante',
        expected: "Certificat halal fournisseur présent, valide (non expiré), et correspondant précisément à la matière et au lot reçu. Référence inscrite dans le dossier de lot."
      },
      {
        action: 'En cas de changement de matière : réaliser le nettoyage standard et le tracer',
        expected: "Nettoyage complet des équipements en contact produit selon la procédure standard, suivi d'un rinçage à l'eau propre. Le nettoyage est tracé dans le registre halal. Le protocole 7 lavages (SOP-HAL-003) ne s'applique qu'en cas de contamination avérée par un dérivé porcin — pas pour un changement de matière entre deux formules halal."
      },
      {
        action: 'Tracer la validation halal dans le dossier de lot avant lancement',
        expected: "Le responsable halal coche et signe la case validation de la fiche de démarrage — en personne ou par visa si la fiche est transmise. Ce n'est pas une formalité : c'est lui qui confirme que les conditions sont réunies. Si la fiche n'est pas renseignée, la production n'est pas certifiable halal, même si le reste est conforme."
      },
      {
        action: 'Enregistrer le numéro de lot, la matière et les références dans le dossier de lot halal',
        expected: "Dossier de lot complet : matière, fournisseur, numéro de certificat halal, opérateur, date et heure. Traçabilité disponible en moins de 10 minutes à la demande d'un auditeur."
      }
    ],
    keyChecks: [
      'Zone et équipements en état halal confirmés avant entrée matière',
      'Certificat halal de la matière : valide, correspondant au lot',
      'Nettoyage de rupture tracé si changement de matière',
      'Validation écrite du responsable halal avant tout démarrage',
      'Dossier de lot halal complet et accessible'
    ],
    watchPoints: [
      "La validation du responsable halal n'est pas qu'une signature sur un papier — c'est lui qui confirme que les ingrédients, les équipements et la zone sont conformes. Un lot produit sans cette validation dans le dossier ne peut pas être certifié halal, même si tout est correct par ailleurs.",
      "Si le certificat halal d'un fournisseur est absent ou expiré le jour du démarrage, la production de ce lot ne peut pas être certifiée halal. Anticiper avec le service achats — ça ne se règle pas dans l'urgence le matin du démarrage.",
      "Le responsable halal peut valider à distance si la fiche lui est transmise et qu'il a les éléments pour le faire — l'essentiel est que sa validation soit tracée dans le dossier de lot."
    ],
    author: 'Responsable certification halal',
    validator: 'Direction qualité',
    updatedAt: '2026-05-26T09:00:00.000Z',
    nextReviewAt: '2026-11-26T09:00:00.000Z',
    relatedDocs: ['SOP-HAL-001', 'SOP-HAL-003', 'CHECK-HAL-001']
  },
  {
    id: 'sop-hal-decontamination',
    code: 'SOP-HAL-003',
    title: 'Décontamination renforcée — contamination par ingrédient interdit',
    category: 'Halal',
    type: 'SOP',
    status: 'active',
    version: 'v1.1',
    lineArea: 'Lignes halal',
    summary: "Procédure de décontamination à appliquer obligatoirement si un équipement ou une surface en contact produit a été exposé à un ingrédient interdit (dérivé porcin). La règle religieuse exige 7 lavages successifs, dont le premier avec un agent contenant de l'argile. Chaque lavage est comptabilisé et documenté.",
    steps: [
      {
        action: 'Identifier et délimiter la zone ou l\'équipement contaminé',
        expected: "Surface ou équipement précisément identifié. Zone balisée, aucune production jusqu'à décontamination complète validée. Responsable halal prévenu immédiatement."
      },
      {
        action: 'Préparer la solution du premier lavage avec agent argileux',
        expected: "Utiliser de la bentonite ou de l'argile pure mélangée à de l'eau. L'exigence religieuse est que la terre soit présente dans ce premier lavage — elle n'a pas besoin d'être l'ingrédient majoritaire. Préparer en quantité suffisante pour couvrir entièrement la surface à traiter."
      },
      {
        action: 'Réaliser le 1er lavage avec la solution argileuse — noter « Lavage 1 » sur la fiche',
        expected: "Surface entièrement couverte, frottée, puis rincée à l'eau propre courante. Cocher « Lavage 1 » sur la fiche de décontamination. Ne pas passer à la suite sans avoir complété ce lavage."
      },
      {
        action: 'Réaliser les lavages 2 à 7 à l\'eau propre — noter chaque lavage sur la fiche',
        expected: "6 lavages successifs à l'eau propre, complets, avec rinçage entre chaque. Cocher chaque lavage sur la fiche au fur et à mesure. Total final : 7 lavages dont le premier avec argile."
      },
      {
        action: 'Laisser sécher complètement et réaliser une inspection visuelle',
        expected: "Surface sèche, propre, sans résidu visible ni odeur. Inspection réalisée par le responsable halal avant toute reprise."
      },
      {
        action: 'Compléter et signer la fiche de décontamination',
        expected: "Fiche remplie : date, heure, surface traitée, opérateur ayant réalisé les lavages, responsable halal ayant validé, référence du produit argileux utilisé. Fiche conservée dans le dossier halal du site."
      }
    ],
    keyChecks: [
      'Premier lavage avec agent contenant de la terre ou de l\'argile (bentonite) — fiche technique sans additif animal',
      '7 lavages au total — chacun coché individuellement sur la fiche',
      'Eau propre courante pour les lavages 2 à 7',
      'Séchage complet avant reprise',
      'Fiche de décontamination signée par le responsable halal et conservée'
    ],
    watchPoints: [
      "Cette procédure s'applique UNIQUEMENT en cas de contact avéré avec un dérivé porcin. Pour les autres contaminations (matière non certifiée mais sans porc), le nettoyage standard documenté suffit.",
      "7 lavages, pas 6. Si un doute existe sur le comptage en cours de procédure, recommencer depuis le début — un lavage manquant invalide toute la décontamination selon les normes halal.",
      "La bentonite est un minéral — elle est halal par nature. En revanche, si le produit argileux utilisé est un produit industriel formulé, vérifier que ses additifs (liants, tensioactifs) ne sont pas d'origine animale. La fiche technique fournisseur suffit — pas besoin de certificat halal pour de l'argile.",
      "Cette procédure peut prendre plusieurs heures. Prévoir l'impact sur le planning de production et ne jamais la bâcler sous pression de délai."
    ],
    author: 'Responsable certification halal',
    validator: 'Direction qualité',
    updatedAt: '2026-05-26T09:30:00.000Z',
    nextReviewAt: '2026-11-26T09:30:00.000Z',
    relatedDocs: ['REACT-HAL-001', 'CHECK-HAL-001']
  },
  {
    id: 'check-hal-audit-site',
    code: 'CHECK-HAL-001',
    title: 'Check-list préparation site — audit halal client',
    category: 'Halal',
    type: 'CHECK',
    status: 'active',
    version: 'v1.3',
    lineArea: 'Site de production',
    summary: "Points à vérifier et à mettre en ordre avant la visite des auditeurs halal du client. Couvre les documents, le terrain, les équipements et le personnel. À parcourir au minimum une semaine avant l'audit pour corriger les écarts à temps.",
    steps: [
      {
        action: 'Vérifier que tous les certificats halal fournisseurs sont valides et classés',
        expected: "Aucun certificat expiré dans le dossier. Chaque ingrédient en zone halal a son certificat à jour, classé et retrouvable en moins de 5 minutes. Renouveler tout certificat expirant dans les 30 jours."
      },
      {
        action: 'Tester la traçabilité sur au moins 3 lots halal récents',
        expected: "Pour chaque lot : remonter en moins de 10 minutes jusqu'à chaque matière première et son certificat fournisseur. Si une rupture est trouvée, la corriger avant l'audit — les auditeurs feront le même exercice."
      },
      {
        action: 'Inspecter la ségrégation physique de la zone halal',
        expected: "Zone halal clairement délimitée (marquage au sol, panneaux). Aucun ingrédient non certifié halal présent dans la zone. Équipements en contact produit dédiés à la zone halal, étiquetés. Stock de matières premières halal séparé physiquement."
      },
      {
        action: 'Vérifier les registres de formation du personnel halal',
        expected: "Tous les opérateurs travaillant en zone halal ont une fiche de formation signée et datée. La formation couvre : ingrédients interdits, rôle de l'opérateur, conduite à tenir en cas de contamination. Fiches classées et disponibles."
      },
      {
        action: 'Contrôler les enregistrements de production halal des 3 derniers mois',
        expected: "Fiches de démarrage halal signées, dossiers de lots complets, registres de nettoyage de rupture tracés. Aucune lacune — toute absence de document est une non-conformité lors de l'audit."
      },
      {
        action: 'S\'assurer que le responsable halal est disponible et briefé le jour de l\'audit',
        expected: "Le responsable halal est présent sur site pendant toute la durée de la visite. Il connaît l'emplacement de tous les documents. Il peut répondre aux questions techniques sur les ingrédients, les procédures et les enregistrements."
      },
      {
        action: 'Faire un briefing rapide avec les opérateurs de la zone halal la veille',
        expected: "Les opérateurs savent ce qu'est le halal, connaissent les ingrédients interdits, savent quoi faire en cas de problème. Ils peuvent répondre calmement et avec assurance si un auditeur leur pose une question directe."
      }
    ],
    keyChecks: [
      'Zéro certificat halal fournisseur expiré dans le dossier',
      'Traçabilité lot → matières premières vérifiable en moins de 10 minutes',
      'Zone halal physiquement délimitée, propre, sans matière non certifiée',
      'Registres de formation opérateurs signés et disponibles',
      'Dossiers de lots des 3 derniers mois complets et sans lacune',
      'Responsable halal présent et briefé le jour J'
    ],
    watchPoints: [
      "Les auditeurs choisissent eux-mêmes les lots à tracer — souvent les plus anciens ou ceux avec le plus d'ingrédients. Toute lacune sera trouvée.",
      "Les auditeurs interrogent directement les opérateurs sur le terrain, sans prévenir. Un opérateur qui ne sait pas répondre à « qu'est-ce qui est interdit dans vos ingrédients ? » est une non-conformité de formation.",
      "Faire un état des lieux honnête avant l'audit : si une procédure décrit un marquage au sol qui n'existe pas, il vaut mieux corriger le terrain ou adapter la procédure avant la visite. Les auditeurs comparent ce qu'ils voient avec ce qui est écrit.",
      "Un document bien tenu vaut mieux qu'un site parfait sans trace écrite. Dans la certification halal, si ce n'est pas écrit, c'est comme si ce n'était pas fait."
    ],
    author: 'Responsable certification halal',
    validator: 'Direction qualité',
    updatedAt: '2026-05-26T10:00:00.000Z',
    nextReviewAt: '2026-09-26T10:00:00.000Z',
    relatedDocs: ['OPL-HAL-001', 'SOP-HAL-001', 'SOP-HAL-002', 'SOP-HAL-003', 'REACT-HAL-001']
  },
  {
    id: 'react-hal-contamination',
    code: 'REACT-HAL-001',
    title: 'Fiche réaction — introduction d\'un ingrédient interdit en zone halal',
    category: 'Halal',
    type: 'REACT',
    status: 'active',
    version: 'v1.1',
    lineArea: 'Lignes halal',
    summary: "Réflexes à adopter immédiatement si un ingrédient interdit (dérivé porcin ou alcool de fermentation non conforme) entre en contact avec un équipement ou un produit en zone halal. La réactivité et la traçabilité de la réponse sont aussi importantes que la contamination elle-même.",
    steps: [
      {
        action: 'Stopper immédiatement la production sur la ligne concernée',
        expected: "Ligne à l'arrêt. Aucun produit supplémentaire fabriqué. L'opérateur qui a détecté reste disponible pour expliquer les circonstances."
      },
      {
        action: 'Mettre en quarantaine tous les produits potentiellement affectés',
        expected: "Lots concernés identifiés, écartés et étiquetés « HALAL — QUARANTAINE — NE PAS EXPÉDIER ». Aucune libération ni expédition sans décision formelle du responsable halal."
      },
      {
        action: 'Évaluer la nature de la contamination pour choisir le bon protocole',
        expected: "Dérivé porcin avéré → procédure de décontamination 7 lavages obligatoire (SOP-HAL-003). Alcool de fermentation ou autre matière interdite sans dérivé porcin → nettoyage renforcé standard, documenté et validé par le responsable halal."
      },
      {
        action: 'Prévenir le responsable halal dans les 15 minutes',
        expected: "Responsable halal joint immédiatement. Fiche de contamination ouverte avec : nature de la contamination, surface ou équipement concerné, lots affectés, heure de détection, opérateur concerné."
      },
      {
        action: 'Appliquer le protocole de décontamination sous supervision du responsable halal',
        expected: "Décontamination réalisée selon SOP-HAL-003 si dérivé porcin. Nettoyage renforcé documenté dans les autres cas. Reprise de production uniquement après validation écrite du responsable halal."
      },
      {
        action: 'Statuer formellement sur les lots en quarantaine',
        expected: "Décision écrite, signée par le responsable halal et la direction : destruction du lot, requalification en lot non-halal (avec changement d'étiquetage), ou libération si l'analyse confirme l'absence de contamination. Aucune décision verbale."
      }
    ],
    keyChecks: [
      'Production stoppée immédiatement — pas d\'attente, pas de finir le lot en cours',
      'Lots affectés en quarantaine avec étiquette physique, aucune expédition',
      'Nature de la contamination évaluée avant de choisir le protocole',
      'Responsable halal prévenu dans les 15 minutes, fiche ouverte',
      'Reprise production uniquement après validation du responsable halal tracée dans le dossier',
      'Décision formelle et signée sur chaque lot en quarantaine'
    ],
    watchPoints: [
      "Ne jamais expédier un lot sous certification halal avant que la contamination soit totalement écartée — même sous pression client ou délai. Expédier un produit halal contaminé est une faute grave et un risque pour la certification de tout le site.",
      "Un lot requalifié « non-halal » ne peut pas simplement être réétiquetté et expédié : il faut une décision écrite, une traçabilité mise à jour et s'assurer que ce lot ne partira pas vers les marchés qui exigent la certification halal.",
      "La réglementation cosmétique européenne (règlement 1223/2009) impose une conservation des dossiers de lots pendant 10 ans après la dernière mise sur le marché. Les documents liés à un incident halal suivent au minimum cette durée — vérifier aussi les exigences contractuelles du certificateur client.",
      "Si la contamination est avérée et grave, informer le client (certificateur) est souvent contractuellement obligatoire. Ne pas tenter de gérer l'incident en interne sans en référer à la direction."
    ],
    author: 'Responsable certification halal',
    validator: 'Direction qualité',
    updatedAt: '2026-05-26T10:30:00.000Z',
    nextReviewAt: '2026-11-26T10:30:00.000Z',
    relatedDocs: ['SOP-HAL-003', 'SOP-HAL-002', 'CHECK-HAL-001']
  }
];
