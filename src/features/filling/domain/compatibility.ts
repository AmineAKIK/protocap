import type {
  HistoryCompatibilityKey,
  HistoryRecord,
  MachineProfile,
  PackagingProfile,
  ProductProfile,
} from './models'

export type HistoryIncompatibilityCode =
  | 'machine_mismatch'
  | 'product_mismatch'
  | 'packaging_mismatch'
  | 'head_mismatch'
  | 'calibration_mismatch'
  | 'product_version_mismatch'
  | 'machine_version_mismatch'
  | 'packaging_version_mismatch'
  | 'condition_mismatch'

export interface HistoryCompatibilityAssessment {
  compatible: boolean
  reasons: Array<{
    code: HistoryIncompatibilityCode
    message: string
  }>
}

export interface FindCompatibleHistoryOptions {
  /** When false, version fields in the query are informative only. */
  requireExactProfileVersions?: boolean
  limit?: number
}

function differentOptional(a: string | undefined, b: string | undefined): boolean {
  return a !== b
}

export function assessHistoryCompatibility(
  query: HistoryCompatibilityKey,
  candidate: HistoryCompatibilityKey,
  options: FindCompatibleHistoryOptions = {},
): HistoryCompatibilityAssessment {
  const reasons: HistoryCompatibilityAssessment['reasons'] = []

  if (candidate.machineId !== query.machineId) {
    reasons.push({ code: 'machine_mismatch', message: 'Machine différente.' })
  }
  if (candidate.productId !== query.productId) {
    reasons.push({ code: 'product_mismatch', message: 'Produit différent.' })
  }
  if (candidate.packagingId !== query.packagingId) {
    reasons.push({ code: 'packaging_mismatch', message: 'Format d’emballage différent.' })
  }
  if (differentOptional(candidate.headId, query.headId)) {
    reasons.push({ code: 'head_mismatch', message: 'Tête de remplissage différente.' })
  }
  if (differentOptional(candidate.calibrationId, query.calibrationId)) {
    reasons.push({ code: 'calibration_mismatch', message: 'Calibration différente.' })
  }

  if (options.requireExactProfileVersions) {
    if (differentOptional(candidate.productProfileVersion, query.productProfileVersion)) {
      reasons.push({ code: 'product_version_mismatch', message: 'Version produit différente.' })
    }
    if (differentOptional(candidate.machineProfileVersion, query.machineProfileVersion)) {
      reasons.push({ code: 'machine_version_mismatch', message: 'Version machine différente.' })
    }
    if (differentOptional(candidate.packagingProfileVersion, query.packagingProfileVersion)) {
      reasons.push({ code: 'packaging_version_mismatch', message: 'Version emballage différente.' })
    }
  }

  for (const [condition, expected] of Object.entries(query.conditions ?? {})) {
    if (candidate.conditions?.[condition] !== expected) {
      reasons.push({
        code: 'condition_mismatch',
        message: `Condition ${condition} différente ou absente.`,
      })
    }
  }

  return { compatible: reasons.length === 0, reasons }
}

export function findCompatibleHistory(
  query: HistoryCompatibilityKey,
  records: HistoryRecord[],
  options: FindCompatibleHistoryOptions = {},
): HistoryRecord[] {
  const limit = options.limit ?? records.length
  if (!Number.isInteger(limit) || limit < 0) return []

  return records
    .filter((record) => assessHistoryCompatibility(query, record.key, options).compatible)
    .sort((left, right) => right.achievedAt.localeCompare(left.achievedAt))
    .slice(0, limit)
}

export function buildHistoryCompatibilityKey(input: {
  machine: MachineProfile
  product: ProductProfile
  packaging: PackagingProfile
  headId?: string
  calibrationId?: string
  conditions?: Record<string, string>
}): HistoryCompatibilityKey {
  return {
    machineId: input.machine.id,
    productId: input.product.id,
    packagingId: input.packaging.id,
    headId: input.headId,
    calibrationId: input.calibrationId,
    productProfileVersion: input.product.version,
    machineProfileVersion: input.machine.version,
    packagingProfileVersion: input.packaging.version,
    conditions: input.conditions,
  }
}

