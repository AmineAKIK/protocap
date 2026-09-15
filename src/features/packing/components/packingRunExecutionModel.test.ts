import { describe, expect, it } from 'vitest';
import {
  formatPackingReferenceVariance,
  getPackingRemainingWork,
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
