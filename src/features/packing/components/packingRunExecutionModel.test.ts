import { describe, expect, it } from 'vitest';
import {
  formatPackingReferenceVariance,
  getPackingRemainingWork,
  normalizePackingDraft,
} from './packingRunExecutionModel';

describe('formatPackingReferenceVariance', () => {
  it('keeps sub-hour gaps in minutes', () => {
    expect(formatPackingReferenceVariance(-59)).toEqual({ label: '59 min de retard', tone: 'late' });
    expect(formatPackingReferenceVariance(-59.5)).toEqual({ label: '60 min de retard', tone: 'late' });
    expect(formatPackingReferenceVariance(12)).toEqual({ label: '12 min d’avance', tone: 'ahead' });
  });

  it('formats hour-sized gaps as hours and minutes', () => {
    expect(formatPackingReferenceVariance(-60)).toEqual({ label: '1 h de retard', tone: 'late' });
    expect(formatPackingReferenceVariance(-1347)).toEqual({ label: '22 h 27 min de retard', tone: 'late' });
    expect(formatPackingReferenceVariance(125)).toEqual({ label: '2 h 5 min d’avance', tone: 'ahead' });
  });

  it('keeps near-zero gaps neutral', () => {
    expect(formatPackingReferenceVariance(0.4)).toEqual({ label: 'À l’heure', tone: 'neutral' });
  });
});

describe('getPackingRemainingWork', () => {
  it('translates remaining units into physical packing work', () => {
    expect(getPackingRemainingWork(4059, 99, 40)).toEqual({
      summary: '1 palette complète + 1 carton',
      afterNextFullLoad: 'Après cette palette complète : 1 carton',
    });
  });

  it('keeps loose units explicit when the final carton is incomplete', () => {
    expect(getPackingRemainingWork(4120, 99, 40)).toEqual({
      summary: '1 palette complète + 1 carton + 61 unités vrac',
      afterNextFullLoad: 'Après cette palette complète : 1 carton + 61 unités vrac',
    });
  });

  it('announces completion when the next full load finishes the run', () => {
    expect(getPackingRemainingWork(3960, 99, 40)).toEqual({
      summary: '1 palette complète',
      afterNextFullLoad: 'Après cette palette complète : conditionnement terminé',
    });
  });

  it('does not invent a next full load when less than one remains', () => {
    expect(getPackingRemainingWork(198, 99, 40)).toEqual({
      summary: '2 cartons',
      afterNextFullLoad: null,
    });
  });
});


describe('normalizePackingDraft', () => {
  it('promotes loose units into cartons and cartons into complete palettes', () => {
    expect(normalizePackingDraft(
      { completeCartons: '0', partialCartonUnits: '2000' },
      50,
      40,
    )).toEqual({
      completeLoads: 1,
      completeCartons: 0,
      partialCartonUnits: 0,
      totalUnits: 2000,
    });
  });

  it('normalizes a mixed working declaration through both thresholds', () => {
    expect(normalizePackingDraft(
      { completeCartons: '45', partialCartonUnits: '300' },
      50,
      40,
    )).toEqual({
      completeLoads: 1,
      completeCartons: 11,
      partialCartonUnits: 0,
      totalUnits: 2550,
    });
  });

  it('preserves the final incomplete carton after cascading conversion', () => {
    expect(normalizePackingDraft(
      { completeCartons: '39', partialCartonUnits: '75' },
      50,
      40,
    )).toEqual({
      completeLoads: 1,
      completeCartons: 0,
      partialCartonUnits: 25,
      totalUnits: 2025,
    });
  });

  it('rejects unsafe draft arithmetic', () => {
    expect(normalizePackingDraft(
      { completeCartons: String(Number.MAX_SAFE_INTEGER), partialCartonUnits: '0' },
      50,
      40,
    )).toBeNull();
  });
});
