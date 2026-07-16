import { webcrypto } from 'node:crypto'

import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  exportEncryptedBackup,
  previewEncryptedBackup,
  restoreEncryptedBackup,
} from '../backup'
import { BackupValidationError } from '../errors'
import {
  LOGICAL_SNAPSHOT_VERSION,
  type FillingRepositories,
  type LogicalStorageSnapshot,
} from '../repositories'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto as unknown as Crypto,
    })
  }
})

const emptySnapshot: LogicalStorageSnapshot = {
  version: LOGICAL_SNAPSHOT_VERSION,
  profiles: [],
  sessions: [],
  events: [],
  settings: null,
}

function repositoryDouble() {
  const replaceAllFromSnapshot = vi.fn(async () => undefined)
  const repositories = {
    snapshot: vi.fn(async () => emptySnapshot),
    validateSnapshot: vi.fn((value: unknown) => {
      if (!value || typeof value !== 'object' || !('version' in value)) {
        throw new Error('invalid snapshot')
      }
      return value as LogicalStorageSnapshot
    }),
    replaceAllFromSnapshot,
  } as unknown as FillingRepositories
  return { repositories, replaceAllFromSnapshot }
}

describe('encrypted backup', () => {
  it('exports, previews, and restores only after full validation', async () => {
    const { repositories, replaceAllFromSnapshot } = repositoryDouble()
    const serialized = await exportEncryptedBackup(repositories, 'phrase-backup-securisee', {
      iterations: 100_000,
      now: () => new Date('2026-07-16T10:00:00.000Z'),
    })
    expect(serialized).not.toContain('"profiles": []')

    const preview = await previewEncryptedBackup(
      serialized,
      'phrase-backup-securisee',
      repositories,
    )
    expect(preview.manifest.recordCounts).toEqual({
      profiles: 0,
      sessions: 0,
      events: 0,
      settings: 0,
    })

    await restoreEncryptedBackup(repositories, preview)
    expect(replaceAllFromSnapshot).toHaveBeenCalledOnce()
  })

  it('rejects a changed ciphertext before attempting a restore', async () => {
    const { repositories } = repositoryDouble()
    const serialized = await exportEncryptedBackup(repositories, 'phrase-backup-securisee', {
      iterations: 100_000,
    })
    const file = JSON.parse(serialized) as {
      encryptedPayload: { ciphertext: string }
    }
    const original = file.encryptedPayload.ciphertext
    file.encryptedPayload.ciphertext = `${original.slice(0, -1)}${original.endsWith('A') ? 'B' : 'A'}`

    await expect(
      previewEncryptedBackup(JSON.stringify(file), 'phrase-backup-securisee', repositories),
    ).rejects.toBeInstanceOf(BackupValidationError)
  })

  it('does not accept a wrong backup passphrase', async () => {
    const { repositories } = repositoryDouble()
    const serialized = await exportEncryptedBackup(repositories, 'phrase-backup-securisee', {
      iterations: 100_000,
    })
    await expect(
      previewEncryptedBackup(serialized, 'autre-phrase-secrete', repositories),
    ).rejects.toBeInstanceOf(BackupValidationError)
  })
})
