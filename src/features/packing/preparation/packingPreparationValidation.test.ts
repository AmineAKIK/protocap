import { describe, expect, it } from 'vitest';
import { parsePackingProductionStart, validatePackingPreparation } from './packingPreparationValidation';

const validValues = {
  quantity: '30880',
  unitsPerCarton: '128',
  cartonsPerPalette: '40',
  productionStartTime: '2026-09-15T07:30',
  referenceCadence: '60',
};
const afterProductionStart = new Date('2026-09-15T12:00:00');

function europeParis2026Offset(epochMs: number): number {
  const summerStarts = Date.parse('2026-03-29T01:00:00.000Z');
  const summerEnds = Date.parse('2026-10-25T01:00:00.000Z');
  return epochMs >= summerStarts && epochMs < summerEnds ? -120 : -60;
}

describe('validatePackingPreparation', () => {
  it('reports required fields without inventing business constraints', () => {
    const result = validatePackingPreparation({
      quantity: '',
      unitsPerCarton: '',
      cartonsPerPalette: '',
      productionStartTime: '',
      referenceCadence: '',
    }, null, afterProductionStart);

    expect(result.canLaunch).toBe(false);
    expect(result.fields.quantity).toEqual({ state: 'empty', message: 'Valeur obligatoire.' });
    expect(result.launchGuidance).toContain('Quantité demandée');
    expect(result.launchGuidance).toContain('Cadence réf.');
  });

  it('rejects non-integer text instead of silently rewriting it', () => {
    const result = validatePackingPreparation({ ...validValues, quantity: '12.5' }, 'round-carton', afterProductionStart);
    expect(result.fields.quantity.state).toBe('invalid');
    expect(result.fields.quantity.message).toBe('Saisissez un entier supérieur à 0.');
    expect(result.canLaunch).toBe(false);
  });

  it('requires an explicit strategy after all fields are valid', () => {
    const result = validatePackingPreparation(validValues, null, afterProductionStart);
    expect(result.input).not.toBeNull();
    expect(result.canLaunch).toBe(false);
    expect(result.launchGuidance).toBe('Choisissez une stratégie de conditionnement pour lancer le suivi.');
  });

  it('allows launch only with valid fields and a strategy', () => {
    const result = validatePackingPreparation(validValues, 'round-carton', afterProductionStart);
    expect(result.canLaunch).toBe(true);
    expect(result.launchGuidance).toBeNull();
  });

  it('rejects a production start in the future', () => {
    const result = validatePackingPreparation(
      { ...validValues, productionStartTime: '2026-09-15T12:01' },
      'round-carton',
      new Date('2026-09-15T12:00:30'),
    );

    expect(result.fields.productionStartTime).toEqual({
      state: 'invalid',
      message: 'Le début OC ne peut pas être dans le futur.',
    });
    expect(result.canLaunch).toBe(false);
    expect(result.launchGuidance).toContain('Début OC');
  });
});

describe('parsePackingProductionStart DST semantics', () => {
  it('rejects the repeated Europe/Paris wall-clock hour during the autumn DST fold', () => {
    expect(parsePackingProductionStart('2026-10-25T02:30', europeParis2026Offset)).toBeNull();
  });

  it('rejects the nonexistent Europe/Paris wall-clock hour during the spring DST gap', () => {
    expect(parsePackingProductionStart('2026-03-29T02:30', europeParis2026Offset)).toBeNull();
  });

  it('resolves an unambiguous Europe/Paris wall-clock time to the exact instant', () => {
    expect(parsePackingProductionStart('2026-10-25T03:30', europeParis2026Offset)?.toISOString())
      .toBe('2026-10-25T02:30:00.000Z');
  });
});
