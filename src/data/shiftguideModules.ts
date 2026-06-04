export interface SGAction {
  id: string;
  text: string;
  note?: string;
}

export interface SGSubModule {
  id: string;
  title: string;
  description?: string;
  actions: SGAction[];
  footerNote?: string;
}

export interface SGModule {
  id: string;
  title: string;
  icon: string;
  description: string;
  type: 'standard' | 'choice';
  actions?: SGAction[];
  subModules?: SGSubModule[];
  footerNote?: string;
}

export const sgModules: SGModule[] = [
  {
    id: 'badgeage',
    title: 'Badgeage',
    icon: '🪪',
    description: "Début et fin d'équipe SPI",
    type: 'choice',
    subModules: [
      {
        id: 'badgeage_debut',
        title: "Début d'équipe",
        actions: [
          {
            id: 'bd_01',
            text: "Se badger à la badgeuse noire de l'atelier",
            note: "Badgeuse physique à l'entrée de l'atelier",
          },
          {
            id: 'bd_02',
            text: "Se badger sur SPI en respectant les règles de déclaration d'état ligne",
            note: "Respecter l'arbre décisionnel de l'état ligne (production / maintenance / panne / changement / attente)",
          },
        ],
      },
      {
        id: 'badgeage_fin',
        title: "Fin d'équipe",
        actions: [
          { id: 'bf_01', text: 'Se débadger sur SPI en cliquant « Fin d\'équipe »' },
          { id: 'bf_02', text: "Se débadger à la badgeuse noire de l'atelier" },
        ],
      },
    ],
  },
  {
    id: 'debut_poste',
    title: 'Début de poste',
    icon: '⏳',
    description: '12 vérifications avant production',
    type: 'standard',
    footerNote: 'La ligne reste en production le temps du passage de consigne',
    actions: [
      {
        id: 'dp_01',
        text: "S'identifier dans SPI pour entrer sur ligne",
        note: 'Système SPI — sélectionner la bonne ligne',
      },
      {
        id: 'dp_02',
        text: "S'identifier sur APRISO avec son FR",
        note: 'FR = Front, étiquette recto — identifiant opérateur',
      },
      {
        id: 'dp_03',
        text: 'Vérifier la validité de la ligne sécurité, qualité et performance et compléter les standards sur SOLVACE',
      },
      { id: 'dp_04', text: 'Imprimer une nomenclature' },
      { id: 'dp_05', text: "Vérifier l'instruction de conditionnement" },
      {
        id: 'dp_06',
        text: 'Vérifier les appareils de mesure et de contrôle : balance, caisson à vide, couple mètre',
      },
      {
        id: 'dp_07',
        text: 'Vérifier la référence des AC et du jus',
        note: 'AC = Article de Conditionnement',
      },
      {
        id: 'dp_08',
        text: 'Vérifier la validité des kits de remplisseuses et branchements AD',
      },
      {
        id: 'dp_09',
        text: "Vérifier la tare d'un AC en le pesant sur la balance",
      },
      {
        id: 'dp_10',
        text: 'Vérifier le N° lot et la DDP',
        note: 'DDP = Date De Péremption',
      },
      {
        id: 'dp_11',
        text: 'Vérifier les PZD',
        note: 'PZD = Point Zéro Défaut',
      },
      {
        id: 'dp_12',
        text: "Si la ligne n'a pas tourné depuis plus de 4h : faire un prélèvement microbio",
        note: "Cette action peut être N/A si la ligne a tourné récemment",
      },
    ],
  },
  {
    id: 'fin_poste',
    title: 'Fin de poste',
    icon: '🏁',
    description: '5 actions de clôture',
    type: 'standard',
    footerNote: 'La ligne reste en production le temps du passage de consigne. Toujours enchaîner avec Badgeage fin.',
    actions: [
      {
        id: 'fp_01',
        text: 'Déclarer la palette partielle',
        note: "Ne pas coller l'étiquette palette",
      },
      { id: 'fp_02', text: 'Réalimenter la ligne en AC' },
      { id: 'fp_03', text: "Passer les consignes à l'opérateur suivant" },
      { id: 'fp_04', text: "Se déconnecter d'APRISO" },
      {
        id: 'fp_06',
        text: "Si personne n'est affecté sur l'équipe suivante : arrêt complet",
        note: "Vider la remplisseuse / arrêter les machines (convoyeurs, four, soudeuse) / protéger les AC / mettre la ligne en « non engagée » sur SPI — N/A si une équipe prend la suite",
      },
    ],
  },
  {
    id: 'debut_oc',
    title: "Début d'OC",
    icon: '🚀',
    description: '16 étapes avant lancement OC',
    type: 'standard',
    actions: [
      {
        id: 'doc_01',
        text: 'Vérifier la disponibilité des AC et les commander si besoin',
      },
      {
        id: 'doc_02',
        text: "Ouvrir l'OC",
        note: 'OC = Ordre de Conditionnement',
      },
      { id: 'doc_03', text: 'Vérifier et valider le vide de ligne' },
      { id: 'doc_04', text: 'Imprimer une nomenclature' },
      { id: 'doc_05', text: "Vérifier l'instruction de conditionnement" },
      {
        id: 'doc_06',
        text: 'Vérifier les appareils de mesure et contrôle : balance, caisson à vide, couple mètre',
      },
      {
        id: 'doc_07',
        text: 'Vérifier les références AC/Jus et lire les fiches AC/Jus',
      },
      {
        id: 'doc_08',
        text: 'Vérifier la tare et la réaliser si besoin',
      },
      {
        id: 'doc_09',
        text: 'Vérifier à nouveau les références AC/Jus et confirmer la lecture des fiches',
      },
      { id: 'doc_10', text: 'Ouvrir Fapimpec' },
      {
        id: 'doc_11',
        text: 'Vérifier les étiquettes SPCB et UBI',
        note: 'SPCB = Sous Par ComBien / UBI = Étiquette de caisse',
      },
      { id: 'doc_12', text: 'Démarrer les machines' },
      {
        id: 'doc_13',
        text: 'Vérifier les 1ers produits : ASPECT — N° LOT — DDP — POIDS et valider les autocontrôles associés',
      },
      {
        id: 'doc_14',
        text: 'Faire faire le double check : validation et vérification',
      },
      { id: 'doc_15', text: 'Lancer la production' },
      {
        id: 'doc_16',
        text: "Faire les prélèvements « Début d'OC » en fin de ligne",
      },
    ],
  },
  {
    id: 'fin_oc',
    title: "Fin d'OC",
    icon: '✅',
    description: '10 opérations de clôture OC',
    type: 'standard',
    actions: [
      {
        id: 'foc_01',
        text: "Faire les prélèvements « Fin d'OC » en respectant l'instruction de prélèvement",
      },
      { id: 'foc_02', text: 'Vider la ligne de ses produits' },
      {
        id: 'foc_03',
        text: 'Vérifier le nombre de prélèvements microbio — 5 minimum',
      },
      {
        id: 'foc_04',
        text: 'Déclarer la quantité exacte de palette en cours',
      },
      { id: 'foc_05', text: "Clôturer l'OC" },
      { id: 'foc_06', text: 'Évacuer les prélèvements' },
      { id: 'foc_07', text: 'Quitter Fapimpec' },
      {
        id: 'foc_08',
        text: 'Ajuster et réintégrer la quantité exacte de tous les AC et jus',
      },
      { id: 'foc_09', text: 'Nettoyer la ligne' },
      { id: 'foc_10', text: 'Peser et vider les poubelles' },
    ],
  },
  {
    id: 'changement_oc',
    title: 'Changement OC',
    icon: '🔄',
    description: '4 types de changement',
    type: 'choice',
    subModules: [
      {
        id: 'ch_lot',
        title: 'Changement de Lot',
        description: 'Type 1',
        footerNote: "Toujours suivre les consignes des fiches Début et Fin d'OC",
        actions: [
          { id: 'chl_01', text: 'Changer le Numéro de Lot' },
        ],
      },
      {
        id: 'ch_pays',
        title: 'Changement de Pays',
        description: 'Type 2',
        footerNote: "Toujours suivre les consignes des fiches Début et Fin d'OC",
        actions: [
          { id: 'chp_01', text: 'Changer la langue des AC imprimés' },
        ],
      },
      {
        id: 'ch_formule',
        title: 'Changement de Formule',
        description: 'Type 3',
        footerNote: "Toujours suivre les consignes des fiches Début et Fin d'OC",
        actions: [
          { id: 'chf_01', text: 'Modifier la formule' },
          { id: 'chf_02', text: 'Changer de kit et faire le lavage AD' },
          { id: 'chf_03', text: 'Refaire les PZD concernés', note: 'Obligatoire après changement de formule' },
        ],
      },
      {
        id: 'ch_format',
        title: 'Changement de Format',
        description: 'Type 4',
        footerNote: "Toujours suivre les consignes des fiches Début et Fin d'OC",
        actions: [
          { id: 'chfmt_01', text: 'Modifier la formule et les AC' },
          {
            id: 'chfmt_02',
            text: 'Faire régler les machines par les techniciens',
          },
          { id: 'chfmt_03', text: 'Changer de kit et faire le lavage AD' },
          { id: 'chfmt_04', text: 'Refaire les PZD concernés', note: 'Obligatoire après changement de format' },
        ],
      },
    ],
  },
  {
    id: 'debut_cuve',
    title: 'Début de cuve',
    icon: '🛢️',
    description: '6 vérifications cuve',
    type: 'standard',
    actions: [
      {
        id: 'dc_01',
        text: 'Vérifier la référence du jus et le numéro de cuve',
      },
      { id: 'dc_02', text: 'Lire la cuve' },
      { id: 'dc_03', text: 'Brancher et ouvrir la cuve' },
      {
        id: 'dc_04',
        text: 'Faire le contrôle mirage / étalement / contrôle teinte prévue',
        note: 'Sur certaines lignes uniquement — peut être N/A',
      },
      {
        id: 'dc_05',
        text: 'Faire un poids : réglage et démarrage APRISO',
      },
      {
        id: 'dc_06',
        text: 'Faire les prélèvements de début de cuve',
      },
    ],
  },
  {
    id: 'fin_cuve',
    title: 'Fin de cuve',
    icon: '🏺',
    description: '3 vérifications fin de cuve',
    type: 'standard',
    actions: [
      {
        id: 'fc_01',
        text: 'Vérifier le poids des 20 derniers produits pour contrôler le remplissage',
      },
      {
        id: 'fc_02',
        text: 'En tare individuelle : contrôler le remplissage de visu',
        note: "Peut être N/A si non applicable à cette ligne",
      },
      {
        id: 'fc_03',
        text: 'Faire les prélèvements de fin de cuve',
      },
    ],
  },
  {
    id: 'production',
    title: 'Production',
    icon: '⚙️',
    description: '10 tâches en cours de ligne',
    type: 'standard',
    actions: [
      {
        id: 'prod_01',
        text: 'Faire et valider les contrôles qualité',
      },
      {
        id: 'prod_02',
        text: 'Faire les prélèvements microbio — 5 minimum par OC',
      },
      { id: 'prod_03', text: 'Alimenter la ligne en AC' },
      {
        id: 'prod_04',
        text: 'Vérifier la référence AC à chaque carton',
      },
      {
        id: 'prod_05',
        text: "Pendant la pause ou un arrêt prolongé : arrêter les convoyeurs et machines, éteindre la lampe du poste op, protéger les AC",
      },
      {
        id: 'prod_06',
        text: 'Nettoyer les becs et buses de remplissage à chaque retour de pause',
      },
      { id: 'prod_07', text: 'Justifier les arrêts sur SPI' },
      {
        id: 'prod_08',
        text: 'Vider les poubelles lorsqu\'elles sont pleines',
      },
      { id: 'prod_09', text: 'Participer aux tournées terrain' },
      {
        id: 'prod_10',
        text: 'Refaire les PZD si changement de format, de formule ou si intervention technique sur un outil zéro défaut',
      },
    ],
  },
  {
    id: 'tri',
    title: 'Tri',
    icon: '🗂️',
    description: '6 étapes de tri produits',
    type: 'standard',
    actions: [
      {
        id: 'tri_01',
        text: 'Se badger et mettre un commentaire : « L__ »',
      },
      {
        id: 'tri_02',
        text: "Prendre connaissance de la consigne de tri dans le document MAC-IM-021 et signer la prise de connaissance",
      },
      {
        id: 'tri_03',
        text: 'Renseigner au fur et à mesure les cartons triés et le nombre de défectueux sur la feuille de suivi',
      },
      {
        id: 'tri_04',
        text: 'Séparer et identifier les PF défectueux, les PF à trier et les PF conformes',
        note: 'PF = Produit Fini',
      },
      {
        id: 'tri_05',
        text: "Informer l'animateur des résultats en fin d'équipe",
      },
      {
        id: 'tri_06',
        text: 'Remettre en état la zone de tri avant de la quitter',
      },
    ],
  },
];

