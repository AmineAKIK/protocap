import type { LogisticsRequest } from '../types/logistics';

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60000).toISOString();

export const initialLogisticsRequests: LogisticsRequest[] = [
  {
    id: 'LOG-201',
    line: 'Ligne de conditionnement A',
    zone: 'Bout de ligne',
    palletCount: 2,
    priority: 'normal',
    nature: 'Palette pleine à évacuer',
    comment: 'Zone tampon presque pleine.',
    createdAt: minutesAgo(28),
    status: 'waiting'
  },
  {
    id: 'LOG-202',
    line: 'Ligne de conditionnement B',
    zone: 'Sortie conditionnement',
    palletCount: 1,
    priority: 'high',
    nature: 'Palette pleine à évacuer',
    comment: 'Besoin de libérer le passage.',
    createdAt: minutesAgo(52),
    status: 'inProgress'
  },
  {
    id: 'LOG-203',
    line: 'Ligne de conditionnement C',
    zone: 'Zone palette',
    palletCount: 3,
    priority: 'normal',
    nature: 'Palettes vides à fournir',
    comment: '',
    createdAt: minutesAgo(94),
    completedAt: minutesAgo(18),
    status: 'pickedUp'
  }
];
