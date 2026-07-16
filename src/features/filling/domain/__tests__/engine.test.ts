import { describe, expect, it } from 'vitest'

import { evaluateFillingSample } from '../engine'
import type { ProfileSnapshots } from '../models'
import {
  controlPlanProfile,
  instrumentProfile,
  machineProfile,
  packagingProfile,
  productProfile,
} from './fixtures'

function profiles(overrides: Partial<ProfileSnapshots> = {}): ProfileSnapshots {
  return {
    machine: machineProfile(),
    product: productProfile(),
    packaging: packagingProfile(),
    controlPlan: controlPlanProfile(),
    instrument: instrumentProfile(),
    ...overrides,
  }
}

const context = {
  machineId: 'machine-1',
  productId: 'product-1',
  packagingId: 'packaging-1',
  controlPlanId: 'control-1',
  instrumentId: 'instrument-1',
}

describe('evaluateFillingSample', () => {
  it('enchaîne tare, statistiques, décision et correction sans arrondi intermédiaire', () => {
    const basePlan = controlPlanProfile()
    const result = evaluateFillingSample({
      mode: 'real',
      context,
      profiles: profiles({
        controlPlan: controlPlanProfile({
          startCriterion: {
            ...basePlan.startCriterion,
            individualLowerDeviation: '1',
            individualUpperDeviation: '1',
          },
        }),
      }),
      measurements: [
        { id: 'm1', mode: 'fixed', grossMassG: '10' },
        { id: 'm2', mode: 'fixed', grossMassG: '10' },
        { id: 'm3', mode: 'fixed', grossMassG: '10' },
      ],
      now: new Date('2026-07-16T12:00:00.000Z'),
    })

    expect(result.contextValidation.valid).toBe(true)
    expect(result.targets.netMassG).toBe('5.26823')
    expect(result.statistics.mean).toBe('5')
    expect(result.decision.status).toBe('correct')
    expect(result.recommendation).toMatchObject({
      direction: 'increase_fill',
      fullErrorG: '0.26823',
      recommendedChangeG: '0.26823',
    })
  })

  it('transforme un contexte non sûr en STOP prioritaire', () => {
    const result = evaluateFillingSample({
      mode: 'real',
      context,
      profiles: profiles({
        instrument: instrumentProfile({ verificationStatus: 'expired' }),
      }),
      measurements: [
        { id: 'm1', mode: 'fixed', grossMassG: '10' },
        { id: 'm2', mode: 'fixed', grossMassG: '10' },
        { id: 'm3', mode: 'fixed', grossMassG: '10' },
      ],
      now: new Date('2026-07-16T12:00:00.000Z'),
    })

    expect(result.decision.status).toBe('stop')
    expect(result.recommendation).toBeUndefined()
    expect(result.decision.reasons).toContainEqual(
      expect.objectContaining({ code: 'instrument_not_valid' }),
    )
  })
})
