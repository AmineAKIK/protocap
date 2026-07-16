import {
  appSettingsSchema,
  calibrationProfileSchema,
  controlPlanProfileSchema,
  eventLogSchema,
  instrumentProfileSchema,
  machineProfileSchema,
  packagingProfileSchema,
  productProfileSchema,
  setupSessionSchema,
} from '../domain/schemas'
import {
  openFillingDatabase,
  type FillingDatabase,
  type OpenFillingDatabaseOptions,
} from './database'
import type { StorageCipher, WrappedDataKey } from './encryption'
import {
  FillingRepositories,
  initializeLocalEncryption,
  unlockLocalEncryption,
  type FillingDocumentSchemas,
} from './repositories'
import {
  requestPersistentStorage,
  type PersistenceRequestResult,
} from './storageHealth'

export const fillingDocumentSchemas: FillingDocumentSchemas = {
  profiles: {
    machine: machineProfileSchema,
    product: productProfileSchema,
    packaging: packagingProfileSchema,
    controlPlan: controlPlanProfileSchema,
    instrument: instrumentProfileSchema,
    calibration: calibrationProfileSchema,
  },
  session: setupSessionSchema,
  event: eventLogSchema,
  settings: appSettingsSchema,
}

export interface CreateRepositoriesOptions {
  schemas?: FillingDocumentSchemas
  now?: () => Date
}

export function createFillingRepositories(
  database: FillingDatabase,
  cipher: StorageCipher,
  options: CreateRepositoriesOptions = {},
): FillingRepositories {
  return new FillingRepositories(
    database,
    cipher,
    options.schemas ?? fillingDocumentSchemas,
    options.now,
  )
}

export interface FillingStorageHandle {
  database: FillingDatabase
  cipher: StorageCipher
  repositories: FillingRepositories
  wrappedDataKey: WrappedDataKey
  envelopeRevision: number
  persistence: PersistenceRequestResult
  lock: () => void
}

export interface OpenEncryptedStorageOptions extends OpenFillingDatabaseOptions {
  schemas?: FillingDocumentSchemas
  now?: () => Date
  requestPersistence?: boolean
}

async function persistenceResult(requestPersistence: boolean | undefined): Promise<PersistenceRequestResult> {
  if (requestPersistence === false) return 'unsupported'
  return requestPersistentStorage()
}

export async function initializeFillingStorage(
  passphrase: string,
  options: OpenEncryptedStorageOptions & { iterations?: number } = {},
): Promise<FillingStorageHandle> {
  const database = await openFillingDatabase(options)
  try {
    const enrollment = await initializeLocalEncryption(database, passphrase, {
      iterations: options.iterations,
      now: options.now,
    })
    const repositories = createFillingRepositories(database, enrollment.cipher, options)
    return {
      database,
      cipher: enrollment.cipher,
      repositories,
      wrappedDataKey: enrollment.wrappedDataKey,
      envelopeRevision: enrollment.envelopeRevision,
      persistence: await persistenceResult(options.requestPersistence),
      lock: () => repositories.close(),
    }
  } catch (error) {
    database.close()
    throw error
  }
}

export async function unlockFillingStorage(
  passphrase: string,
  options: OpenEncryptedStorageOptions = {},
): Promise<FillingStorageHandle> {
  const database = await openFillingDatabase(options)
  try {
    const enrollment = await unlockLocalEncryption(database, passphrase)
    const repositories = createFillingRepositories(database, enrollment.cipher, options)
    return {
      database,
      cipher: enrollment.cipher,
      repositories,
      wrappedDataKey: enrollment.wrappedDataKey,
      envelopeRevision: enrollment.envelopeRevision,
      persistence: await persistenceResult(options.requestPersistence),
      lock: () => repositories.close(),
    }
  } catch (error) {
    database.close()
    throw error
  }
}
