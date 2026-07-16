import type { FillingDatabase } from './database'
import { StorageUnavailableError } from './errors'

export type StorageHealthStatus = 'healthy' | 'warning' | 'critical' | 'unavailable'

export interface StorageHealthReport {
  checkedAt: string
  status: StorageHealthStatus
  indexedDbAvailable: boolean
  databaseReadable: boolean
  persistenceApiAvailable: boolean
  persisted: boolean | null
  usageBytes: number | null
  quotaBytes: number | null
  usageRatio: number | null
  warnings: string[]
  error?: string
}

export interface StorageHealthOptions {
  warningRatio?: number
  criticalRatio?: number
  now?: () => Date
}

const DEFAULT_WARNING_RATIO = 0.8
const DEFAULT_CRITICAL_RATIO = 0.95

function storageManager(): StorageManager | undefined {
  return typeof navigator !== 'undefined' ? navigator.storage : undefined
}

function normalizeRatio(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new RangeError('Un seuil de quota doit être strictement compris entre 0 et 1.')
  }
  return value
}

export async function inspectStorageHealth(
  database?: FillingDatabase,
  options: StorageHealthOptions = {},
): Promise<StorageHealthReport> {
  const checkedAt = (options.now?.() ?? new Date()).toISOString()
  const warningRatio = normalizeRatio(options.warningRatio, DEFAULT_WARNING_RATIO)
  const criticalRatio = normalizeRatio(options.criticalRatio, DEFAULT_CRITICAL_RATIO)
  if (warningRatio >= criticalRatio) {
    throw new RangeError("Le seuil d'avertissement doit être inférieur au seuil critique.")
  }

  const warnings: string[] = []
  const indexedDbAvailable = typeof globalThis.indexedDB !== 'undefined'
  if (!indexedDbAvailable) {
    return {
      checkedAt,
      status: 'unavailable',
      indexedDbAvailable: false,
      databaseReadable: false,
      persistenceApiAvailable: false,
      persisted: null,
      usageBytes: null,
      quotaBytes: null,
      usageRatio: null,
      warnings: ['IndexedDB est indisponible. Aucun réglage ne doit être commencé.'],
    }
  }

  let databaseReadable = !database
  let readError: unknown
  if (database) {
    try {
      const transaction = database.transaction(
        ['profiles', 'sessions', 'events', 'settings'],
        'readonly',
      )
      await Promise.all([
        transaction.objectStore('profiles').count(),
        transaction.objectStore('sessions').count(),
        transaction.objectStore('events').count(),
        transaction.objectStore('settings').count(),
        transaction.done,
      ])
      databaseReadable = true
    } catch (error) {
      readError = error
      warnings.push('La base locale ne répond pas correctement.')
    }
  }

  const manager = storageManager()
  const persistenceApiAvailable = Boolean(manager?.persist && manager.persisted)
  let persisted: boolean | null = null
  let usageBytes: number | null = null
  let quotaBytes: number | null = null
  let usageRatio: number | null = null

  if (manager) {
    try {
      if (manager.persisted) {
        persisted = await manager.persisted()
      }
      const estimate = await manager.estimate()
      usageBytes = estimate.usage ?? null
      quotaBytes = estimate.quota ?? null
      if (usageBytes !== null && quotaBytes !== null && quotaBytes > 0) {
        usageRatio = usageBytes / quotaBytes
      }
    } catch (error) {
      warnings.push("L'état du quota navigateur n'a pas pu être déterminé.")
      readError ??= error
    }
  } else {
    warnings.push("L'API de persistance du navigateur est indisponible.")
  }

  if (persisted === false) {
    warnings.push("Le navigateur n'a pas garanti la persistance de ces données.")
  }
  if (usageRatio !== null && usageRatio >= warningRatio) {
    warnings.push(`Le stockage utilise ${Math.round(usageRatio * 100)} % du quota disponible.`)
  }

  let status: StorageHealthStatus = 'healthy'
  if (!databaseReadable) {
    status = 'unavailable'
  } else if (usageRatio !== null && usageRatio >= criticalRatio) {
    status = 'critical'
  } else if (warnings.length > 0) {
    status = 'warning'
  }

  return {
    checkedAt,
    status,
    indexedDbAvailable,
    databaseReadable,
    persistenceApiAvailable,
    persisted,
    usageBytes,
    quotaBytes,
    usageRatio,
    warnings,
    error: readError instanceof Error ? readError.message : undefined,
  }
}

export type PersistenceRequestResult =
  | 'already-persistent'
  | 'granted'
  | 'denied'
  | 'unsupported'

export async function requestPersistentStorage(): Promise<PersistenceRequestResult> {
  const manager = storageManager()
  if (!manager?.persist || !manager.persisted) {
    return 'unsupported'
  }

  try {
    if (await manager.persisted()) {
      return 'already-persistent'
    }
    return (await manager.persist()) ? 'granted' : 'denied'
  } catch (error) {
    throw new StorageUnavailableError(
      "Le navigateur n'a pas pu traiter la demande de stockage persistant.",
      error,
    )
  }
}

export function assertStorageCanAcceptCriticalWrite(report: StorageHealthReport): void {
  if (!report.indexedDbAvailable || !report.databaseReadable || report.status === 'unavailable') {
    throw new StorageUnavailableError('Le stockage local ne peut pas confirmer une nouvelle écriture.')
  }
  if (report.status === 'critical') {
    throw new StorageUnavailableError(
      "Le quota de stockage est critique. Exportez une sauvegarde avant de poursuivre.",
    )
  }
}
