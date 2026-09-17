import type { ConditioningLine, ContactElement, ElementStatus, LineStatus } from '../types/expiry';
import { addCalendarDays, CALENDAR_DAYS_RULE, instantMilliseconds, isNamedTimeZone } from '../features/expiry/time';

export function getElementStatus(element: ContactElement | undefined, now = new Date()): ElementStatus {
  if (!element || element.type !== 'fillingBlock' || typeof element.label !== 'string' || !element.label.trim()
    || typeof element.operator !== 'string' || !element.operator.trim()
    || !Number.isSafeInteger(element.validityDays) || element.validityDays <= 0 || !Number.isFinite(now.getTime())) return 'unknown';
  const start = instantMilliseconds(element.lastChangedAt);
  const end = instantMilliseconds(element.expiresAt);
  if (start === null || end === null || start > now.getTime() || end <= start) return 'unknown';
  if (element.timeZone !== undefined || element.validityRule !== undefined) {
    if (!isNamedTimeZone(element.timeZone) || element.validityRule !== CALENDAR_DAYS_RULE) return 'unknown';
    try {
      if (instantMilliseconds(addCalendarDays(element.lastChangedAt, element.validityDays, element.timeZone)) !== end) return 'unknown';
    } catch { return 'unknown'; }
  }
  const remaining = (end - now.getTime()) / 36e5;
  if (remaining <= 0) return 'expired';
  if (remaining <= 48) return 'warning';
  return 'ok';
}

export function getBlockStatus(line: ConditioningLine | undefined, now = new Date()): ElementStatus {
  // The current model has one filling block. Missing/duplicated elements are not evidence of validity.
  if (!line || !Array.isArray(line.elements) || line.elements.length !== 1) return 'unknown';
  return getElementStatus(line.elements[0], now);
}

export function getLineStatus(line: ConditioningLine | undefined, now = new Date()): LineStatus {
  if (!line || typeof line.id !== 'string' || !line.id.trim() || typeof line.name !== 'string' || !line.name.trim()
    || typeof line.vat !== 'string' || !line.vat.trim() || typeof line.product !== 'string' || !line.product.trim()) return 'unknown';
  const statuses: Record<ElementStatus, LineStatus> = { ok: 'conform', warning: 'watch', expired: 'nonConform', unknown: 'unknown' };
  return statuses[getBlockStatus(line, now)];
}

export function earliestExpiry(line: ConditioningLine): string {
  return line.elements.length === 1 ? line.elements[0].expiresAt : '';
}

export function latestChange(line: ConditioningLine): string {
  return line.elements.length === 1 ? line.elements[0].lastChangedAt : '';
}

export function remainingValidityPercent(line: ConditioningLine, now = new Date()): number | null {
  if (getLineStatus(line, now) === 'unknown') return null;
  const start = instantMilliseconds(latestChange(line))!;
  const end = instantMilliseconds(earliestExpiry(line))!;
  return Math.min(100, Math.max(0, ((end - now.getTime()) / (end - start)) * 100));
}

export function statusLabel(status: ElementStatus | LineStatus): string {
  const labels: Record<ElementStatus | LineStatus, string> = {
    ok: 'OK', warning: 'Bientôt expiré', expired: 'Expiré',
    conform: 'Conforme', watch: 'Vigilance', nonConform: 'Non conforme', unknown: 'État à vérifier',
  };
  return labels[status];
}
