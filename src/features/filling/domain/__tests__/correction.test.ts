import { describe, expect, it } from 'vitest'

import { recommendCorrection } from '../correction'
import type { SetupDecision } from '../models'
import { calibrationProfile, machineProfile } from './fixtures'

function correctDecision(meanError = '0.2'): SetupDecision {
  return {
    status: 'correct',
    reasons: [
      {
        code: 'mean_below_target_interval',
        message: 'Augmenter.',
      },
    ],
    evaluatedCount: 3,
    requiredCount: 3,
    target: '5.26823',
    lowerLimit: '5.21823',
    upperLimit: '5.31823',
    meanError,
    unitsOutsideIndividualLimits: 0,
  }
}

const mechanicalMachine = machineProfile({
  setpointType: 'mechanical',
  unit: 'graduation',
  resolution: '0.1',
  minimum: '0',
  maximum: '50',
  increaseDirection: 'clockwise',
})

describe('recommendCorrection', () => {
  it('exprime le sens et l’écart en g et mL', () => {
    const result = recommendCorrection({
      decision: correctDecision(),
      targetNetMassG: '5.26823',
      measuredMeanNetMassG: '5.06823',
      densityGPerMl: '1.019',
      maxCorrectionG: '0.5',
    })
    expect(result.direction).toBe('increase_fill')
    expect(result.fullErrorG).toBe('0.2')
    expect(result.recommendedChangeG).toBe('0.2')
    expect(result.capped).toBe(false)
    expect(result.mechanicalEstimate).toBeUndefined()
  })

  it('plafonne une correction sans masquer l’écart complet', () => {
    const result = recommendCorrection({
      decision: correctDecision(),
      targetNetMassG: '5.26823',
      measuredMeanNetMassG: '4',
      densityGPerMl: '1.019',
      maxCorrectionG: '0.5',
    })
    expect(result).toMatchObject({
      direction: 'increase_fill',
      fullErrorG: '1.26823',
      recommendedChangeG: '0.5',
      capped: true,
    })
  })

  it('conserve le signe négatif pour une diminution', () => {
    const result = recommendCorrection({
      decision: correctDecision('-0.2'),
      targetNetMassG: '5.26823',
      measuredMeanNetMassG: '5.46823',
      densityGPerMl: '1.019',
      maxCorrectionG: '0.5',
    })
    expect(result.direction).toBe('decrease_fill')
    expect(result.recommendedChangeG).toBe('-0.2')
  })

  it('calcule une graduation seulement avec une calibration vérifiée et dans son domaine', () => {
    const result = recommendCorrection({
      decision: correctDecision(),
      targetNetMassG: '5.26823',
      measuredMeanNetMassG: '5.06823',
      densityGPerMl: '1.019',
      maxCorrectionG: '0.5',
      machine: mechanicalMachine,
      calibration: calibrationProfile(),
      currentSetting: '25',
    })
    expect(result.mechanicalEstimate).toMatchObject({
      currentSetting: '25',
      deltaSetting: '1',
      proposedSetting: '26',
      quantizedSetting: '26',
      withinCalibrationDomain: true,
    })
  })

  it('retire silencieusement toute position hors domaine, mais garde la direction sûre', () => {
    const result = recommendCorrection({
      decision: correctDecision(),
      targetNetMassG: '5.26823',
      measuredMeanNetMassG: '4.76823',
      densityGPerMl: '1.019',
      maxCorrectionG: '0.5',
      machine: mechanicalMachine,
      calibration: calibrationProfile(),
      currentSetting: '29',
    })
    expect(result.direction).toBe('increase_fill')
    expect(result.mechanicalEstimate).toBeUndefined()
    expect(result.explanation).toContain('Aucune position mécanique exacte')
  })

  it('ne propose pas une position dans un sens d’approche non validé', () => {
    const result = recommendCorrection({
      decision: correctDecision('-0.2'),
      targetNetMassG: '5.26823',
      measuredMeanNetMassG: '5.46823',
      densityGPerMl: '1.019',
      maxCorrectionG: '0.5',
      machine: mechanicalMachine,
      calibration: calibrationProfile({ approachDirection: 'increasing' }),
      currentSetting: '25',
    })
    expect(result.direction).toBe('decrease_fill')
    expect(result.mechanicalEstimate).toBeUndefined()
  })

  it('refuse de corriger une décision atteinte ou à investiguer', () => {
    expect(() =>
      recommendCorrection({
        decision: { ...correctDecision(), status: 'achieved' },
        targetNetMassG: '5.26823',
        measuredMeanNetMassG: '5.26823',
        densityGPerMl: '1.019',
        maxCorrectionG: '0.5',
      }),
    ).toThrow(/ne peut être calculée/)
  })
})