export const lexiqueEntries = [
  { sigle: 'AC', definition: 'Article de Conditionnement' },
  { sigle: 'ALL', definition: 'Allégé' },
  { sigle: 'ATEX', definition: 'ATmosphère EXplosive' },
  { sigle: 'BK', definition: 'Back — Étiquette verso' },
  { sigle: 'BOM', definition: 'Bill Of Material (Nomenclature)' },
  { sigle: 'BP', definition: 'Bonne Pratique' },
  { sigle: 'BPC', definition: 'Bon du Premier Coup' },
  { sigle: 'BPF', definition: 'Bonne Pratique de Fabrication' },
  { sigle: 'BTL', definition: 'Bottle — Flacon' },
  {
    sigle: 'CSAR',
    definition:
      'Cosmetic Supervision and Administration Regulation (réglementation spécifique Chine)',
  },
  { sigle: 'CTN', definition: 'Carton — Étuis' },
  { sigle: 'DDP', definition: 'Date De Péremption' },
  { sigle: 'EPI', definition: 'Équipement de Protection Individuelle (gants, lunettes, chaussures…) — ou Equipier de Première Intervention selon le contexte' },
  { sigle: 'ESI', definition: 'Equipier de Seconde Intervention' },
  { sigle: 'FR', definition: 'Front — Étiquette recto' },
  { sigle: 'OC', definition: 'Ordre de Conditionnement' },
  { sigle: 'OF', definition: 'Ordre de Fabrication' },
  { sigle: 'OPL', definition: 'One Point Lesson (Leçon en un point)' },
  {
    sigle: 'OTC',
    definition:
      'Over The Counter (produit pharmaceutique sans ordonnance US, Canada, Australie)',
  },
  { sigle: 'PCB', definition: 'Par ComBien (Regroupement par caisse)' },
  { sigle: 'PF', definition: 'Produit Fini' },
  {
    sigle: 'PIO',
    definition:
      "Performance Improvement Opportunity (Proposition amélioration performance)",
  },
  { sigle: 'PLS', definition: 'Plastique' },
  { sigle: 'PUMP', definition: 'Pompe' },
  { sigle: 'PZD', definition: 'Point Zéro Défaut' },
  {
    sigle: 'QIO',
    definition:
      "Quality Improvement Opportunity (Proposition amélioration qualité)",
  },
  { sigle: 'R', definition: 'Recyclé (en début de libellé AC dans BOM)' },
  {
    sigle: 'SCOOP',
    definition: 'Statistical COntrol On Production',
  },
  { sigle: 'SF', definition: 'produit Semi Fini (code produit en 11 ou 13)' },
  {
    sigle: 'SIO',
    definition:
      "Security Improvement Opportunity (Proposition d'amélioration sécurité)",
  },
  {
    sigle: 'SPCB',
    definition: 'Sous Par ComBien (Étiquette de regroupement pack x3)',
  },
  { sigle: 'TC', definition: 'Tube Carton' },
  { sigle: 'TRG', definition: 'Taux de Rendement Global' },
  { sigle: 'TRS', definition: 'Taux de Rendement Synthétique' },
  { sigle: 'TMBF', definition: 'Temps Moyen de Bon Fonctionnement' },
  { sigle: 'TUB', definition: 'Tube' },
  { sigle: 'UBI', definition: 'Étiquette de caisse' },
  {
    sigle: 'UN',
    definition:
      "Logo pour transport de produits dangereux (ADR : Accord for Dangerous goods by Road)",
  },
  { sigle: 'UP', definition: 'Unité de Production' },
  { sigle: 'VNR', definition: 'Valeur Nominale de Réglage' },
  { sigle: 'VRAC', definition: 'Jus non conditionné' },
];
