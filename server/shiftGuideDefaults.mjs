export const DEFAULT_SHIFTGUIDE_URGENCES = Object.freeze({
  emergencyNumbers: ['15', '18'],
  generalAlarm: {
    signal: 'Sirène longue',
    instruction: 'Évacuation générale immédiate',
    steps: [
      'Sorties de secours les plus proches',
      "Point de rassemblement par l'extérieur",
      'Toujours avancer, pas de retour arrière',
      "Répondre à l'appel",
      'Reprise uniquement après autorisation',
    ],
  },
  drill: {
    schedule: 'Premier mardi de chaque mois à 15h',
    instruction: 'Ne pas évacuer',
  },
  accidentSteps: [
    { id: 'proteger', label: 'Protéger', description: "Arrêt d'urgence, balisage, zone sécurisée." },
    { id: 'alerter', label: 'Alerter', description: '15 ou 18 depuis un poste interne.' },
    { id: 'secourir', label: 'Secourir', description: 'Rester disponible, suivre les consignes.' },
  ],
  goldenRules: [
    { id: 'loto', label: 'LOTO', description: 'Consignation, déconsignation et carter ouvert.' },
    { id: 'coupure', label: 'Coupure', description: 'Gants obligatoires pour cartons et verres.' },
    { id: 'equipement', label: 'Équipement valide', description: 'Matériel validé sécurité uniquement.' },
    { id: 'ergonomie', label: 'Ergonomie', description: 'Charge près du corps, posture stable.' },
    { id: 'choc', label: 'Choc', description: 'Utiliser les éléments bleus anti-blessure.' },
    { id: 'coactivite', label: 'Co-activité', description: 'Contact visuel avant passage piéton.' },
    { id: 'chimique', label: 'Chimique', description: 'Lunettes en zone de production.' },
    { id: 'environnement', label: 'Environnement', description: 'Tri des déchets et zones prévues.' },
  ],
  priorityMessage: 'En doute, on stoppe et on alerte.',
  priorityDescription: 'La priorité reste la mise en sécurité des personnes, puis de la zone.',
});
