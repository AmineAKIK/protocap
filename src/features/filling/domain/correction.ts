import {
  decimal,
  DomainError,
  isWithinInclusive,
  quantizeDecimal,
  requirePositiveDecimal,
  toDecimalString,
} from './decimal'
import type {
  CalibrationProfile,
  CorrectionRecommendation,
  MachineProfile,
  MechanicalSettingEstimate,
  SetupDecision,
} from './models'

export interface RecommendCorrectionInput {
  decision: SetupDecision
  targetNetMassG: string
  measuredMeanNetMassG: string
  densityGPerMl: string
  maxCorrectionG: string
  machine?: MachineProfile
  calibration?: CalibrationProfile
  currentSetting?: string
}

function mechanicalEstimate(
  signedChangeG: string,
  machine: MachineProfile | undefined,
  calibration: CalibrationProfile | undefined,
  currentSetting: string | undefined,
): MechanicalSettingEstimate | undefined {
  if (
    machine === undefined ||
    machine.setpointType !== 'mechanical' ||
    calibration === undefined ||
    currentSetting === undefined ||
    calibration.status !== 'verified_by_me' ||
    calibration.machineId !== machine.id
  ) {
    return undefined
  }

  const slope = decimal(calibration.slopeGPerSettingUnit)
  if (slope.isZero()) return undefined

  const current = decimal(currentSetting)
  const delta = decimal(signedChangeG).div(slope)
  const proposed = current.plus(delta)
  const quantized = quantizeDecimal(proposed, machine.resolution, machine.roundingPolicy)
  const approachIsCompatible =
    calibration.approachDirection === 'either' ||
    (calibration.approachDirection === 'increasing' && delta.isPositive()) ||
    (calibration.approachDirection === 'decreasing' && delta.isNegative())
  const withinDomain =
    approachIsCompatible &&
    isWithinInclusive(
      current,
      calibration.validSettingMinimum,
      calibration.validSettingMaximum,
    ) &&
    isWithinInclusive(
      proposed,
      calibration.validSettingMinimum,
      calibration.validSettingMaximum,
    ) &&
    isWithinInclusive(
      quantized,
      calibration.validSettingMinimum,
      calibration.validSettingMaximum,
    ) &&
    isWithinInclusive(proposed, machine.minimum, machine.maximum) &&
    isWithinInclusive(quantized, machine.minimum, machine.maximum)

  // Never expose an out-of-domain position as a proposal.
  if (!withinDomain) return undefined

  return {
    calibrationId: calibration.id,
    currentSetting: toDecimalString(current),
    deltaSetting: toDecimalString(delta),
    proposedSetting: toDecimalString(proposed),
    quantizedSetting: quantized,
    withinCalibrationDomain: true,
    requiredApproachDirection: calibration.approachDirection,
    backlashSettingUnits: calibration.backlashSettingUnits,
    uncertaintyG: calibration.uncertaintyG,
  }
}

/**
 * Returns a signed correction: positive means add product, negative means remove
 * product. A mechanical position is optional and only emitted inside a verified
 * calibration domain.
 */
export function recommendCorrection(input: RecommendCorrectionInput): CorrectionRecommendation {
  if (input.decision.status !== 'correct') {
    throw new DomainError(
      'correction_not_allowed',
      'Une correction ne peut être calculée que pour une décision « correct ».',
      'decision.status',
    )
  }

  const target = requirePositiveDecimal(input.targetNetMassG, 'targetNetMassG')
  const measured = decimal(input.measuredMeanNetMassG, 'measuredMeanNetMassG')
  const density = requirePositiveDecimal(input.densityGPerMl, 'densityGPerMl')
  const cap = requirePositiveDecimal(input.maxCorrectionG, 'maxCorrectionG')
  const fullError = target.minus(measured)
  if (fullError.isZero()) {
    throw new DomainError(
      'zero_correction',
      'Aucune correction ne peut être proposée pour un écart nul.',
    )
  }

  const capped = fullError.abs().gt(cap)
  const recommended = capped ? cap.mul(fullError.isPositive() ? 1 : -1) : fullError
  const errorMl = fullError.div(density)
  const recommendedMl = recommended.div(density)
  const direction = fullError.isPositive() ? 'increase_fill' : 'decrease_fill'
  const estimate = mechanicalEstimate(
    toDecimalString(recommended),
    input.machine,
    input.calibration,
    input.currentSetting,
  )

  const action = direction === 'increase_fill' ? 'Augmenter' : 'Diminuer'
  const capText = capped ? ' La correction a été plafonnée par le plan de contrôle.' : ''
  const calibrationText =
    input.machine?.setpointType === 'mechanical' && estimate === undefined
      ? ' Aucune position mécanique exacte n’est proposée sans calibration valide dans son domaine.'
      : ''

  return {
    direction,
    fullErrorG: toDecimalString(fullError),
    fullErrorMl: toDecimalString(errorMl),
    recommendedChangeG: toDecimalString(recommended),
    recommendedChangeMl: toDecimalString(recommendedMl),
    capped,
    mechanicalEstimate: estimate,
    explanation: `${action} le remplissage de ${toDecimalString(recommended.abs())} g (${toDecimalString(recommendedMl.abs())} mL).${capText}${calibrationText}`,
  }
}
