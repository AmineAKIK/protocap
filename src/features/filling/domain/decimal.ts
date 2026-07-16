import Decimal from 'decimal.js'

import type { DecimalString, RoundingPolicy } from './models'

export const DomainDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -100,
  toExpPos: 100,
})

export class DomainError extends Error {
  readonly code: string
  readonly path?: string

  constructor(code: string, message: string, path?: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.path = path
  }
}

export function decimal(value: Decimal.Value, path?: string): Decimal {
  let parsed: Decimal

  try {
    parsed = new DomainDecimal(value)
  } catch {
    throw new DomainError('invalid_decimal', `Valeur décimale invalide : ${String(value)}.`, path)
  }

  if (!parsed.isFinite()) {
    throw new DomainError('non_finite_decimal', 'La valeur doit être un nombre décimal fini.', path)
  }

  return parsed
}

/** Serializes without exponent notation or insignificant trailing zeroes. */
export function toDecimalString(value: Decimal.Value): DecimalString {
  const parsed = decimal(value)
  return parsed.isZero() ? '0' : parsed.toFixed()
}

export function requirePositiveDecimal(value: Decimal.Value, path?: string): Decimal {
  const parsed = decimal(value, path)
  if (!parsed.gt(0)) {
    throw new DomainError('must_be_positive', 'La valeur doit être strictement positive.', path)
  }
  return parsed
}

export function requireNonNegativeDecimal(value: Decimal.Value, path?: string): Decimal {
  const parsed = decimal(value, path)
  if (parsed.isNegative()) {
    throw new DomainError('must_be_non_negative', 'La valeur doit être positive ou nulle.', path)
  }
  return parsed
}

function decimalRoundingMode(policy: RoundingPolicy): Decimal.Rounding {
  switch (policy) {
    case 'nearest_half_up':
      return Decimal.ROUND_HALF_UP
    case 'nearest_half_even':
      return Decimal.ROUND_HALF_EVEN
    case 'up':
      return Decimal.ROUND_CEIL
    case 'down':
      return Decimal.ROUND_FLOOR
    case 'toward_zero':
      return Decimal.ROUND_DOWN
    case 'away_from_zero':
      return Decimal.ROUND_UP
  }
}

/**
 * Quantizes by an arbitrary increment (0.01, 0.05, 0.25…), not merely by a
 * number of decimal places.
 */
export function quantizeDecimal(
  value: Decimal.Value,
  resolution: Decimal.Value,
  policy: RoundingPolicy,
): DecimalString {
  const increment = requirePositiveDecimal(resolution, 'resolution')
  const steps = decimal(value, 'value').div(increment)
  const roundedSteps = steps.toDecimalPlaces(0, decimalRoundingMode(policy))
  return toDecimalString(roundedSteps.mul(increment))
}

export function decimalMax(...values: Decimal.Value[]): Decimal {
  if (values.length === 0) {
    throw new DomainError('empty_decimal_collection', 'Au moins une valeur est requise.')
  }
  return DomainDecimal.max(...values.map((value) => decimal(value)))
}

export function decimalMin(...values: Decimal.Value[]): Decimal {
  if (values.length === 0) {
    throw new DomainError('empty_decimal_collection', 'Au moins une valeur est requise.')
  }
  return DomainDecimal.min(...values.map((value) => decimal(value)))
}

export function isWithinInclusive(
  value: Decimal.Value,
  minimum: Decimal.Value,
  maximum: Decimal.Value,
): boolean {
  const current = decimal(value)
  return current.gte(decimal(minimum)) && current.lte(decimal(maximum))
}

