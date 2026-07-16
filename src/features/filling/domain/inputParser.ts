import { decimal, toDecimalString } from './decimal'
import type { DecimalString } from './models'

export interface DecimalInputOptions {
  allowNegative?: boolean
  allowZero?: boolean
  minimum?: DecimalString
  maximum?: DecimalString
  /** Explicit user confirmation for an input containing both separators. */
  ambiguityResolution?: 'last_separator_is_decimal'
  detectFactorThousand?: boolean
}

export interface DecimalInputWarning {
  code: 'factor_thousand_suspected'
  message: string
  suggestedValue: DecimalString
}

export type DecimalInputResult =
  | {
      status: 'valid'
      value: DecimalString
      normalizedInput: string
      warnings: DecimalInputWarning[]
    }
  | {
      status: 'ambiguous'
      code: 'mixed_decimal_separators'
      message: string
      proposedValue: DecimalString
      alternativeValue: DecimalString
    }
  | {
      status: 'invalid'
      code:
        | 'empty'
        | 'invalid_format'
        | 'negative_not_allowed'
        | 'zero_not_allowed'
        | 'below_minimum'
        | 'above_maximum'
      message: string
      warnings: DecimalInputWarning[]
    }

const HAS_SPACE_GROUP = /[\s\u00a0\u202f]/
const SPACE_GROUP = /[\s\u00a0\u202f]/g
const VALID_GROUPED_WITH_SPACES = /^[+-]?(?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d+)(?:[,.]\d+)?$/
const PLAIN_NUMBER = /^[+-]?\d+(?:[,.]\d+)?$/

function invalidFormat(): DecimalInputResult {
  return {
    status: 'invalid',
    code: 'invalid_format',
    message: 'Saisir un nombre décimal, avec une virgule ou un point comme séparateur.',
    warnings: [],
  }
}

function makeMixedSeparatorCandidates(compact: string): {
  proposed: DecimalString
  alternative: DecimalString
} | null {
  const lastComma = compact.lastIndexOf(',')
  const lastDot = compact.lastIndexOf('.')
  const decimalSeparator = lastComma > lastDot ? ',' : '.'
  const groupingSeparator = decimalSeparator === ',' ? '.' : ','
  const decimalIndex = compact.lastIndexOf(decimalSeparator)
  const sign = compact.startsWith('-') || compact.startsWith('+') ? compact[0] : ''
  const unsigned = sign ? compact.slice(1) : compact
  const unsignedDecimalIndex = decimalIndex - sign.length
  const integerPart = unsigned.slice(0, unsignedDecimalIndex)
  const fractionPart = unsigned.slice(unsignedDecimalIndex + 1)
  const groups = integerPart.split(groupingSeparator)

  if (
    fractionPart.length === 0 ||
    groups.length < 2 ||
    !/^\d+$/.test(fractionPart) ||
    !/^\d{1,3}$/.test(groups[0]) ||
    groups.slice(1).some((group) => !/^\d{3}$/.test(group))
  ) {
    return null
  }

  const proposedRaw = `${sign}${groups.join('')}.${fractionPart}`
  const firstGroupingIndex = unsigned.indexOf(groupingSeparator)
  const alternativeUnsigned = `${unsigned.slice(0, firstGroupingIndex)}.${unsigned
    .slice(firstGroupingIndex + 1)
    .split(groupingSeparator)
    .join('')
    .split(decimalSeparator)
    .join('')}`
  const alternativeRaw = `${sign}${alternativeUnsigned}`

  try {
    return {
      proposed: toDecimalString(proposedRaw),
      alternative: toDecimalString(alternativeRaw),
    }
  } catch {
    return null
  }
}

