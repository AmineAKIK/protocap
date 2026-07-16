import { decimal, decimalMax, decimalMin, DomainError, toDecimalString } from './decimal'
import { measurementValueForBasis } from './tare'
import type {
  CriterionBasis,
  NormalizedMeasurement,
  SampleStatistics,
} from './models'

export interface StatisticsOptions {
  basis?: CriterionBasis
  excludedCount?: number
  standardDeviationMethod?: 'sample' | 'population'
}

export function calculateStatistics(
  values: string[],
  options: StatisticsOptions = {},
): SampleStatistics {
  if (values.length === 0) {
    throw new DomainError(
      'empty_sample',
      'Au moins une mesure incluse est nécessaire pour calculer les statistiques.',
      'measurements',
    )
  }

  const parsed = values.map((value, index) => decimal(value, `measurements.${index}`))
  const sum = parsed.reduce((accumulator, value) => accumulator.plus(value), decimal(0))
  const mean = sum.div(parsed.length)
  const minimum = decimalMin(...parsed)
  const maximum = decimalMax(...parsed)
  const method = options.standardDeviationMethod ?? 'sample'
  const divisor = method === 'sample' ? parsed.length - 1 : parsed.length
  const variance =
    divisor <= 0
      ? decimal(0)
      : parsed
          .reduce(
            (accumulator, value) => accumulator.plus(value.minus(mean).pow(2)),
            decimal(0),
          )
          .div(divisor)

  return {
    basis: options.basis ?? 'net_mass_g',
    count: parsed.length,
    excludedCount: options.excludedCount ?? 0,
    mean: toDecimalString(mean),
    minimum: toDecimalString(minimum),
    maximum: toDecimalString(maximum),
    range: toDecimalString(maximum.minus(minimum)),
    standardDeviation: toDecimalString(variance.sqrt()),
    standardDeviationMethod: method,
  }
}

export interface SampleStatisticsInput {
  measurements: NormalizedMeasurement[]
  basis: CriterionBasis
  densityGPerMl?: string
  standardDeviationMethod?: 'sample' | 'population'
}

export function calculateSampleStatistics(input: SampleStatisticsInput): SampleStatistics {
  const included = input.measurements.filter((measurement) => !measurement.excluded)
  const values = included.map((measurement) =>
    measurementValueForBasis(measurement, input.basis, input.densityGPerMl),
  )

  return calculateStatistics(values, {
    basis: input.basis,
    excludedCount: input.measurements.length - included.length,
    standardDeviationMethod: input.standardDeviationMethod,
  })
}

