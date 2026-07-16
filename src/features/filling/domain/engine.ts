import { recommendCorrection } from './correction'
import { evaluateStartCriterion } from './decision'
import { validateContext } from './invariants'
import type {
  DecisionReason,
  DecisionReasonCode,
  DecisionSignals,
  FillingContext,
  MeasurementInput,
  NormalizedMeasurement,
  ProfileSnapshots,
  SampleStatistics,
  SessionMode,
  SetupDecision,
  TargetValues,
  CorrectionRecommendation,
  DomainValidationResult,
} from './models'
import { calculateSampleStatistics } from './statistics'
import { measurementValueForBasis, normalizeMeasurements } from './tare'
import { calculateTargetsFromProfiles } from './targets'
import { DomainError } from './decimal'

export interface EvaluateFillingSampleInput {
  mode: SessionMode
  context: FillingContext
  profiles: ProfileSnapshots
  measurements: MeasurementInput[]
  signals?: DecisionSignals
  currentSetting?: string
  now?: Date
}

export interface FillingSampleEvaluation {
  contextValidation: DomainValidationResult
  targets: TargetValues
  measurements: NormalizedMeasurement[]
  statistics: SampleStatistics
  decision: SetupDecision
  recommendation?: CorrectionRecommendation
}

const DECISION_REASON_CODES = new Set<DecisionReasonCode>([
  'profile_not_verified',
  'profile_obsolete',
  'instrument_not_valid',
  'instrument_capacity_exceeded',
  'reference_expired',
  'reference_not_yet_valid',
  'machine_capacity_exceeded',
  'context_incompatible',
  'calibration_incompatible',
  'density_outside_plausible_range',
  'gross_target_requires_fixed_tare',
  'fixed_tare_missing',
])

function validationStopReasons(validation: DomainValidationResult): DecisionReason[] {
  return validation.issues
    .filter((entry) => entry.severity === 'error')
    .map((entry) => ({
      code: DECISION_REASON_CODES.has(entry.code as DecisionReasonCode)
        ? (entry.code as DecisionReasonCode)
        : 'explicit_stop_rule',
      message: entry.message,
      actual: entry.path,
    }))
}

function targetForCriterion(targets: TargetValues, basis: SampleStatistics['basis']): string {
  switch (basis) {
    case 'net_mass_g':
      return targets.netMassG
    case 'volume_ml':
      return targets.volumeMl
    case 'gross_mass_g':
      if (targets.grossMassG === undefined) {
        throw new DomainError(
          'gross_target_requires_fixed_tare',
          'Un critère BRUT nécessite une tare fixe ou moyenne applicable.',
          'controlPlan.startCriterion.basis',
        )
      }
      return targets.grossMassG
  }
}

/**
 * End-to-end pure facade used by the application layer. It is intentionally
 * side-effect free: persistence records its returned exact strings afterwards.
 */
export function evaluateFillingSample(input: EvaluateFillingSampleInput): FillingSampleEvaluation {
  if (input.measurements.length === 0) {
    throw new DomainError(
      'empty_sample',
      'Ajouter au moins une mesure avant de calculer une analyse.',
      'measurements',
    )
  }

  const contextValidation = validateContext({
    mode: input.mode,
    context: input.context,
    profiles: input.profiles,
    now: input.now,
  })
  const targets = calculateTargetsFromProfiles(input.profiles.product, input.profiles.packaging)
  const normalized = normalizeMeasurements(input.measurements, input.profiles.packaging)
  const basis = input.profiles.controlPlan.startCriterion.basis
  const statistics = calculateSampleStatistics({
    measurements: normalized,
    basis,
    densityGPerMl: input.profiles.product.density.valueGPerMl,
  })
  const includedValues = normalized
    .filter((measurement) => !measurement.excluded)
    .map((measurement) =>
      measurementValueForBasis(
        measurement,
        basis,
        input.profiles.product.density.valueGPerMl,
      ),
    )
  const decision = evaluateStartCriterion({
    target: targetForCriterion(targets, basis),
    statistics,
    includedValues,
    controlPlan: input.profiles.controlPlan,
    signals: {
      ...input.signals,
      stopReasons: [
        ...validationStopReasons(contextValidation),
        ...(input.signals?.stopReasons ?? []),
      ],
    },
  })

  let recommendation: CorrectionRecommendation | undefined
  if (decision.status === 'correct') {
    const netStatistics = calculateSampleStatistics({
      measurements: normalized,
      basis: 'net_mass_g',
    })
    recommendation = recommendCorrection({
      decision,
      targetNetMassG: targets.netMassG,
      measuredMeanNetMassG: netStatistics.mean,
      densityGPerMl: targets.densityGPerMl,
      maxCorrectionG: input.profiles.controlPlan.maxCorrectionG,
      machine: input.profiles.machine,
      calibration: input.profiles.calibration,
      currentSetting: input.currentSetting,
    })
  }

  return {
    contextValidation,
    targets,
    measurements: normalized,
    statistics,
    decision,
    recommendation,
  }
}
