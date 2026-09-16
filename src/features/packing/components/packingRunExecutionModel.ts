import {
  PackingRunDomainError,
  type PackingDeclarationInput,
} from '../domain/packingRun';

export interface DeclarationDraft {
  completeCartons: string;
  partialCartonUnits: string;
}

export interface PackingRemainingWork {
  summary: string;
  afterNextFullLoad: string | null;
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

export interface PackingDraftNormalization {
  completeLoads: number;
  completeCartons: number;
  partialCartonUnits: number;
  totalUnits: number;
}

export function normalizePackingDraft(
  draft: DeclarationDraft,
  unitsPerCarton: number,
  cartonsPerLoad: number,
): PackingDraftNormalization | null {
  const input = getDeclarationDraftInput(draft);
  if (
    !input ||
    !Number.isSafeInteger(unitsPerCarton) ||
    unitsPerCarton <= 0 ||
    !Number.isSafeInteger(cartonsPerLoad) ||
    cartonsPerLoad <= 0
  ) {
    return null;
  }

  const unitsFromCartons = input.completeCartons * unitsPerCarton;
  const totalUnits = unitsFromCartons + input.partialCartonUnits;
  const unitsPerLoad = unitsPerCarton * cartonsPerLoad;
  if (
    !Number.isSafeInteger(unitsFromCartons) ||
    !Number.isSafeInteger(totalUnits) ||
    !Number.isSafeInteger(unitsPerLoad)
  ) {
    return null;
  }

  const completeLoads = Math.floor(totalUnits / unitsPerLoad);
  const unitsAfterLoads = totalUnits % unitsPerLoad;
  const completeCartons = Math.floor(unitsAfterLoads / unitsPerCarton);
  const partialCartonUnits = unitsAfterLoads % unitsPerCarton;

  return { completeLoads, completeCartons, partialCartonUnits, totalUnits };
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
  const absoluteMinutes = Math.abs(minutes);
  const rounded = Math.round(absoluteMinutes);
  if (absoluteMinutes < 60) return `${rounded} min`;

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

function formatRemainingComposition(
  units: number,
  unitsPerCarton: number,
  cartonsPerLoad: number,
): string {
  if (units <= 0) return 'Conditionnement terminé';

  const fullLoadUnits = unitsPerCarton * cartonsPerLoad;
  const fullLoads = Math.floor(units / fullLoadUnits);
  const remainderAfterLoads = units % fullLoadUnits;
  const fullCartons = Math.floor(remainderAfterLoads / unitsPerCarton);
  const looseUnits = remainderAfterLoads % unitsPerCarton;
  const parts: string[] = [];

  if (fullLoads > 0) {
    parts.push(`${formatPackingNumber(fullLoads)} palette${fullLoads > 1 ? 's' : ''} complète${fullLoads > 1 ? 's' : ''}`);
  }
  if (fullCartons > 0) {
    parts.push(`${formatPackingNumber(fullCartons)} carton${fullCartons > 1 ? 's' : ''}`);
  }
  if (looseUnits > 0) {
    parts.push(`${formatPackingNumber(looseUnits)} unité${looseUnits > 1 ? 's' : ''} vrac`);
  }

  return parts.join(' + ');
}

export function getPackingRemainingWork(
  remainingUnits: number,
  unitsPerCarton: number,
  cartonsPerLoad: number,
): PackingRemainingWork {
  const fullLoadUnits = unitsPerCarton * cartonsPerLoad;
  const summary = formatRemainingComposition(remainingUnits, unitsPerCarton, cartonsPerLoad);

  if (remainingUnits < fullLoadUnits) {
    return { summary, afterNextFullLoad: null };
  }

  const afterNext = remainingUnits - fullLoadUnits;
  return {
    summary,
    afterNextFullLoad: afterNext === 0
      ? 'Après cette palette complète : conditionnement terminé'
      : `Après cette palette complète : ${formatRemainingComposition(afterNext, unitsPerCarton, cartonsPerLoad)}`,
  };
}
