import { webcrypto } from 'node:crypto'

import { beforeAll, describe, expect, it } from 'vitest'

import {
  MINIMUM_PBKDF2_ITERATIONS,
  createDataKey,
  rewrapDataKey,
  sha256Base64,
  timingSafeEqualBase64,
  unlockDataKey,
} from '../encryption'
import {
  DataCorruptionError,
  EncryptionLockedError,
  InvalidPassphraseError,
} from '../errors'

beforeAll(() => {
  if (!globalThis.crypto?.subtle) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto as unknown as Crypto,
    })
  }
})

describe('local data-key encryption', () => {
  it('round-trips JSON and removes access after lock', async () => {
    const enrollment = await createDataKey('phrase-secrete-de-test', {
      iterations: MINIMUM_PBKDF2_ITERATIONS,
    })
    const payload = await enrollment.cipher.encryptJson(
      { mass: '10.27', unit: 'g' },
      'record:session-1:1',
    )

    await expect(enrollment.cipher.decryptJson(payload, 'record:session-1:1')).resolves.toEqual({
      mass: '10.27',
      unit: 'g',
    })

    enrollment.cipher.lock()
    await expect(enrollment.cipher.decryptJson(payload, 'record:session-1:1')).rejects.toBeInstanceOf(
      EncryptionLockedError,
    )
  })

  it('rejects a wrong passphrase and binds ciphertext to its record context', async () => {
    const enrollment = await createDataKey('phrase-secrete-valide', {
      iterations: MINIMUM_PBKDF2_ITERATIONS,
    })
    const payload = await enrollment.cipher.encryptJson({ safe: true }, 'profiles/profile-1/1')

    await expect(
      unlockDataKey('phrase-secrete-erronee', enrollment.wrappedDataKey),
    ).rejects.toBeInstanceOf(InvalidPassphraseError)
    await expect(
      enrollment.cipher.decryptJson(payload, 'profiles/autre-profil/1'),
    ).rejects.toBeInstanceOf(DataCorruptionError)
  })

  it('rewraps the same data key without re-encrypting stored payloads', async () => {
    const enrollment = await createDataKey('ancienne-phrase-secrete', {
      iterations: MINIMUM_PBKDF2_ITERATIONS,
    })
    const payload = await enrollment.cipher.encryptJson({ iteration: 4 }, 'sessions/s-1/3')
    const rewrapped = await rewrapDataKey(enrollment.cipher, 'nouvelle-phrase-secrete', {
      iterations: MINIMUM_PBKDF2_ITERATIONS,
    })
    enrollment.cipher.lock()

    await expect(unlockDataKey('ancienne-phrase-secrete', rewrapped)).rejects.toBeInstanceOf(
      InvalidPassphraseError,
    )
    const unlocked = await unlockDataKey('nouvelle-phrase-secrete', rewrapped)
    await expect(unlocked.decryptJson(payload, 'sessions/s-1/3')).resolves.toEqual({ iteration: 4 })
    unlocked.lock()
  })

  it('compares SHA-256 checksums without accepting a changed value', async () => {
    const checksum = await sha256Base64('payload')
    const changed = await sha256Base64('payload-changed')
    expect(timingSafeEqualBase64(checksum, checksum)).toBe(true)
    expect(timingSafeEqualBase64(checksum, changed)).toBe(false)
    expect(timingSafeEqualBase64(checksum, 'not-base64%%%')).toBe(false)
  })
})
