import {
  PackingRunDomainError,
  type PackingDeclarationInput,
} from '../domain/packingRun';

export interface DeclarationDraft {
  completeCartons: string;
  partialCartonUnits: string;
}

export const emptyDeclarationDraft: DeclarationDraft = {
  completeCartons: '',
  partialCartonUnits: '',
};

const numberFormatter = new Intl.NumberFormat('fr-FR');
const percentFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatPackingNumber(value: number): string {
  return numberFormatter.format(value);
}

export function formatPackingPercent(value: number): string {
  return percentFormatter.format(value);
}

export function parseNonNegativeSafeInteger(value: string): number | null {
  if (value.trim() === '') return 0;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function getDeclarationDraftInput(draft: DeclarationDraft): PackingDeclarationInput | null {
  const completeCartons = parseNonNegativeSafeInteger(draft.completeCartons);
  const partialCartonUnits = parseNonNegativeSafeInteger(draft.partialCartonUnits);
  if (completeCartons === null || partialCartonUnits === null) return null;
  return { completeCartons, partialCartonUnits };
}

export function getPackingDeclarationErrorMessage(error: unknown): string {
  if (error instanceof PackingRunDomainError) {
    if (error.code === 'OVER_DECLARATION') {
      return 'Cette déclaration dépasse le volume restant du run actif.';
    }
    if (error.code === 'ZERO_DECLARATION') {
      return 'Saisissez au moins un carton complet ou une unité dans le carton incomplet.';
    }
    return error.message;
  }
  return 'La déclaration n’a pas pu être enregistrée.';
}

export function createPackingDeclarationIdentity(): { id: string; createdAt: string } {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('Secure declaration identity generation is unavailable.');
  }
  return { id: globalThis.crypto.randomUUID(), createdAt: new Date().toISOString() };
}

export function formatPackingClock(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPackingDurationMinutes(minutes: number): string {
  const rounded = Math.round(Math.abs(minutes));
  if (rounded < 60) return `${rounded} min`;

  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  return remainingMinutes === 0 ? `${hours} h` : `${hours} h ${remainingMinutes} min`;
}

export function formatPackingReferenceVariance(
  minutes: number,
): { label: string; tone: 'ahead' | 'late' | 'neutral' } {
  const rounded = Math.round(Math.abs(minutes));
  if (rounded < 1) return { label: 'À l’heure', tone: 'neutral' };

  const duration = formatPackingDurationMinutes(minutes);
  return minutes > 0
    ? { label: `${duration} d’avance`, tone: 'ahead' }
    : { label: `${duration} de retard`, tone: 'late' };
}
