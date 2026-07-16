import { decimal, DomainError, requireNonNegativeDecimal, requirePositiveDecimal } from './decimal'
import type {
  DomainIssue,
  DomainValidationResult,
  FillingContext,
  ProfileSnapshots,
  SessionMode,
  VersionedProfileBase,
} from './models'
import { calculateMachineSetpoint, calculateTargetsFromProfiles } from './targets'

export interface ValidateContextInput {
  mode: SessionMode
  context: FillingContext
  profiles: ProfileSnapshots
  now?: Date
  plausibleDensityRangeGPerMl?: { minimum: string; maximum: string }
}

function issue(
  issues: DomainIssue[],
  code: string,
  severity: DomainIssue['severity'],
  path: string,
  message: string,
): void {
  issues.push({ code, severity, path, message })
}

function validDate(value: string | undefined): Date | undefined {
  if (value === undefined) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function validateProfileLifecycle(
  profile: VersionedProfileBase,
  path: string,
  mode: SessionMode,
  now: Date,
  issues: DomainIssue[],
): void {
  if (profile.status === 'obsolete') {
    issue(issues, 'profile_obsolete', 'error', path, `Le profil « ${profile.name} » est obsolète.`)
  } else if (mode === 'real' && profile.status !== 'verified_by_me') {
    issue(
      issues,
      'profile_not_verified',
      'error',
      path,
      `Le profil « ${profile.name} » doit être vérifié par moi avant un réglage réel.`,
    )
  } else if (mode === 'simulation' && profile.status !== 'verified_by_me') {
    issue(
      issues,
      'profile_not_verified',
      'warning',
      path,
      `Le profil « ${profile.name} » est utilisable uniquement en simulation.`,
    )
  }

  const validFrom = validDate(profile.validFrom)
  const validUntil = validDate(profile.validUntil)
  if (validFrom !== undefined && validFrom > now) {
    issue(issues, 'reference_not_yet_valid', 'error', path, `Le profil « ${profile.name} » n'est pas encore valide.`)
  }
  if (validUntil !== undefined && validUntil < now) {
    issue(issues, 'reference_expired', 'error', path, `Le profil « ${profile.name} » a expiré.`)
  }
}

function validateContextIds(input: ValidateContextInput, issues: DomainIssue[]): void {
  const { context, profiles } = input
  const pairs: Array<[string, string, string]> = [
    ['context.machineId', context.machineId, profiles.machine.id],
    ['context.productId', context.productId, profiles.product.id],
    ['context.packagingId', context.packagingId, profiles.packaging.id],
    ['context.controlPlanId', context.controlPlanId, profiles.controlPlan.id],
    ['context.instrumentId', context.instrumentId, profiles.instrument.id],
  ]
  for (const [path, actual, expected] of pairs) {
    if (actual !== expected) {
      issue(
        issues,
        'context_incompatible',
        'error',
        path,
        `Le contexte référence ${actual}, mais le snapshot chargé est ${expected}.`,
      )
    }
  }

  if (context.headId !== undefined && !profiles.machine.headIds.includes(context.headId)) {
    issue(
      issues,
      'context_incompatible',
      'error',
      'context.headId',
      "La tête sélectionnée n'appartient pas au profil machine.",
    )
  }
}

function validateCalibration(input: ValidateContextInput, issues: DomainIssue[]): void {
  const { context, profiles } = input
  const calibration = profiles.calibration
  if (context.calibrationId === undefined && calibration === undefined) return

  if (
    calibration === undefined ||
    context.calibrationId !== calibration.id ||
    calibration.machineId !== profiles.machine.id ||
    (calibration.headId !== undefined && calibration.headId !== context.headId) ||
    (calibration.productId !== undefined && calibration.productId !== profiles.product.id) ||
    (calibration.packagingId !== undefined && calibration.packagingId !== profiles.packaging.id)
  ) {
    issue(
      issues,
      'calibration_incompatible',
      'error',
      'profiles.calibration',
      "La calibration ne correspond pas exactement au contexte de réglage.",
    )
    return
  }

  const slope = decimal(calibration.slopeGPerSettingUnit)
  if (slope.isZero()) {
    issue(
      issues,
      'zero_calibration_slope',
      'error',
      'profiles.calibration.slopeGPerSettingUnit',
      'La pente de calibration ne peut pas être nulle.',
    )
  }
  for (const [key, expected] of Object.entries(calibration.applicableConditions ?? {})) {
    if (context.conditions?.[key] !== expected) {
      issue(
        issues,
        'calibration_condition_mismatch',
        'error',
        `context.conditions.${key}`,
        `La calibration exige la condition ${key}=${expected}.`,
      )
    }
  }
}

export function validateContext(input: ValidateContextInput): DomainValidationResult {
  const issues: DomainIssue[] = []
  const now = input.now ?? new Date()
  const { profiles } = input

  validateContextIds(input, issues)
  for (const [path, profile] of Object.entries(profiles)) {
    if (profile !== undefined) {
      validateProfileLifecycle(profile, `profiles.${path}`, input.mode, now, issues)
    }
  }

  if (profiles.packaging.tareMode === 'fixed' && profiles.packaging.fixedTare === undefined) {
    issue(
      issues,
      'fixed_tare_missing',
      'error',
      'profiles.packaging.fixedTare',
      'Une tare fixe ou moyenne documentée est obligatoire pour ce profil.',
    )
  }
  if (profiles.packaging.tareMode !== 'fixed' && profiles.packaging.fixedTare !== undefined) {
    issue(
      issues,
      'fixed_tare_not_applicable',
      'warning',
      'profiles.packaging.fixedTare',
      'La tare moyenne enregistrée ne sera pas appliquée au mode apparié ou destructif.',
    )
  }
  if (
    profiles.controlPlan.startCriterion.basis === 'gross_mass_g' &&
    profiles.packaging.tareMode !== 'fixed'
  ) {
    issue(
      issues,
      'gross_target_requires_fixed_tare',
      'error',
      'profiles.controlPlan.startCriterion.basis',
      'Un critère BRUT commun nécessite une tare fixe ou moyenne applicable.',
    )
  }

  const densityValidFrom = validDate(profiles.product.density.validFrom)
  const densityValidUntil = validDate(profiles.product.density.validUntil)
  if (densityValidFrom !== undefined && densityValidFrom > now) {
    issue(
      issues,
      'reference_not_yet_valid',
      'error',
      'profiles.product.density.validFrom',
      "La référence de masse volumique n'est pas encore valide.",
    )
  }
  if (densityValidUntil !== undefined && densityValidUntil < now) {
    issue(
      issues,
      'reference_expired',
      'error',
      'profiles.product.density.validUntil',
      'La référence de masse volumique a expiré.',
    )
  }

  if (profiles.instrument.verificationStatus !== 'valid') {
    issue(
      issues,
      'instrument_not_valid',
      input.mode === 'real' ? 'error' : 'warning',
      'profiles.instrument.verificationStatus',
      "Le statut de vérification de la balance n'est pas valide.",
    )
  }
  const instrumentExpiry = validDate(profiles.instrument.verificationValidUntil)
  if (instrumentExpiry !== undefined && instrumentExpiry < now) {
    issue(
      issues,
      'instrument_not_valid',
      'error',
      'profiles.instrument.verificationValidUntil',
      'La vérification de la balance a expiré.',
    )
  }

  try {
    requirePositiveDecimal(profiles.machine.resolution)
    const machineMinimum = decimal(profiles.machine.minimum)
    const machineMaximum = decimal(profiles.machine.maximum)
    if (machineMinimum.gte(machineMaximum)) {
      throw new DomainError('invalid_machine_range', 'La plage machine est invalide.')
    }
    requirePositiveDecimal(profiles.product.approvedTargetVolumeMl)
    requirePositiveDecimal(profiles.product.density.valueGPerMl)
    requirePositiveDecimal(profiles.instrument.resolutionG)
    requireNonNegativeDecimal(profiles.instrument.minimumG)
    if (decimal(profiles.instrument.minimumG).gte(decimal(profiles.instrument.maximumG))) {
      throw new DomainError('invalid_instrument_range', 'La plage de la balance est invalide.')
    }
    requirePositiveDecimal(profiles.controlPlan.maxCorrectionG)
    requireNonNegativeDecimal(profiles.controlPlan.startCriterion.meanLowerDeviation)
    requireNonNegativeDecimal(profiles.controlPlan.startCriterion.meanUpperDeviation)
    requireNonNegativeDecimal(profiles.controlPlan.startCriterion.correctionDeadband)

    const targets = calculateTargetsFromProfiles(profiles.product, profiles.packaging)
    calculateMachineSetpoint(targets, profiles.machine, profiles.calibration)
    const weighedTarget = targets.grossMassG ?? targets.netMassG
    if (
      decimal(weighedTarget).lt(decimal(profiles.instrument.minimumG)) ||
      decimal(weighedTarget).gt(decimal(profiles.instrument.maximumG))
    ) {
      issue(
        issues,
        'instrument_capacity_exceeded',
        'error',
        'profiles.instrument',
        "La cible est hors de la plage de la balance.",
      )
    }
  } catch (error) {
    if (error instanceof DomainError) {
      issue(issues, error.code, 'error', error.path ?? 'profiles', error.message)
    } else {
      throw error
    }
  }

  const plausibleDensityRange =
    input.plausibleDensityRangeGPerMl ?? profiles.product.plausibleDensityRangeGPerMl
  if (plausibleDensityRange !== undefined) {
    const density = decimal(profiles.product.density.valueGPerMl)
    if (
      density.lt(decimal(plausibleDensityRange.minimum)) ||
      density.gt(decimal(plausibleDensityRange.maximum))
    ) {
      issue(
        issues,
        'density_outside_plausible_range',
        'error',
        'profiles.product.density.valueGPerMl',
        'La masse volumique est hors de la plage configurée ; vérifier notamment un facteur 1 000.',
      )
    }
  }

  if (
    input.context.productTemperatureC !== undefined &&
    profiles.product.approvedTemperatureRule === undefined &&
    !decimal(input.context.productTemperatureC).eq(
      decimal(profiles.product.density.referenceTemperatureC),
    )
  ) {
    issue(
      issues,
      'temperature_rule_missing',
      'warning',
      'context.productTemperatureC',
      'La température diffère de la référence et aucune correction thermique approuvée ne sera appliquée.',
    )
  }

  validateCalibration(input, issues)
  return { valid: !issues.some((entry) => entry.severity === 'error'), issues }
}
