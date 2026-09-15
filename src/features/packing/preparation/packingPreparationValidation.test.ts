import { describe, expect, it } from 'vitest';
import { validatePackingPreparation } from './packingPreparationValidation';

const validValues = {
  quantity: '30880',
  unitsPerCarton: '128',
  cartonsPerPalette: '40',
  productionStartTime: '2026-09-15T07:30',
  referenceCadence: '60',
};

describe('validatePackingPreparation', () => {
  it('reports required fields without inventing business constraints', () => {
    const result = validatePackingPreparation({
      quantity: '',
      unitsPerCarton: '',
      cartonsPerPalette: '',
      productionStartTime: '',
      referenceCadence: '',
    }, null);

    expect(result.canLaunch).toBe(false);
    expect(result.fields.quantity).toEqual({ state: 'empty', message: 'Valeur obligatoire.' });
    expect(result.launchGuidance).toContain('Quantité demandée');
    expect(result.launchGuidance).toContain('Cadence réf.');
  });

  it('rejects non-integer text instead of silently rewriting it', () => {
    const result = validatePackingPreparation({ ...validValues, quantity: '12.5' }, 'round-carton');
    expect(result.fields.quantity.state).toBe('invalid');
    expect(result.fields.quantity.message).toBe('Saisissez un entier supérieur à 0.');
    expect(result.canLaunch).toBe(false);
  });

  it('requires an explicit strategy after all fields are valid', () => {
    const result = validatePackingPreparation(validValues, null);
    expect(result.input).not.toBeNull();
    expect(result.canLaunch).toBe(false);
    expect(result.launchGuidance).toBe('Choisissez une stratégie de conditionnement pour lancer le suivi.');
  });

  it('allows launch only with valid fields and a strategy', () => {
    const result = validatePackingPreparation(validValues, 'round-carton');
    expect(result.canLaunch).toBe(true);
    expect(result.launchGuidance).toBeNull();
  });
});
