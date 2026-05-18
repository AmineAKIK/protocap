export function addDays(dateIso: string, days: number): string {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function formatDateTime(dateIso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(dateIso));
}

export function formatDate(dateIso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(dateIso));
}

export function hoursUntil(dateIso: string, now = new Date()): number {
  return (new Date(dateIso).getTime() - now.getTime()) / 36e5;
}

export function elapsedLabel(dateIso: string, now = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(dateIso).getTime()) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}
