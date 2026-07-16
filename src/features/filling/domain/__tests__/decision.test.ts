import { describe, expect, it } from 'vitest'

import { evaluateStartCriterion } from '../decision'
import type { DecisionReason } from '../models'
import { calculateStatistics } from '../statistics'
import { controlPlanProfile } from './fixtures'

const TARGET = '5.26823'

function evaluate(
  values: string[],
  options: {
    stopReasons?: DecisionReason[]
    oscillationDetected?: boolean
    plan?: ReturnType<typeof controlPlanProfile>
  } = {},
) {
  const plan = options.plan ?? controlPlanProfile()
  return evaluateStartCriterion({
    target: TARGET,
    statistics: calculateStatistics(values, { basis: plan.startCriterion.basis }),
    includedValues: values,
    controlPlan: plan,
    signals: {
      stopReasons: options.stopReasons,
      oscillationDetected: options.oscillationDetected,
    },
  })
}

describe('priorité des décisions', () => {
  it('bloque STOP avant toutes les autres branches', () => {
    const decision = evaluate(['4', '5.26823', '6.5'], {
      stopReasons: [
        {
          code: 'instrument_not_valid',
          message: 'Balance non valide.',
        },
      ],
      oscillationDetected: true,
    })
    expect(decision.status).toBe('stop')
    expect(decision.reasons.map((reason) => reason.code)).toEqual(['instrument_not_valid'])
  })

  it('ne produit aucune décision de réglage avant N/N', () => {
    const decision = evaluate(['5.1', '5.2'])
    expect(decision.status).toBe('collect_more')
    expect(decision.reasons[0].code).toBe('sample_incomplete')
  })

  it('investigue la dispersion avant de corriger la moyenne', () => {
    const decision = evaluate(['5', '5.27', '5.54'])
    expect(decision.status).toBe('investigate')
    expect(decision.reasons.map((reason) => reason.code)).toEqual(
      expect.arrayContaining(['dispersion_too_high', 'range_too_high']),
    )
  })

  it('investigue une oscillation même avec un échantillon stable', () => {
    expect(evaluate(['5.1', '5.1', '5.1'], { oscillationDetected: true }).status).toBe(
      'investigate',
    )
  })

  it('propose le bon sens de correction pour une moyenne stable hors intervalle', () => {
    const plan = controlPlanProfile({
      startCriterion: {
        ...controlPlanProfile().startCriterion,
        individualLowerDeviation: '2',
        individualUpperDeviation: '2',
      },
    })
    const low = evaluate(['5', '5', '5'], { plan })
    const high = evaluate(['5.5', '5.5', '5.5'], { plan })
    expect(low.status).toBe('correct')
    expect(low.reasons[0].code).toBe('mean_below_target_interval')
    expect(high.status).toBe('correct')
    expect(high.reasons[0].code).toBe('mean_above_target_interval')
  })

  it('n’invente pas une correction dans la zone morte', () => {
    const plan = controlPlanProfile({
      startCriterion: {
        basis: 'net_mass_g',
        meanLowerDeviation: '0.005',
        meanUpperDeviation: '0.005',
        correctionDeadband: '0.02',
        maxStandardDeviation: '0.1',
      },
    })
    const decision = evaluate(['5.25823', '5.25823', '5.25823'], { plan })
    expect(decision.status).toBe('investigate')
    expect(decision.reasons[0].code).toBe('outside_criterion_within_deadband')
  })

  it('déclare uniquement le critère de démarrage atteint aux bornes inclusives', () => {
    const lower = evaluate(['5.21823', '5.21823', '5.21823'])
    const upper = evaluate(['5.31823', '5.31823', '5.31823'])
    expect(lower.status).toBe('achieved')
    expect(upper.status).toBe('achieved')
    expect(lower.reasons[0].message).toContain('Critère de démarrage atteint')
    expect(lower.reasons[0].message.toLowerCase()).not.toContain('conforme')
  })
})

