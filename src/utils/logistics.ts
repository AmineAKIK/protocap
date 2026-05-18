import type { LogisticsRequest, LogisticsStatus } from '../types/logistics';

export const logisticsStatusLabels: Record<LogisticsStatus, string> = {
  waiting: 'En attente',
  seen: 'Vu',
  inProgress: 'En cours',
  pickedUp: 'Récupéré',
  cancelled: 'Annulé'
};

export function nextLogisticsId(requests: LogisticsRequest[]): string {
  const next =
    requests.reduce((max, request) => {
      const value = Number(request.id.replace('LOG-', ''));
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 200) + 1;
  return `LOG-${next}`;
}
