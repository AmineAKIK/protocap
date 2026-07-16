import { describe, expect, it } from 'vitest'

import { parseDecimalInput } from '../inputParser'

describe('parseDecimalInput', () => {
  it.each([
    ['1,019', '1.019'],
    ['1.019', '1.019'],
    ['  5,170  ', '5.17'],
    ['1\u202f234,50', '1234.5'],
    ['+0.25', '0.25'],
  ])('normalise %s en %s', (raw, expected) => {
    expect(parseDecimalInput(raw, { allowZero: true })).toMatchObject({
      status: 'valid',
      value: expected,
    })
  })

  it('demande confirmation lorsque virgule et point sont mélangés', () => {
    expect(parseDecimalInput('1.234,56')).toEqual({
      status: 'ambiguous',
      code: 'mixed_decimal_separators',
      message: 'Confirmer que la valeur voulue est 1234.56.',
      proposedValue: '1234.56',
      alternativeValue: '1.23456',
    })

    expect(
      parseDecimalInput('1.234,56', {
        ambiguityResolution: 'last_separator_is_decimal',
      }),
    ).toMatchObject({ status: 'valid', value: '1234.56' })

    expect(parseDecimalInput('1,234,567.89')).toMatchObject({
      status: 'ambiguous',
      proposedValue: '1234567.89',
      alternativeValue: '1.23456789',
    })
  })

  it('refuse les formats, signes et zéros interdits', () => {
    expect(parseDecimalInput('')).toMatchObject({ status: 'invalid', code: 'empty' })
    expect(parseDecimalInput('1,2,3')).toMatchObject({ status: 'invalid', code: 'invalid_format' })
    expect(parseDecimalInput('-1')).toMatchObject({
      status: 'invalid',
      code: 'negative_not_allowed',
    })
    expect(parseDecimalInput('0')).toMatchObject({ status: 'invalid', code: 'zero_not_allowed' })
  })

  it('détecte un probable facteur 1 000 dans une plage métier', () => {
    const result = parseDecimalInput('1019', {
      minimum: '0.5',
      maximum: '2',
      detectFactorThousand: true,
    })
    expect(result).toMatchObject({
      status: 'invalid',
      code: 'above_maximum',
      warnings: [{ code: 'factor_thousand_suspected', suggestedValue: '1.019' }],
    })
  })
})
