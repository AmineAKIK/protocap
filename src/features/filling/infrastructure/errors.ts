/**
 * Errors raised by the filling storage layer are deliberately typed. The UI
 * must never turn a failed write or a corrupt record into an empty/default
 * value: callers can surface the exact recovery action instead.
 */
export class FillingStorageError extends Error {
  readonly code: string
  readonly cause?: unknown

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'FillingStorageError'
    this.code = code
    this.cause = options?.cause
  }
}

export class StorageUnavailableError extends FillingStorageError {
  constructor(message = 'Le stockage local IndexedDB est indisponible.', cause?: unknown) {
    super('storage_unavailable', message, { cause })
    this.name = 'StorageUnavailableError'
  }
}

export class StorageBlockedError extends FillingStorageError {
  constructor(message = 'La base locale est ouverte dans un autre onglet et bloque sa mise à jour.') {
    super('storage_blocked', message)
    this.name = 'StorageBlockedError'
  }
}

export class StorageQuotaError extends FillingStorageError {
  constructor(message = "L'espace de stockage local est insuffisant pour sécuriser cette écriture.", cause?: unknown) {
    super('storage_quota_exceeded', message, { cause })
    this.name = 'StorageQuotaError'
  }
}

export class StorageWriteError extends FillingStorageError {
  constructor(message = "L'écriture locale n'a pas pu être confirmée.", cause?: unknown) {
    super('storage_write_failed', message, { cause })
    this.name = 'StorageWriteError'
  }
}

export class StorageReadError extends FillingStorageError {
  constructor(message = 'La lecture locale a échoué.', cause?: unknown) {
    super('storage_read_failed', message, { cause })
    this.name = 'StorageReadError'
  }
}

export class RevisionConflictError extends FillingStorageError {
  readonly collection: string
  readonly entityId: string
  readonly expectedRevision: number
  readonly actualRevision: number

  constructor(
    collection: string,
    entityId: string,
    expectedRevision: number,
    actualRevision: number,
  ) {
    super(
      'revision_conflict',
      `Conflit d'écriture sur ${collection}/${entityId} : révision attendue ${expectedRevision}, révision actuelle ${actualRevision}.`,
    )
    this.name = 'RevisionConflictError'
    this.collection = collection
    this.entityId = entityId
    this.expectedRevision = expectedRevision
    this.actualRevision = actualRevision
  }
}

export class DuplicateMutationError extends FillingStorageError {
  constructor(collection: string, entityId: string) {
    super(
      'duplicate_mutation',
      `La transaction contient plusieurs écritures concurrentes pour ${collection}/${entityId}.`,
    )
    this.name = 'DuplicateMutationError'
  }
}

export class AppendOnlyViolationError extends FillingStorageError {
  constructor(entityId: string) {
    super('append_only_violation', `L'événement ${entityId} existe déjà et ne peut pas être modifié.`)
    this.name = 'AppendOnlyViolationError'
  }
}

export class DataCorruptionError extends FillingStorageError {
  readonly collection?: string
  readonly entityId?: string

  constructor(message: string, options?: { collection?: string; entityId?: string; cause?: unknown }) {
    super('data_corruption', message, { cause: options?.cause })
    this.name = 'DataCorruptionError'
    this.collection = options?.collection
    this.entityId = options?.entityId
  }
}

export class EncryptionLockedError extends FillingStorageError {
  constructor() {
    super('encryption_locked', 'Le stockage chiffré est verrouillé.')
    this.name = 'EncryptionLockedError'
  }
}

export class EncryptionUnavailableError extends FillingStorageError {
  constructor(cause?: unknown) {
    super('encryption_unavailable', "WebCrypto n'est pas disponible sur cet appareil.", { cause })
    this.name = 'EncryptionUnavailableError'
  }
}

export class InvalidPassphraseError extends FillingStorageError {
  constructor(cause?: unknown) {
    super('invalid_passphrase', 'La phrase secrète est incorrecte ou la clé locale est endommagée.', { cause })
    this.name = 'InvalidPassphraseError'
  }
}

export class BackupValidationError extends FillingStorageError {
  constructor(message: string, cause?: unknown) {
    super('backup_validation_failed', message, { cause })
    this.name = 'BackupValidationError'
  }
}

export function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && (error.name === 'QuotaExceededError' || error.code === 22)
}
