function toValidDate(dateIso: string): Date | null {
  const date = new Date(dateIso);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function addDays(dateIso: string, days: number): string {
  const date = toValidDate(dateIso);
  if (!date || !Number.isFinite(days)) {
    throw new RangeError('Cannot add days to an invalid date.');
  }
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function formatDateTime(dateIso: string): string {
  const date = toValidDate(dateIso);
  if (!date) return 'Date invalide';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function formatDate(dateIso: string): string {
  const date = toValidDate(dateIso);
  if (!date) return 'Date invalide';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(date);
}

export function hoursUntil(dateIso: string, now = new Date()): number {
  const date = toValidDate(dateIso);
  const nowTime = now.getTime();
  if (!date || !Number.isFinite(nowTime)) return Number.NEGATIVE_INFINITY;
  return (date.getTime() - nowTime) / 36e5;
}

export function elapsedLabel(dateIso: string, now = new Date()): string {
  const date = toValidDate(dateIso);
  const nowTime = now.getTime();
  if (!date || !Number.isFinite(nowTime)) return 'date invalide';

  const minutes = Math.max(0, Math.floor((nowTime - date.getTime()) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}
