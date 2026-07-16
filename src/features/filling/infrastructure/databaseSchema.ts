import type { DBSchema } from 'idb'
import { z } from 'zod'

import { EncryptedJsonPayloadSchema, type EncryptedJsonPayload } from './encryption'

export const DATABASE_NAME = 'protocap-filling-gold'
export const DATABASE_VERSION = 3
export const RECORD_FORMAT_VERSION = 1 as const
export const SYSTEM_SETTING_PREFIX = '__system__:'
export const ENCRYPTION_KEY_SETTING_ID = `${SYSTEM_SETTING_PREFIX}encryption-key`

export const PROFILE_KINDS = [
  'machine',
  'product',
  'packaging',
  'controlPlan',
  'instrument',
  'calibration',
] as const

export type ProfileKind = (typeof PROFILE_KINDS)[number]
export type FillingStoreName = 'profiles' | 'sessions' | 'events' | 'settings'

export interface StoredRecordBase {
  id: string
  revision: number
  createdAt: string
  updatedAt: string
  formatVersion: typeof RECORD_FORMAT_VERSION
  storage: 'encrypted'
  payload: EncryptedJsonPayload
}

export interface StoredProfileRecord extends StoredRecordBase {
  kind: ProfileKind
  status: string
}

export interface StoredSessionRecord extends StoredRecordBase {
  status: string
}

export interface StoredEventRecord extends StoredRecordBase {
  sessionId?: string
  occurredAt: string
  sequence: number
}

export interface StoredEncryptedSettingRecord extends StoredRecordBase {
  scope: 'application'
}

export interface StoredSystemSettingRecord {
  id: string
  revision: number
  createdAt: string
  updatedAt: string
  formatVersion: typeof RECORD_FORMAT_VERSION
  storage: 'system'
  scope: 'system'
  value: unknown
}

export type StoredSettingRecord = StoredEncryptedSettingRecord | StoredSystemSettingRecord

export type StoredRecordByStore = {
  profiles: StoredProfileRecord
  sessions: StoredSessionRecord
  events: StoredEventRecord
  settings: StoredSettingRecord
}

const IsoDateSchema = z.string().datetime({ offset: true })
const StoredRecordBaseSchema = z.object({
  id: z.string().min(1),
  revision: z.number().int().positive(),
  createdAt: IsoDateSchema,
  updatedAt: IsoDateSchema,
  formatVersion: z.literal(RECORD_FORMAT_VERSION),
  storage: z.literal('encrypted'),
  payload: EncryptedJsonPayloadSchema,
})

export const StoredProfileRecordSchema = StoredRecordBaseSchema.extend({
  kind: z.enum(PROFILE_KINDS),
  status: z.string().min(1),
}).strict()

export const StoredSessionRecordSchema = StoredRecordBaseSchema.extend({
  status: z.string().min(1),
}).strict()

export const StoredEventRecordSchema = StoredRecordBaseSchema.extend({
  sessionId: z.string().min(1).optional(),
  occurredAt: IsoDateSchema,
  sequence: z.number().int().nonnegative(),
}).strict()

export const StoredEncryptedSettingRecordSchema = StoredRecordBaseSchema.extend({
  scope: z.literal('application'),
}).strict()

export const StoredSystemSettingRecordSchema = z
  .object({
    id: z.string().startsWith(SYSTEM_SETTING_PREFIX),
    revision: z.number().int().positive(),
    createdAt: IsoDateSchema,
    updatedAt: IsoDateSchema,
    formatVersion: z.literal(RECORD_FORMAT_VERSION),
    storage: z.literal('system'),
    scope: z.literal('system'),
    value: z.unknown(),
  })
  .strict()

export const StoredSettingRecordSchema = z.discriminatedUnion('storage', [
  StoredEncryptedSettingRecordSchema,
  StoredSystemSettingRecordSchema,
])

export const StoredRecordsSnapshotSchema = z
  .object({
    profiles: z.array(StoredProfileRecordSchema),
    sessions: z.array(StoredSessionRecordSchema),
    events: z.array(StoredEventRecordSchema),
    settings: z.array(StoredEncryptedSettingRecordSchema),
  })
  .strict()

export type StoredRecordsSnapshot = z.infer<typeof StoredRecordsSnapshotSchema>

export interface FillingDatabaseSchema extends DBSchema {
  profiles: {
    key: string
    value: StoredProfileRecord
    indexes: {
      'by-kind': ProfileKind
      'by-status': string
      'by-updated-at': string
    }
  }
  sessions: {
    key: string
    value: StoredSessionRecord
    indexes: {
      'by-status': string
      'by-updated-at': string
    }
  }
  events: {
    key: string
    value: StoredEventRecord
    indexes: {
      'by-session': string
      'by-occurred-at': string
      'by-session-sequence': [string, number]
    }
  }
  settings: {
    key: string
    value: StoredSettingRecord
    indexes: {
      'by-scope': string
      'by-updated-at': string
    }
  }
}

export function encryptedRecordAdditionalData(
  store: FillingStoreName,
  id: string,
  revision: number,
): string {
  return `protocap:filling:record-v${RECORD_FORMAT_VERSION}:${store}:${id}:${revision}`
}
