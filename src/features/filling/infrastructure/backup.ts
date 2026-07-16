import { z } from 'zod'

import {
  ENCRYPTION_FORMAT_VERSION,
  EncryptedJsonPayloadSchema,
  WrappedDataKeySchema,
  createDataKey,
  sha256Base64,
  timingSafeEqualBase64,
  unlockDataKey,
  type EncryptedJsonPayload,
  type WrappedDataKey,
} from './encryption'
import { DATABASE_VERSION } from './databaseSchema'
import { BackupValidationError, DataCorruptionError } from './errors'
import {
  LOGICAL_SNAPSHOT_VERSION,
  type FillingRepositories,
  type LogicalStorageSnapshot,
} from './repositories'

export const BACKUP_FORMAT = 'protocap.filling.backup' as const
export const BACKUP_FORMAT_VERSION = 1 as const
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024

export const BackupRecordCountsSchema = z
  .object({
    profiles: z.number().int().nonnegative(),
    sessions: z.number().int().nonnegative(),
    events: z.number().int().nonnegative(),
    settings: z.number().int().min(0).max(1),
  })
  .strict()

export type BackupRecordCounts = z.infer<typeof BackupRecordCountsSchema>

export const BackupManifestSchema = z
  .object({
    format: z.literal(BACKUP_FORMAT),
    version: z.literal(BACKUP_FORMAT_VERSION),
    createdAt: z.string().datetime({ offset: true }),
    databaseVersion: z.number().int().positive(),
    snapshotVersion: z.literal(LOGICAL_SNAPSHOT_VERSION),
    encryptionVersion: z.literal(ENCRYPTION_FORMAT_VERSION),
    checksumAlgorithm: z.literal('SHA-256'),
    encryptedPayloadChecksum: z.string().min(1),
    recordCounts: BackupRecordCountsSchema,
  })
  .strict()

export type BackupManifest = z.infer<typeof BackupManifestSchema>

export const EncryptedBackupFileSchema = z
  .object({
    manifest: BackupManifestSchema,
    wrappedDataKey: WrappedDataKeySchema,
    encryptedPayload: EncryptedJsonPayloadSchema,
  })
  .strict()

export interface EncryptedBackupFile {
  manifest: BackupManifest
  wrappedDataKey: WrappedDataKey
  encryptedPayload: EncryptedJsonPayload
}

export interface BackupPreview {
  manifest: BackupManifest
  snapshot: LogicalStorageSnapshot
  sourceByteLength: number
}

function countSnapshot(snapshot: LogicalStorageSnapshot): BackupRecordCounts {
  return {
    profiles: snapshot.profiles.length,
    sessions: snapshot.sessions.length,
    events: snapshot.events.length,
    settings: snapshot.settings ? 1 : 0,
  }
}

function countsMatch(left: BackupRecordCounts, right: BackupRecordCounts): boolean {
  return (
    left.profiles === right.profiles &&
    left.sessions === right.sessions &&
    left.events === right.events &&
    left.settings === right.settings
  )
}

function backupAdditionalData(manifest: Omit<BackupManifest, 'encryptedPayloadChecksum'>): string {
  const counts = manifest.recordCounts
  return [
    manifest.format,
    manifest.version,
    manifest.createdAt,
    manifest.databaseVersion,
    manifest.snapshotVersion,
    manifest.encryptionVersion,
    manifest.checksumAlgorithm,
    counts.profiles,
    counts.sessions,
    counts.events,
    counts.settings,
  ].join('|')
}

function payloadChecksumInput(payload: EncryptedJsonPayload): string {
  return [payload.format, payload.version, payload.keyId, payload.iv, payload.ciphertext].join('|')
}

function textByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

