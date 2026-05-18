import type { ChangeHistoryEntry, ConditioningLine } from '../types/expiry';
import { addDays } from '../utils/date';

const now = new Date();
const daysAgo = (days: number, hours = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

const lineCBlockChangedAt = daysAgo(4, 4);

export const initialConditioningLines: ConditioningLine[] = [
  {
    id: 'line-a',
    name: 'Ligne de conditionnement A',
    vat: 'Cuve C-204',
    product: 'Formule Alpha',
    conditioningStartedAt: daysAgo(1, 3),
    elements: [
      {
        type: 'fillingBlock',
        label: 'Bloc de remplissage',
        lastChangedAt: daysAgo(1),
        expiresAt: addDays(daysAgo(1), 5),
        validityDays: 5,
        operator: 'A. Martin'
      }
    ]
  },
  {
    id: 'line-b',
    name: 'Ligne de conditionnement B',
    vat: 'Cuve M-117',
    product: 'Base Hydra',
    conditioningStartedAt: daysAgo(2, 6),
    elements: [
      {
        type: 'fillingBlock',
        label: 'Bloc de remplissage',
        lastChangedAt: daysAgo(6),
        expiresAt: addDays(daysAgo(6), 5),
        validityDays: 5,
        operator: 'N. Petit'
      }
    ]
  },
  {
    id: 'line-c',
    name: 'Ligne de conditionnement C',
    vat: 'Cuve T-008',
    product: 'Solution Test',
    conditioningStartedAt: daysAgo(0, 5),
    elements: [
      {
        type: 'fillingBlock',
        label: 'Bloc de remplissage',
        lastChangedAt: lineCBlockChangedAt,
        expiresAt: addDays(lineCBlockChangedAt, 5),
        validityDays: 5,
        operator: 'R. Moreau'
      }
    ]
  }
];

export const initialChangeHistory: ChangeHistoryEntry[] = [
  {
    id: 'hist-1',
    lineId: 'line-a',
    lineName: 'Ligne de conditionnement A',
    elementLabel: 'Bloc de remplissage',
    changedAt: daysAgo(1),
    operator: 'A. Martin',
    comment: 'Remplacement du bloc de remplissage avant démarrage de conditionnement.',
    newExpiresAt: addDays(daysAgo(1), 5)
  },
  {
    id: 'hist-3',
    lineId: 'line-a',
    lineName: 'Ligne de conditionnement A',
    elementLabel: 'Recharge de cuve - même matière',
    changedAt: daysAgo(0, 10),
    operator: 'M. Durand',
    comment: 'Recharge avec Cuve C-204. Matière inchangée : Formule Alpha.',
    newExpiresAt: addDays(daysAgo(1), 5)
  },
  {
    id: 'hist-2',
    lineId: 'line-c',
    lineName: 'Ligne de conditionnement C',
    elementLabel: 'Bloc de remplissage',
    changedAt: lineCBlockChangedAt,
    operator: 'R. Moreau',
    comment: '',
    newExpiresAt: addDays(lineCBlockChangedAt, 5)
  }
];
