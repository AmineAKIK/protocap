import { describe, expect, it } from 'vitest';
import { formatPackingReferenceVariance } from './packingRunExecutionModel';

describe('formatPackingReferenceVariance', () => {
  it('keeps sub-hour gaps in minutes', () => {
    expect(formatPackingReferenceVariance(-59)).toEqual({ label: '59 min de retard', tone: 'late' });
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
