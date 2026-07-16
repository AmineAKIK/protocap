import { describe, expect, it } from 'vitest'

import { calculateSampleStatistics, calculateStatistics } from '../statistics'
import { normalizeMeasurement, normalizeMeasurements } from '../tare'
import { packagingProfile } from './fixtures'

describe('normalisation des trois modes de tare', () => {
  it('soustrait la tare moyenne uniquement en mode fixe', () => {
    const result = normalizeMeasurement(
      { id: 'm1', mode: 'fixed', grossMassG: '10.26823' },
      packagingProfile(),
    )
    expect(result).toMatchObject({
      grossMassG: '10.26823',
      tareMassG: '5',
      netMassG: '5.26823',
    })
  })

  it('apparie chaque brut avec la tare du même tube', () => {
    const packaging = packagingProfile({ tareMode: 'paired', fixedTare: undefined })
    const results = normalizeMeasurements(
      [
        { id: 'm1', mode: 'paired', grossMassG: '10.30', tareMassG: '5.02' },
        { id: 'm2', mode: 'paired', grossMassG: '10.25', tareMassG: '4.97' },
      ],
      packaging,
    )
    expect(results.map((measurement) => measurement.netMassG)).toEqual(['5.28', '5.28'])
  })

  it('utilise l’emballage nettoyé pour une tare destructive', () => {
    const result = normalizeMeasurement(
      {
        id: 'm1',
        mode: 'destructive',
        grossBeforeEmptyingG: '10.31',
        cleanedPackagingMassG: '5.04',
      },
      packagingProfile({ tareMode: 'destructive', fixedTare: undefined }),
    )
    expect(result.netMassG).toBe('5.27')
  })

  it('bloque les modes incohérents et les exclusions sans motif', () => {
    expect(() =>
      normalizeMeasurement(
        { id: 'm1', mode: 'paired', grossMassG: '10', tareMassG: '5' },
        packagingProfile(),
      ),
    ).toThrow(/ne correspond pas/)

    expect(() =>
      normalizeMeasurement(
        { id: 'm1', mode: 'fixed', grossMassG: '10', excluded: true },
        packagingProfile(),
      ),
    ).toThrow(/motif/)
  })
})

describe('statistiques non arrondies', () => {
  it('calcule moyenne, étendue et écart-type échantillon', () => {
    expect(calculateStatistics(['1', '2', '3'])).toEqual({
      basis: 'net_mass_g',
      count: 3,
      excludedCount: 0,
      mean: '2',
      minimum: '1',
      maximum: '3',
      range: '2',
      standardDeviation: '1',
      standardDeviationMethod: 'sample',
    })
  })

  it('écarte seulement une mesure explicitement motivée et la compte', () => {
    const measurements = normalizeMeasurements(
      [
        { id: 'm1', mode: 'fixed', grossMassG: '10' },
        { id: 'm2', mode: 'fixed', grossMassG: '11' },
        {
          id: 'm3',
          mode: 'fixed',
          grossMassG: '30',
          excluded: true,
          exclusionReason: 'Tube tombé',
        },
      ],
      packagingProfile(),
    )
    const stats = calculateSampleStatistics({ measurements, basis: 'net_mass_g' })
    expect(stats).toMatchObject({ count: 2, excludedCount: 1, mean: '5.5' })
  })
})

