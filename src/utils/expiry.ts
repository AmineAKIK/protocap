import type { ContactElement, ElementStatus, LineStatus, ProductionLine } from '../types/expiry';
import { hoursUntil } from './date';

export function getElementStatus(element: ContactElement, now = new Date()): ElementStatus {
  const remaining = hoursUntil(element.expiresAt, now);
  if (remaining <= 0) return 'expired';
  if (remaining <= 48) return 'warning';
  return 'ok';
}

export function getLineStatus(line: ProductionLine, now = new Date()): LineStatus {
  if (line.materialChangePending) return 'actionRequired';
  const statuses = line.elements.map((element) => getElementStatus(element, now));
  if (statuses.includes('expired')) return 'nonConform';
  if (statuses.includes('warning')) return 'watch';
  return 'conform';
}

export function statusLabel(status: ElementStatus | LineStatus): string {
  const labels: Record<ElementStatus | LineStatus, string> = {
    ok: 'OK',
    warning: 'Bientôt expiré',
    expired: 'Expiré',
    conform: 'Conforme',
    watch: 'Vigilance',
    nonConform: 'Non conforme',
    actionRequired: 'Action requise'
  };
  return labels[status];
}