export async function exportEncryptedBackup(
  repositories: FillingRepositories,
  backupPassphrase: string,
  options: { now?: () => Date; iterations?: number } = {},
): Promise<string> {
  const snapshot = repositories.validateSnapshot(await repositories.snapshot())
  const createdAt = (options.now?.() ?? new Date()).toISOString()
  const manifestWithoutChecksum: Omit<BackupManifest, 'encryptedPayloadChecksum'> = {
    format: BACKUP_FORMAT,
    version: BACKUP_FORMAT_VERSION,
    createdAt,
    databaseVersion: DATABASE_VERSION,
    snapshotVersion: LOGICAL_SNAPSHOT_VERSION,
    encryptionVersion: ENCRYPTION_FORMAT_VERSION,
    checksumAlgorithm: 'SHA-256',
    recordCounts: countSnapshot(snapshot),
  }

  const backupKey = await createDataKey(backupPassphrase, {
    iterations: options.iterations,
    now: () => new Date(createdAt),
  })
  try {
    const encryptedPayload = await backupKey.cipher.encryptJson(
      snapshot,
      backupAdditionalData(manifestWithoutChecksum),
    )
    const encryptedPayloadChecksum = await sha256Base64(payloadChecksumInput(encryptedPayload))
    const file: EncryptedBackupFile = {
      manifest: BackupManifestSchema.parse({
        ...manifestWithoutChecksum,
        encryptedPayloadChecksum,
      }),
      wrappedDataKey: backupKey.wrappedDataKey,
      encryptedPayload,
    }
    return JSON.stringify(EncryptedBackupFileSchema.parse(file), null, 2)
  } finally {
    backupKey.cipher.lock()
  }
}

export async function previewEncryptedBackup(
  serializedBackup: string,
  backupPassphrase: string,
  repositories: FillingRepositories,
): Promise<BackupPreview> {
  const sourceByteLength = textByteLength(serializedBackup)
  if (sourceByteLength > MAX_BACKUP_FILE_BYTES) {
    throw new BackupValidationError(
      `La sauvegarde dépasse la limite de ${Math.floor(MAX_BACKUP_FILE_BYTES / 1024 / 1024)} Mo.`,
    )
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(serializedBackup) as unknown
  } catch (error) {
    throw new BackupValidationError("Le fichier de sauvegarde n'est pas un JSON valide.", error)
  }

  let file: EncryptedBackupFile
  try {
    file = EncryptedBackupFileSchema.parse(parsedJson)
  } catch (error) {
    throw new BackupValidationError("Le manifeste de sauvegarde est invalide ou incompatible.", error)
  }

  if (file.manifest.databaseVersion > DATABASE_VERSION) {
    throw new BackupValidationError(
      `La sauvegarde nécessite une version de base ${file.manifest.databaseVersion}, plus récente que ${DATABASE_VERSION}.`,
    )
  }

  const checksum = await sha256Base64(payloadChecksumInput(file.encryptedPayload))
  if (!timingSafeEqualBase64(checksum, file.manifest.encryptedPayloadChecksum)) {
    throw new BackupValidationError('Le checksum de la sauvegarde ne correspond pas au contenu chiffré.')
  }

  const { encryptedPayloadChecksum: _checksum, ...manifestWithoutChecksum } = file.manifest
  let backupCipher
  try {
    backupCipher = await unlockDataKey(backupPassphrase, file.wrappedDataKey)
  } catch (error) {
    throw new BackupValidationError(
      'La sauvegarde est illisible : phrase secrète incorrecte ou clé altérée.',
      error,
    )
  }
  let decrypted: unknown
  try {
    decrypted = await backupCipher.decryptJson(
      file.encryptedPayload,
      backupAdditionalData(manifestWithoutChecksum),
    )
  } catch (error) {
    if (error instanceof DataCorruptionError) {
      throw new BackupValidationError(
        'La sauvegarde est illisible : phrase secrète incorrecte ou contenu altéré.',
        error,
      )
    }
    throw error
  } finally {
    backupCipher.lock()
  }

  let snapshot: LogicalStorageSnapshot
  try {
    snapshot = repositories.validateSnapshot(decrypted)
  } catch (error) {
    throw new BackupValidationError('Le contenu déchiffré ne respecte pas les schémas métier.', error)
  }
  const actualCounts = countSnapshot(snapshot)
  if (!countsMatch(actualCounts, file.manifest.recordCounts)) {
    throw new BackupValidationError(
      "Les quantités annoncées dans le manifeste ne correspondent pas au contenu de la sauvegarde.",
    )
  }

  return { manifest: file.manifest, snapshot, sourceByteLength }
}

/** Restore is deliberately replace-only: no implicit merge can mix two histories. */
export async function restoreEncryptedBackup(
  repositories: FillingRepositories,
  preview: BackupPreview,
): Promise<void> {
  const expectedCounts = preview.manifest.recordCounts
  const snapshot = repositories.validateSnapshot(preview.snapshot)
  if (!countsMatch(countSnapshot(snapshot), expectedCounts)) {
    throw new BackupValidationError('Le contenu préparé a changé depuis son aperçu.')
  }
  await repositories.replaceAllFromSnapshot(snapshot)
}
