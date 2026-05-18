import type { LogisticsRequest } from '../types/logistics';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

export const initialLogisticsRequests: LogisticsRequest[] = [
  {
    id: 'LOG-201',
    line: 'Ligne A',
    zone: 'Sortie remplissage',
    palletCount: 2,
    priority: 'normal',
    nature: 'Palette pleine à évacuer',
    comment: 'Zone tampon presque pleine.',
    createdAt: minutesAgo(28),
    status: 'waiting'
  },
  {
    id: 'LOG-202',
    line: 'Ligne B',
    zone: 'Fin de conditionnement',
    palletCount: 1,
    priority: 'high',
    nature: 'Palette pleine à évacuer',
    comment: 'Besoin de libérer le passage.',
    createdAt: minutesAgo(52),
    status: 'inProgress'
  },
  {
    id: 'LOG-203',
    line: 'Ligne C',
    zone: 'Poste test',
    palletCount: 3,
    priority: 'normal',
    nature: 'Palettes vides à fournir',
    createdAt: minutesAgo(94),
    status: 'pickedUp'
  }
];
