import {
  decimal,
  DomainError,
  requireNonNegativeDecimal,
  toDecimalString,
} from './decimal'
import type {
  ControlPlanProfile,
  DecisionReason,
  DecisionSignals,
  SampleStatistics,
  SetupDecision,
  StartCriterion,
} from './models'

export interface EvaluateStartCriterionInput {
  target: string
  statistics: SampleStatistics
  /** Included, non-rounded values in the same basis as the criterion. */
  includedValues: string[]
  controlPlan: ControlPlanProfile
  signals?: DecisionSignals
}

function individualOutsideCount(
  values: string[],
  target: string,
  criterion: StartCriterion,
): number {
  if (
    criterion.individualLowerDeviation === undefined &&
    criterion.individualUpperDeviation === undefined
  ) {
    return 0
  }

  const targetValue = decimal(target)
  const lower =
    criterion.individualLowerDeviation === undefined
      ? undefined
      : targetValue.minus(requireNonNegativeDecimal(criterion.individualLowerDeviation))
  const upper =
    criterion.individualUpperDeviation === undefined
      ? undefined
      : targetValue.plus(requireNonNegativeDecimal(criterion.individualUpperDeviation))

  return values.reduce((count, rawValue) => {
    const value = decimal(rawValue)
    return count + (lower !== undefined && value.lt(lower) ? 1 : upper !== undefined && value.gt(upper) ? 1 : 0)
  }, 0)
}

function baseDecision(
  input: EvaluateStartCriterionInput,
  status: SetupDecision['status'],
  reasons: DecisionReason[],
  unitsOutsideIndividualLimits: number,
): SetupDecision {
  const target = decimal(input.target)
  const criterion = input.controlPlan.startCriterion
  const lowerLimit = target.minus(requireNonNegativeDecimal(criterion.meanLowerDeviation))
  const upperLimit = target.plus(requireNonNegativeDecimal(criterion.meanUpperDeviation))
  const mean = decimal(input.statistics.mean)

  return {
    status,
    reasons,
    evaluatedCount: input.statistics.count,
    requiredCount: input.controlPlan.sampleSize,
    target: toDecimalString(target),
    lowerLimit: toDecimalString(lowerLimit),
    upperLimit: toDecimalString(upperLimit),
    meanError: toDecimalString(target.minus(mean)),
    unitsOutsideIndividualLimits,
  }
}

/**
 * Applies the safety ordering STOP > INVESTIGATE > CORRECT > ACHIEVED.
 * `collect_more` is a workflow state, not an evaluation result.
 */