function rangeWarnings(
  value: DecimalString,
  options: DecimalInputOptions,
): DecimalInputWarning[] {
  if (!options.detectFactorThousand) return []

  const parsed = decimal(value)
  const minimum = options.minimum === undefined ? undefined : decimal(options.minimum)
  const maximum = options.maximum === undefined ? undefined : decimal(options.maximum)
  const outside =
    (minimum !== undefined && parsed.lt(minimum)) ||
    (maximum !== undefined && parsed.gt(maximum))

  if (!outside) return []

  for (const candidate of [parsed.div(1000), parsed.mul(1000)]) {
    const candidateInside =
      (minimum === undefined || candidate.gte(minimum)) &&
      (maximum === undefined || candidate.lte(maximum))
    if (candidateInside) {
      const suggestedValue = toDecimalString(candidate)
      return [
        {
          code: 'factor_thousand_suspected',
          message: `La valeur semble décalée d'un facteur 1 000. Vérifier ${suggestedValue}.`,
          suggestedValue,
        },
      ]
    }
  }

  return []
}

/**
 * Parses workshop inputs without relying on the browser locale. A single comma
 * or point is always the decimal separator (`1,019` equals `1.019`). Inputs
 * containing both separators require an explicit confirmation.
 */
export function parseDecimalInput(
  rawInput: string,
  options: DecimalInputOptions = {},
): DecimalInputResult {
  const trimmed = rawInput.trim().replace(/\u2212/g, '-')
  if (trimmed.length === 0) {
    return {
      status: 'invalid',
      code: 'empty',
      message: 'La valeur est obligatoire.',
      warnings: [],
    }
  }

  if (HAS_SPACE_GROUP.test(trimmed) && !VALID_GROUPED_WITH_SPACES.test(trimmed)) {
    return invalidFormat()
  }

  const compact = trimmed.replace(SPACE_GROUP, '')
  const hasComma = compact.includes(',')
  const hasDot = compact.includes('.')

  let normalized: string
  if (hasComma && hasDot) {
    const candidates = makeMixedSeparatorCandidates(compact)
    if (candidates === null) return invalidFormat()

    if (options.ambiguityResolution !== 'last_separator_is_decimal') {
      return {
        status: 'ambiguous',
        code: 'mixed_decimal_separators',
        message: `Confirmer que la valeur voulue est ${candidates.proposed}.`,
        proposedValue: candidates.proposed,
        alternativeValue: candidates.alternative,
      }
    }

    normalized = candidates.proposed
  } else {
    if (!PLAIN_NUMBER.test(compact)) return invalidFormat()
    const separator = hasComma ? ',' : '.'
    const separatorCount = compact.split(separator).length - 1
    if (separatorCount > 1) return invalidFormat()
    normalized = compact.replace(',', '.')
  }

  let value: DecimalString
  try {
    value = toDecimalString(normalized)
  } catch {
    return invalidFormat()
  }

  const parsed = decimal(value)
  const warnings = rangeWarnings(value, options)

  if (!options.allowNegative && parsed.isNegative()) {
    return {
      status: 'invalid',
      code: 'negative_not_allowed',
      message: 'La valeur ne peut pas être négative.',
      warnings,
    }
  }

  if (!options.allowZero && parsed.isZero()) {
    return {
      status: 'invalid',
      code: 'zero_not_allowed',
      message: 'La valeur doit être strictement positive.',
      warnings,
    }
  }

  if (options.minimum !== undefined && parsed.lt(decimal(options.minimum))) {
    return {
      status: 'invalid',
      code: 'below_minimum',
      message: `La valeur doit être supérieure ou égale à ${options.minimum}.`,
      warnings,
    }
  }

  if (options.maximum !== undefined && parsed.gt(decimal(options.maximum))) {
    return {
      status: 'invalid',
      code: 'above_maximum',
      message: `La valeur doit être inférieure ou égale à ${options.maximum}.`,
      warnings,
    }
  }

  return { status: 'valid', value, normalizedInput: normalized, warnings }
}

export function parseRequiredDecimal(
  rawInput: string,
  options: DecimalInputOptions = {},
): DecimalString {
  const result = parseDecimalInput(rawInput, options)
  if (result.status !== 'valid') {
    throw new Error(result.message)
  }
  return result.value
}
