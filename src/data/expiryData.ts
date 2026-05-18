import type { ChangeHistoryEntry, ProductionLine } from '../types/expiry';
import { addDays } from '../utils/date';

const now = new Date();
const daysAgo = (days: number, hours = 0) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(date.getHours() - hours);
  return date.toISOString();
};

export const initialProductionLines: ProductionLine[] = [
  {
    id: 'line-a',
    name: 'Ligne A - Remplissage',
    vat: 'Cuve C-204',
    product: 'Formule Alpha',
    productionStartedAt: daysAgo(1, 3),
    materialChangePending: false,
    elements: [
      {
        type: 'hoses',
        label: 'Tuyaux produit',
        lastChangedAt: daysAgo(1),
        expiresAt: addDays(daysAgo(1), 5),
        validityDays: 5,
        operator: 'A. Martin'
      },
      {
        type: 'fillingHead',
        label: 'Tête de remplissage',
        lastChangedAt: daysAgo(4, 7),
        expiresAt: addDays(daysAgo(4, 7), 5),
        validityDays: 5,
        operator: 'L. Bernard'
      }
    ]
  },
  {
    id: 'line-b',
    name: 'Ligne B - Conditionnement',
    vat: 'Cuve M-117',
    product: 'Base Hydra',
    productionStartedAt: daysAgo(2, 6),
    materialChangePending: false,
    elements: [
      {
        type: 'hoses',
        label: 'Tuyaux produit',
        lastChangedAt: daysAgo(6),
        expiresAt: addDays(daysAgo(6), 5),
        validityDays: 5,
        operator: 'N. Petit'
      },
      {
        type: 'fillingHead',
        label: 'Tête de remplissage',
        lastChangedAt: daysAgo(2),
        expiresAt: addDays(daysAgo(2), 5),
        validityDays: 5,
        operator: 'S. Leroy'
      }
    ]
  },
  {
    id: 'line-c',
    name: 'Ligne C - Format test',
    vat: 'Cuve T-008',
    product: 'Solution Test',
    productionStartedAt: daysAgo(0, 5),
    materialChangePending: true,
    elements: [
      {
        type: 'hoses',
        label: 'Tuyaux produit',
        lastChangedAt: daysAgo(0, 8),
        expiresAt: addDays(daysAgo(0, 8), 5),
        validityDays: 5,
        operator: 'R. Moreau'
      },
      {
        type: 'fillingHead',
        label: 'Tête de remplissage',
        lastChangedAt: daysAgo(0, 8),
        expiresAt: addDays(daysAgo(0, 8), 5),
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
    lineName: 'Ligne A - Remplissage',
    elementLabel: 'Tuyaux produit',
    changedAt: daysAgo(1),
    operator: 'A. Martin',
    comment: 'Remplacement déclaré avant démarrage de série.',
    newExpiresAt: addDays(daysAgo(1), 5)
  },
  {
    id: 'hist-2',
    lineId: 'line-c',
    lineName: 'Ligne C - Format test',
    elementLabel: 'Tuyaux produit + tête',
    changedAt: daysAgo(0, 8),
    operator: 'R. Moreau',
    comment: 'Préparation format de test.',
    newExpiresAt: addDays(daysAgo(0, 8), 5)
  }
];