export function evaluateStartCriterion(input: EvaluateStartCriterionInput): SetupDecision {
  const { statistics, controlPlan, signals = {} } = input
  const criterion = controlPlan.startCriterion

  if (statistics.basis !== criterion.basis) {
    throw new DomainError(
      'criterion_basis_mismatch',
      `Les statistiques ${statistics.basis} ne correspondent pas au critère ${criterion.basis}.`,
      'statistics.basis',
    )
  }
  if (statistics.count !== input.includedValues.length) {
    throw new DomainError(
      'sample_count_mismatch',
      'Le nombre de valeurs incluses ne correspond pas aux statistiques.',
      'includedValues',
    )
  }
  if (!Number.isInteger(controlPlan.sampleSize) || controlPlan.sampleSize <= 0) {
    throw new DomainError(
      'invalid_sample_size',
      "La taille d'échantillon doit être un entier strictement positif.",
      'controlPlan.sampleSize',
    )
  }

  const outsideCount = individualOutsideCount(input.includedValues, input.target, criterion)
  const stopReasons = [...(signals.stopReasons ?? [])]

  if (stopReasons.length > 0) {
    return baseDecision(input, 'stop', stopReasons, outsideCount)
  }

  if (statistics.count < controlPlan.sampleSize) {
    return baseDecision(
      input,
      'collect_more',
      [
        {
          code: 'sample_incomplete',
          message: `Poursuivre l'échantillon : ${statistics.count}/${controlPlan.sampleSize} mesures incluses.`,
          actual: statistics.count,
          limit: controlPlan.sampleSize,
        },
      ],
      outsideCount,
    )
  }

  const investigationReasons = [...(signals.investigationReasons ?? [])]
  if (
    criterion.maxStandardDeviation !== undefined &&
    decimal(statistics.standardDeviation).gt(decimal(criterion.maxStandardDeviation))
  ) {
    investigationReasons.push({
      code: 'dispersion_too_high',
      message: "La dispersion de l'échantillon est trop élevée pour proposer une correction sûre.",
      actual: statistics.standardDeviation,
      limit: criterion.maxStandardDeviation,
    })
  }

  if (criterion.maxRange !== undefined && decimal(statistics.range).gt(decimal(criterion.maxRange))) {
    investigationReasons.push({
      code: 'range_too_high',
      message: "L'étendue de l'échantillon est trop élevée pour proposer une correction sûre.",
      actual: statistics.range,
      limit: criterion.maxRange,
    })
  }

  if (
    criterion.maxUnitsOutsideIndividualLimits !== undefined &&
    outsideCount > criterion.maxUnitsOutsideIndividualLimits
  ) {
    investigationReasons.push({
      code: 'too_many_individual_values_outside_limits',
      message: 'Trop de mesures individuelles sont hors des limites configurées.',
      actual: outsideCount,
      limit: criterion.maxUnitsOutsideIndividualLimits,
    })
  }

  if (signals.oscillationDetected) {
    investigationReasons.push({
      code: 'oscillation_detected',
      message: "Une oscillation entre les dernières itérations doit être investiguée avant de corriger.",
    })
  }

  if ((signals.atypicalMeasurementIds?.length ?? 0) > 0) {
    investigationReasons.push({
      code: 'atypical_measurement_requires_review',
      message: 'Une ou plusieurs mesures atypiques doivent être examinées sans suppression silencieuse.',
      actual: signals.atypicalMeasurementIds?.join(', '),
    })
  }

  if (investigationReasons.length > 0) {
    return baseDecision(input, 'investigate', investigationReasons, outsideCount)
  }

  const target = decimal(input.target)
  const mean = decimal(statistics.mean)
  const lowerLimit = target.minus(requireNonNegativeDecimal(criterion.meanLowerDeviation))
  const upperLimit = target.plus(requireNonNegativeDecimal(criterion.meanUpperDeviation))

  if (mean.gte(lowerLimit) && mean.lte(upperLimit)) {
    return baseDecision(
      input,
      'achieved',
      [
        {
          code: 'start_criterion_achieved',
          message: 'Critère de démarrage atteint — poursuivre le contrôle prévu par la procédure.',
        },
      ],
      outsideCount,
    )
  }

  if (
    controlPlan.maxIterations !== undefined &&
    signals.currentIteration !== undefined &&
    signals.currentIteration >= controlPlan.maxIterations
  ) {
    return baseDecision(
      input,
      'stop',
      [
        {
          code: 'maximum_iterations_reached',
          message: "Le nombre maximal d'itérations est atteint sans atteindre le critère. Arrêter et appeler le référent.",
          actual: signals.currentIteration,
          limit: controlPlan.maxIterations,
        },
      ],
      outsideCount,
    )
  }

  const absoluteError = target.minus(mean).abs()
  const deadband = requireNonNegativeDecimal(criterion.correctionDeadband)
  if (absoluteError.lte(deadband)) {
    return baseDecision(
      input,
      'investigate',
      [
        {
          code: 'outside_criterion_within_deadband',
          message:
            "La moyenne est hors du critère mais l'écart est dans la zone sans correction. Vérifier le plan de contrôle.",
          actual: toDecimalString(absoluteError),
          limit: toDecimalString(deadband),
        },
      ],
      outsideCount,
    )
  }

  const below = mean.lt(lowerLimit)
  return baseDecision(
    input,
    'correct',
    [
      below
        ? {
            code: 'mean_below_target_interval',
            message: 'La moyenne est sous la plage de démarrage : augmenter le remplissage.',
            actual: statistics.mean,
            limit: toDecimalString(lowerLimit),
          }
        : {
            code: 'mean_above_target_interval',
            message: 'La moyenne est au-dessus de la plage de démarrage : diminuer le remplissage.',
            actual: statistics.mean,
            limit: toDecimalString(upperLimit),
          },
    ],
    outsideCount,
  )
}
