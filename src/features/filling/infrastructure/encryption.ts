import { z } from 'zod'

import {
  DataCorruptionError,
  EncryptionLockedError,
  EncryptionUnavailableError,
  InvalidPassphraseError,
} from './errors'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder('utf-8', { fatal: true })
const DATA_KEY_AAD = TEXT_ENCODER.encode('protocap:filling:data-key:v1')

export const ENCRYPTION_FORMAT_VERSION = 1 as const
export const DEFAULT_PBKDF2_ITERATIONS = 310_000
export const MINIMUM_PBKDF2_ITERATIONS = 100_000
export const MAXIMUM_PBKDF2_ITERATIONS = 1_000_000

export const WrappedDataKeySchema = z
  .object({
    format: z.literal('protocap.filling.wrapped-data-key'),
    version: z.literal(ENCRYPTION_FORMAT_VERSION),
    keyId: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
    kdf: z.literal('PBKDF2-SHA-256'),
    iterations: z.number().int().min(MINIMUM_PBKDF2_ITERATIONS).max(MAXIMUM_PBKDF2_ITERATIONS),
    salt: z.string().min(1),
    wrappingAlgorithm: z.literal('AES-GCM-256'),
    iv: z.string().min(1),
    wrappedKey: z.string().min(1),
  })
  .strict()

export type WrappedDataKey = z.infer<typeof WrappedDataKeySchema>

export const EncryptedJsonPayloadSchema = z
  .object({
    format: z.literal('protocap.filling.aes-gcm-json'),
    version: z.literal(ENCRYPTION_FORMAT_VERSION),
    keyId: z.string().min(1),
    iv: z.string().min(1),
    ciphertext: z.string().min(1),
  })
  .strict()

export type EncryptedJsonPayload = z.infer<typeof EncryptedJsonPayloadSchema>

function getWebCrypto(): Crypto {
  const webCrypto = globalThis.crypto
  if (!webCrypto?.subtle || !webCrypto.getRandomValues) {
    throw new EncryptionUnavailableError()
  }
  return webCrypto
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  getWebCrypto().getRandomValues(bytes)
  return bytes
}

/** DOM WebCrypto intentionally rejects SharedArrayBuffer-backed views. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function createId(): string {
  const webCrypto = getWebCrypto()
  if (typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  return bytesToHex(randomBytes(16))
}

function normalizePassphrase(passphrase: string): string {
  const normalized = passphrase.normalize('NFKC')
  if (normalized.length < 8) {
    throw new InvalidPassphraseError(
      new Error('La phrase secrète locale doit contenir au moins huit caractères.'),
    )
  }
  return normalized
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch (error) {
    throw new DataCorruptionError('Une valeur chiffrée contient un encodage Base64 invalide.', {
      cause: error,
    })
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function deriveWrappingKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const subtle = getWebCrypto().subtle
  const material = await subtle.importKey(
    'raw',
    toArrayBuffer(TEXT_ENCODER.encode(normalizePassphrase(passphrase))),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function importDataKey(rawKey: Uint8Array): Promise<CryptoKey> {
  return getWebCrypto().subtle.importKey(
    'raw',
    toArrayBuffer(rawKey),
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt'],
  )
}

async function wrapRawDataKey(
  rawKey: Uint8Array,
  passphrase: string,
  keyId: string,
  iterations: number,
  createdAt: string,
): Promise<WrappedDataKey> {
  if (
    !Number.isInteger(iterations) ||
    iterations < MINIMUM_PBKDF2_ITERATIONS ||
    iterations > MAXIMUM_PBKDF2_ITERATIONS
  ) {
    throw new RangeError(
      `Le nombre d'itérations PBKDF2 doit être compris entre ${MINIMUM_PBKDF2_ITERATIONS} et ${MAXIMUM_PBKDF2_ITERATIONS}.`,
    )
  }

  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const wrappingKey = await deriveWrappingKey(passphrase, salt, iterations)
  const wrappedKey = await getWebCrypto().subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      additionalData: toArrayBuffer(DATA_KEY_AAD),
      tagLength: 128,
    },
    wrappingKey,
    toArrayBuffer(rawKey),
  )

  return WrappedDataKeySchema.parse({
    format: 'protocap.filling.wrapped-data-key',
    version: ENCRYPTION_FORMAT_VERSION,
    keyId,
    createdAt,
    kdf: 'PBKDF2-SHA-256',
    iterations,
    salt: bytesToBase64(salt),
    wrappingAlgorithm: 'AES-GCM-256',
    iv: bytesToBase64(iv),
    wrappedKey: bytesToBase64(new Uint8Array(wrappedKey)),
  })
}

/**
 * Holds the unlocked data key only in memory. Calling lock() drops the
 * reference; the phrase secret and the raw data key are never persisted.
 */
export class StorageCipher {
  readonly keyId: string
  #dataKey: CryptoKey | null

  constructor(keyId: string, dataKey: CryptoKey) {
    this.keyId = keyId
    this.#dataKey = dataKey
  }

  get isUnlocked(): boolean {
    return this.#dataKey !== null
  }

  lock(): void {
    this.#dataKey = null
  }

