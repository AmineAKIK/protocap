import { describe, expect, it } from 'vitest'

import {
  assessHistoryCompatibility,
  buildHistoryCompatibilityKey,
  findCompatibleHistory,
} from '../compatibility'
import {
  assertEngineVersionReadable,
  FILLING_ENGINE_VERSION,
  isEngineVersionReadable,
} from '../engineVersion'
import { validateContext } from '../invariants'
import type { HistoryRecord, ProfileSnapshots } from '../models'
import {
  machineProfileSchema,
  packagingProfileSchema,
  productProfileSchema,
} from '../schemas'
import {
  controlPlanProfile,
  instrumentProfile,
  machineProfile,
  packagingProfile,
  productProfile,
} from './fixtures'

function snapshots(overrides: Partial<ProfileSnapshots> = {}): ProfileSnapshots {
  return {
    machine: machineProfile(),
    product: productProfile(),
    packaging: packagingProfile(),
    controlPlan: controlPlanProfile(),
    instrument: instrumentProfile(),
    ...overrides,
  }
}

describe('schémas persistés', () => {
  it('accepte les profils complets de référence', () => {
    expect(machineProfileSchema.safeParse(machineProfile()).success).toBe(true)
    expect(productProfileSchema.safeParse(productProfile()).success).toBe(true)
    expect(packagingProfileSchema.safeParse(packagingProfile()).success).toBe(true)
  })

  it('refuse une tare fixe sans référence et une unité machine incohérente', () => {
    expect(
      packagingProfileSchema.safeParse(packagingProfile({ fixedTare: undefined })).success,
    ).toBe(false)
    expect(
      machineProfileSchema.safeParse(machineProfile({ setpointType: 'volume', unit: 'g' })).success,
    ).toBe(false)
  })
})

describe('invariants d’un contexte réel', () => {
  it('valide une combinaison vérifiée et compatible', () => {
    const result = validateContext({
      mode: 'real',
      context: {
        machineId: 'machine-1',
        productId: 'product-1',
        packagingId: 'packaging-1',
        controlPlanId: 'control-1',
        instrumentId: 'instrument-1',
      },
      profiles: snapshots(),
      now: new Date('2026-07-16T12:00:00.000Z'),
    })
    expect(result).toEqual({ valid: true, issues: [] })
  })

  it('bloque un profil brouillon et une balance invalide en mode réel', () => {
    const result = validateContext({
      mode: 'real',
      context: {
        machineId: 'machine-1',
        productId: 'product-1',
        packagingId: 'packaging-1',
        controlPlanId: 'control-1',
        instrumentId: 'instrument-1',
      },
      profiles: snapshots({
        product: productProfile({ status: 'draft' }),
        instrument: instrumentProfile({ verificationStatus: 'failed' }),
      }),
      now: new Date('2026-07-16T12:00:00.000Z'),
    })
    expect(result.valid).toBe(false)
    expect(result.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(['profile_not_verified', 'instrument_not_valid']),
    )
  })

  it('avertit sans inventer de correction thermique', () => {
    const result = validateContext({
      mode: 'real',
      context: {
        machineId: 'machine-1',
        productId: 'product-1',
        packagingId: 'packaging-1',
        controlPlanId: 'control-1',
        instrumentId: 'instrument-1',
        productTemperatureC: '25',
      },
      profiles: snapshots(),
      now: new Date('2026-07-16T12:00:00.000Z'),
    })
    expect(result.valid).toBe(true)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'temperature_rule_missing', severity: 'warning' }),
    )
  })

  it('bloque un critère BRUT commun avec une tare individuelle', () => {
    const plan = controlPlanProfile()
    const result = validateContext({
      mode: 'real',
      context: {
        machineId: 'machine-1',
        productId: 'product-1',
        packagingId: 'packaging-1',
        controlPlanId: 'control-1',
        instrumentId: 'instrument-1',
      },
      profiles: snapshots({
        packaging: packagingProfile({ tareMode: 'paired', fixedTare: undefined }),
        controlPlan: controlPlanProfile({
          startCriterion: { ...plan.startCriterion, basis: 'gross_mass_g' },
        }),
      }),
      now: new Date('2026-07-16T12:00:00.000Z'),
    })
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: 'gross_target_requires_fixed_tare' }),
    )
  })
})

describe('historique compatible', () => {
  const key = buildHistoryCompatibilityKey({
    machine: machineProfile(),
    product: productProfile(),
    packaging: packagingProfile(),
    conditions: { speed: 'slow' },
  })

  const records: HistoryRecord[] = [
    {
      id: 'old',
      sessionId: 's-old',
      achievedAt: '2026-07-14T10:00:00.000Z',
      key,
      successfulSetting: '26',
      successfulSettingUnit: 'graduation',
      finalMeanNetMassG: '5.27',
      finalMeanVolumeMl: '5.1717',
      engineVersion: FILLING_ENGINE_VERSION,
    },
    {
      id: 'new',
      sessionId: 's-new',
      achievedAt: '2026-07-15T10:00:00.000Z',
      key,
      successfulSetting: '26.1',
      successfulSettingUnit: 'graduation',
      finalMeanNetMassG: '5.268',
      finalMeanVolumeMl: '5.1697',
      engineVersion: FILLING_ENGINE_VERSION,
    },
    {
      id: 'other-product',
      sessionId: 's-other',
      achievedAt: '2026-07-16T10:00:00.000Z',
      key: { ...key, productId: 'product-2' },
      successfulSetting: '20',
      successfulSettingUnit: 'graduation',
      finalMeanNetMassG: '4',
      finalMeanVolumeMl: '4',
      engineVersion: FILLING_ENGINE_VERSION,
    },
  ]

  it('exige le même contexte et renvoie le plus récent en premier', () => {
    expect(findCompatibleHistory(key, records).map((record) => record.id)).toEqual(['new', 'old'])
    expect(assessHistoryCompatibility(key, records[2].key)).toMatchObject({
      compatible: false,
      reasons: [{ code: 'product_mismatch' }],
    })
  })
})

describe('version moteur', () => {
  it('lit seulement la même version majeure', () => {
    expect(isEngineVersionReadable('1.8.2')).toBe(true)
    expect(isEngineVersionReadable('2.0.0')).toBe(false)
    expect(() => assertEngineVersionReadable('ancienne')).toThrow(/incompatible/)
  })
})
