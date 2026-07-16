import {
  decimal,
  DomainError,
  isWithinInclusive,
  quantizeDecimal,
  requireNonNegativeDecimal,
  requirePositiveDecimal,
  toDecimalString,
} from './decimal'
import type {
  CalibrationProfile,
  MachineProfile,
  MachineSetpoint,
  PackagingProfile,
  ProductProfile,
  QuantizedValue,
  TargetValues,
} from './models'

export interface CalculateTargetsInput {
  volumeMl: string
  densityGPerMl: string
  tareG?: string
}

export function calculateTargets(input: CalculateTargetsInput): TargetValues {
  const volume = requirePositiveDecimal(input.volumeMl, 'volumeMl')
  const density = requirePositiveDecimal(input.densityGPerMl, 'densityGPerMl')
  const netMass = volume.mul(density)

  if (input.tareG === undefined) {
    return {
      volumeMl: toDecimalString(volume),
      densityGPerMl: toDecimalString(density),
      netMassG: toDecimalString(netMass),
    }
  }

  const tare = requireNonNegativeDecimal(input.tareG, 'tareG')
  return {
    volumeMl: toDecimalString(volume),
    densityGPerMl: toDecimalString(density),
    netMassG: toDecimalString(netMass),
    tareG: toDecimalString(tare),
    grossMassG: toDecimalString(netMass.plus(tare)),
  }
}

export function calculateTargetsFromProfiles(
  product: ProductProfile,
  packaging: PackagingProfile,
): TargetValues {
  return calculateTargets({
    volumeMl: product.approvedTargetVolumeMl,
    densityGPerMl: product.density.valueGPerMl,
    tareG: packaging.tareMode === 'fixed' ? packaging.fixedTare?.meanG : undefined,
  })
}

export function estimateVolumeFromNetMass(netMassG: string, densityGPerMl: string): string {
  const net = requireNonNegativeDecimal(netMassG, 'netMassG')
  const density = requirePositiveDecimal(densityGPerMl, 'densityGPerMl')
  return toDecimalString(net.div(density))
}

export function estimateVolumeFromGrossMass(
  grossMassG: string,
  tareG: string,
  densityGPerMl: string,
): string {
  const gross = requireNonNegativeDecimal(grossMassG, 'grossMassG')
  const tare = requireNonNegativeDecimal(tareG, 'tareG')
  const net = gross.minus(tare)
  if (net.isNegative()) {
    throw new DomainError(
      'gross_below_tare',
      'La masse brute mesurée ne peut pas être inférieure à la tare.',
      'grossMassG',
    )
  }
  return estimateVolumeFromNetMass(toDecimalString(net), densityGPerMl)
}

function quantizedMachineValue(exact: string, machine: MachineProfile): QuantizedValue {
  const quantized = quantizeDecimal(exact, machine.resolution, machine.roundingPolicy)
  if (
    !isWithinInclusive(exact, machine.minimum, machine.maximum) ||
    !isWithinInclusive(quantized, machine.minimum, machine.maximum)
  ) {
    throw new DomainError(
      'machine_capacity_exceeded',
      `La consigne ${quantized} ${machine.unit} est hors de la plage ${machine.minimum}–${machine.maximum} ${machine.unit}.`,
      'machine',
    )
  }
  return {
    exact: toDecimalString(exact),
    quantized,
    resolution: toDecimalString(machine.resolution),
    policy: machine.roundingPolicy,
  }
}

function estimateMechanicalStartingSetting(
  targets: TargetValues,
  machine: MachineProfile,
  calibration: CalibrationProfile,
): MachineSetpoint {
  if (calibration.machineId !== machine.id || calibration.status !== 'verified_by_me') {
    throw new DomainError(
      'calibration_incompatible',
      "La calibration n'est pas vérifiée ou ne correspond pas à la machine.",
      'calibration',
    )
  }

  const slope = decimal(calibration.slopeGPerSettingUnit, 'calibration.slopeGPerSettingUnit')
  if (slope.isZero()) {
    throw new DomainError(
      'zero_calibration_slope',
      'La pente de calibration ne peut pas être nulle.',
      'calibration.slopeGPerSettingUnit',
    )
  }
  const intercept = decimal(calibration.interceptG ?? '0')
  const exactSetting = decimal(targets.netMassG).minus(intercept).div(slope)

  if (
    !isWithinInclusive(
      exactSetting,
      calibration.validSettingMinimum,
      calibration.validSettingMaximum,
    )
  ) {
    throw new DomainError(
      'calibration_domain_exceeded',
      "La cible est hors du domaine validé de la calibration mécanique.",
      'calibration',
    )
  }

  if (machine.unit === 'mL' || machine.unit === 'g') {
    throw new DomainError(
      'invalid_mechanical_unit',
      'Une machine mécanique doit utiliser une unité de réglage mécanique.',
      'machine.unit',
    )
  }

  return {
    kind: 'mechanical_estimate',
    unit: machine.unit,
    value: quantizedMachineValue(toDecimalString(exactSetting), machine),
    calibrationId: calibration.id,
    uncertaintyG: calibration.uncertaintyG,
  }
}

export function calculateMachineSetpoint(
  targets: TargetValues,
  machine: MachineProfile,
  calibration?: CalibrationProfile,
): MachineSetpoint {
  switch (machine.setpointType) {
    case 'volume':
      if (machine.unit !== 'mL') {
        throw new DomainError('machine_unit_mismatch', 'La consigne volumétrique doit être en mL.')
      }
      return {
        kind: 'direct',
        basis: 'volume_ml',
        unit: 'mL',
        label: 'VOLUME',
        value: quantizedMachineValue(targets.volumeMl, machine),
      }

    case 'net_mass':
      if (machine.unit !== 'g') {
        throw new DomainError('machine_unit_mismatch', 'La consigne de masse nette doit être en g.')
      }
      return {
        kind: 'direct',
        basis: 'net_mass_g',
        unit: 'g',
        label: 'NET',
        value: quantizedMachineValue(targets.netMassG, machine),
      }

    case 'gross_mass':
      if (machine.unit !== 'g') {
        throw new DomainError('machine_unit_mismatch', 'La consigne de masse brute doit être en g.')
      }
      if (targets.grossMassG === undefined) {
        throw new DomainError(
          'gross_target_requires_fixed_tare',
          'Une consigne BRUT nécessite une tare fixe ou moyenne applicable.',
          'targets.grossMassG',
        )
      }
      return {
        kind: 'direct',
        basis: 'gross_mass_g',
        unit: 'g',
        label: 'BRUT',
        value: quantizedMachineValue(targets.grossMassG, machine),
      }

    case 'mechanical':
      return calibration === undefined
        ? { kind: 'mechanical_without_calibration', physicalTargets: targets }
        : estimateMechanicalStartingSetting(targets, machine, calibration)
  }
}