  async encryptJson(value: unknown, additionalData: string): Promise<EncryptedJsonPayload> {
    const key = this.#requireKey()
    const iv = randomBytes(12)
    let serialized: string
    try {
      serialized = JSON.stringify(value)
    } catch (error) {
      throw new DataCorruptionError("La donnée ne peut pas être sérialisée avant chiffrement.", {
        cause: error,
      })
    }
    if (serialized === undefined) {
      throw new DataCorruptionError("Une valeur undefined ne peut pas être chiffrée.")
    }

    const ciphertext = await getWebCrypto().subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(TEXT_ENCODER.encode(additionalData)),
        tagLength: 128,
      },
      key,
      toArrayBuffer(TEXT_ENCODER.encode(serialized)),
    )

    return EncryptedJsonPayloadSchema.parse({
      format: 'protocap.filling.aes-gcm-json',
      version: ENCRYPTION_FORMAT_VERSION,
      keyId: this.keyId,
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    })
  }

  async decryptJson(payloadInput: EncryptedJsonPayload, additionalData: string): Promise<unknown> {
    const key = this.#requireKey()
    const payload = EncryptedJsonPayloadSchema.parse(payloadInput)
    if (payload.keyId !== this.keyId) {
      throw new DataCorruptionError(
        `La donnée utilise la clé ${payload.keyId}, mais la clé déverrouillée est ${this.keyId}.`,
      )
    }

    try {
      const plaintext = await getWebCrypto().subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: toArrayBuffer(base64ToBytes(payload.iv)),
          additionalData: toArrayBuffer(TEXT_ENCODER.encode(additionalData)),
          tagLength: 128,
        },
        key,
        toArrayBuffer(base64ToBytes(payload.ciphertext)),
      )
      return JSON.parse(TEXT_DECODER.decode(plaintext)) as unknown
    } catch (error) {
      if (error instanceof DataCorruptionError) {
        throw error
      }
      throw new DataCorruptionError(
        "La donnée chiffrée est altérée, associée à un autre enregistrement ou illisible.",
        { cause: error },
      )
    }
  }

  async exportRawKeyForRewrap(): Promise<Uint8Array> {
    const exported = await getWebCrypto().subtle.exportKey('raw', this.#requireKey())
    return new Uint8Array(exported)
  }

  #requireKey(): CryptoKey {
    if (!this.#dataKey) {
      throw new EncryptionLockedError()
    }
    return this.#dataKey
  }
}

export interface NewDataKeyResult {
  cipher: StorageCipher
  wrappedDataKey: WrappedDataKey
}

export async function createDataKey(
  passphrase: string,
  options: { iterations?: number; now?: () => Date } = {},
): Promise<NewDataKeyResult> {
  const rawKey = randomBytes(32)
  const keyId = createId()
  const createdAt = (options.now?.() ?? new Date()).toISOString()
  try {
    const [dataKey, wrappedDataKey] = await Promise.all([
      importDataKey(rawKey),
      wrapRawDataKey(
        rawKey,
        passphrase,
        keyId,
        options.iterations ?? DEFAULT_PBKDF2_ITERATIONS,
        createdAt,
      ),
    ])
    return { cipher: new StorageCipher(keyId, dataKey), wrappedDataKey }
  } finally {
    rawKey.fill(0)
  }
}

export async function unlockDataKey(
  passphrase: string,
  envelopeInput: WrappedDataKey,
): Promise<StorageCipher> {
  const envelope = WrappedDataKeySchema.parse(envelopeInput)
  let rawKey: Uint8Array | undefined
  try {
    const wrappingKey = await deriveWrappingKey(
      passphrase,
      base64ToBytes(envelope.salt),
      envelope.iterations,
    )
    const decrypted = await getWebCrypto().subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: toArrayBuffer(base64ToBytes(envelope.iv)),
        additionalData: toArrayBuffer(DATA_KEY_AAD),
        tagLength: 128,
      },
      wrappingKey,
      toArrayBuffer(base64ToBytes(envelope.wrappedKey)),
    )
    rawKey = new Uint8Array(decrypted)
    if (rawKey.length !== 32) {
      throw new Error('Longueur de clé AES inattendue.')
    }
    return new StorageCipher(envelope.keyId, await importDataKey(rawKey))
  } catch (error) {
    if (error instanceof EncryptionUnavailableError) {
      throw error
    }
    throw new InvalidPassphraseError(error)
  } finally {
    rawKey?.fill(0)
  }
}

export async function rewrapDataKey(
  cipher: StorageCipher,
  newPassphrase: string,
  options: { iterations?: number; now?: () => Date } = {},
): Promise<WrappedDataKey> {
  const rawKey = await cipher.exportRawKeyForRewrap()
  try {
    return await wrapRawDataKey(
      rawKey,
      newPassphrase,
      cipher.keyId,
      options.iterations ?? DEFAULT_PBKDF2_ITERATIONS,
      (options.now?.() ?? new Date()).toISOString(),
    )
  } finally {
    rawKey.fill(0)
  }
}

export async function sha256Base64(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? TEXT_ENCODER.encode(value) : value
  const digest = await getWebCrypto().subtle.digest('SHA-256', toArrayBuffer(bytes))
  return bytesToBase64(new Uint8Array(digest))
}

export function timingSafeEqualBase64(left: string, right: string): boolean {
  let leftBytes: Uint8Array
  let rightBytes: Uint8Array
  try {
    leftBytes = base64ToBytes(left)
    rightBytes = base64ToBytes(right)
  } catch {
    return false
  }
  const maximumLength = Math.max(leftBytes.length, rightBytes.length)
  let difference = leftBytes.length ^ rightBytes.length
  for (let index = 0; index < maximumLength; index += 1) {
    difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0)
  }
  return difference === 0
}
