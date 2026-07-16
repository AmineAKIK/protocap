import {
  DomainError,
  requireNonNegativeDecimal,
  requirePositiveDecimal,
  toDecimalString,
} from './decimal'
import type {
  CriterionBasis,
  MeasurementInput,
  NormalizedMeasurement,
  PackagingProfile,
} from './models'

function validateExclusion(input: MeasurementInput): void {
  if (input.excluded && !input.exclusionReason?.trim()) {
    throw new DomainError(
      'exclusion_reason_required',
      "Une mesure exclue doit conserver un motif d'exclusion.",
      'measurement.exclusionReason',
    )
  }
}

function finishMeasurement(
  input: MeasurementInput,
  grossMassG: string,
  tareMassG: string,
): NormalizedMeasurement {
  const gross = requirePositiveDecimal(grossMassG, 'measurement.grossMassG')
  const tare = requireNonNegativeDecimal(tareMassG, 'measurement.tareMassG')
  const net = gross.minus(tare)

  if (net.isNegative()) {
    throw new DomainError(
      'gross_below_tare',
      `La masse brute ${gross.toFixed()} g est inférieure à la tare ${tare.toFixed()} g.`,
      'measurement',
    )
  }

  return {
    id: input.id,
    mode: input.mode,
    grossMassG: toDecimalString(gross),
    tareMassG: toDecimalString(tare),
    netMassG: toDecimalString(net),
    excluded: input.excluded ?? false,
    exclusionReason: input.excluded ? input.exclusionReason?.trim() : undefined,
    capturedAt: input.capturedAt,
    headId: input.headId,
  }
}

export function normalizeMeasurement(
  input: MeasurementInput,
  packaging: PackagingProfile,
): NormalizedMeasurement {
  validateExclusion(input)

  if (input.mode !== packaging.tareMode) {
    throw new DomainError(
      'tare_mode_mismatch',
      `La mesure ${input.mode} ne correspond pas au mode de tare ${packaging.tareMode}.`,
      'measurement.mode',
    )
  }

  switch (input.mode) {
    case 'fixed': {
      if (packaging.fixedTare === undefined) {
        throw new DomainError(
          'fixed_tare_missing',
          'Le profil emballage doit fournir une tare fixe ou moyenne.',
          'packaging.fixedTare',
        )
      }
      return finishMeasurement(input, input.grossMassG, packaging.fixedTare.meanG)
    }

    case 'paired':
      return finishMeasurement(input, input.grossMassG, input.tareMassG)

    case 'destructive':
      return finishMeasurement(
        input,
        input.grossBeforeEmptyingG,
        input.cleanedPackagingMassG,
      )
  }
}

export function normalizeMeasurements(
  inputs: MeasurementInput[],
  packaging: PackagingProfile,
): NormalizedMeasurement[] {
  const ids = new Set<string>()
  return inputs.map((input) => {
    if (ids.has(input.id)) {
      throw new DomainError(
        'duplicate_measurement_id',
        `L'identifiant de mesure ${input.id} est utilisé plusieurs fois.`,
        'measurements',
      )
    }
    ids.add(input.id)
    return normalizeMeasurement(input, packaging)
  })
}

export function measurementValueForBasis(
  measurement: NormalizedMeasurement,
  basis: CriterionBasis,
  densityGPerMl?: string,
): string {
  switch (basis) {
    case 'net_mass_g':
      return measurement.netMassG
    case 'gross_mass_g':
      return measurement.grossMassG
    case 'volume_ml': {
      const density = requirePositiveDecimal(densityGPerMl ?? '', 'densityGPerMl')
      return toDecimalString(requireNonNegativeDecimal(measurement.netMassG).div(density))
    }
  }
}

