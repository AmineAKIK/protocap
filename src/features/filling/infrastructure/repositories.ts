import { z, type ZodType } from 'zod'

import type {
  AppSettings,
  CalibrationProfile,
  ControlPlanProfile,
  EventLog,
  InstrumentProfile,
  MachineProfile,
  PackagingProfile,
  ProductProfile,
  SetupSession,
} from '../domain/models'
import type { FillingDatabase } from './database'
import {
  ENCRYPTION_KEY_SETTING_ID,
  PROFILE_KINDS,
  RECORD_FORMAT_VERSION,
  StoredEventRecordSchema,
  StoredProfileRecordSchema,
  StoredSessionRecordSchema,
  StoredSettingRecordSchema,
  encryptedRecordAdditionalData,
  type FillingStoreName,
  type ProfileKind,
  type StoredEncryptedSettingRecord,
  type StoredEventRecord,
  type StoredProfileRecord,
  type StoredRecordByStore,
  type StoredSessionRecord,
  type StoredSystemSettingRecord,
} from './databaseSchema'
import {
  createDataKey,
  rewrapDataKey,
  StorageCipher,
  unlockDataKey,
  WrappedDataKeySchema,
  type WrappedDataKey,
} from './encryption'
import {
  AppendOnlyViolationError,
  DataCorruptionError,
  DuplicateMutationError,
  FillingStorageError,
  isQuotaExceededError,
  RevisionConflictError,
  StorageQuotaError,
  StorageReadError,
  StorageWriteError,
} from './errors'

export const APPLICATION_SETTINGS_ID = 'application'
export const LOGICAL_SNAPSHOT_VERSION = 1 as const

export interface FillingProfileMap {
  machine: MachineProfile
  product: ProductProfile
  packaging: PackagingProfile
  controlPlan: ControlPlanProfile
  instrument: InstrumentProfile
  calibration: CalibrationProfile
}

export type FillingProfile = FillingProfileMap[ProfileKind]

export interface FillingDocumentSchemas {
  profiles: { [Kind in ProfileKind]: ZodType<FillingProfileMap[Kind]> }
  session: ZodType<SetupSession>
  event: ZodType<EventLog>
  settings: ZodType<AppSettings>
}

export interface VersionedValue<Value> {
  value: Value
  revision: number
  createdAt: string
  updatedAt: string
}

export type VersionedProfile<Kind extends ProfileKind = ProfileKind> = VersionedValue<
  FillingProfileMap[Kind]
> & {
  kind: Kind
}

export type AnyVersionedProfile = {
  [Kind in ProfileKind]: VersionedProfile<Kind>
}[ProfileKind]

export interface LogicalStorageSnapshot {
  version: typeof LOGICAL_SNAPSHOT_VERSION
  profiles: AnyVersionedProfile[]
  sessions: VersionedValue<SetupSession>[]
  events: VersionedValue<EventLog>[]
  settings: VersionedValue<AppSettings> | null
}

export const LogicalStorageSnapshotEnvelopeSchema = z
  .object({
    version: z.literal(LOGICAL_SNAPSHOT_VERSION),
    profiles: z.array(
      z
        .object({
          kind: z.enum(PROFILE_KINDS),
          value: z.unknown(),
          revision: z.number().int().positive(),
          createdAt: z.string().datetime({ offset: true }),
          updatedAt: z.string().datetime({ offset: true }),
        })
        .strict(),
    ),
    sessions: z.array(
      z
        .object({
          value: z.unknown(),
          revision: z.number().int().positive(),
          createdAt: z.string().datetime({ offset: true }),
          updatedAt: z.string().datetime({ offset: true }),
        })
        .strict(),
    ),
    events: z.array(
      z
        .object({
          value: z.unknown(),
          revision: z.number().int().positive(),
          createdAt: z.string().datetime({ offset: true }),
          updatedAt: z.string().datetime({ offset: true }),
        })
        .strict(),
    ),
    settings: z
      .object({
        value: z.unknown(),
        revision: z.number().int().positive(),
        createdAt: z.string().datetime({ offset: true }),
        updatedAt: z.string().datetime({ offset: true }),
      })
      .strict()
      .nullable(),
  })
  .strict()

type ProfilePutMutation = {
  [Kind in ProfileKind]: {
    type: 'put'
    store: 'profiles'
    kind: Kind
    value: FillingProfileMap[Kind]
    expectedRevision: number
  }
}[ProfileKind]

export type FillingStorageMutation =
  | ProfilePutMutation
  | {
      type: 'put'
      store: 'sessions'
      value: SetupSession
      expectedRevision: number
    }
  | {
      type: 'append'
      store: 'events'
      value: EventLog
    }
  | {
      type: 'put'
      store: 'settings'
      value: AppSettings
      expectedRevision: number
    }
  | {
      type: 'delete'
      store: 'profiles' | 'sessions' | 'settings'
      id: string
      expectedRevision: number
    }

export interface CommitResult {
  store: FillingStoreName
  id: string
  revision: number
  operation: 'put' | 'append' | 'delete'
}

export interface StorageCommitNotification {
  type: 'storage-commit'
  sourceId: string
  commitId: string
  committedAt: string
  changes: CommitResult[]
}

export type StorageCommitListener = (notification: StorageCommitNotification) => void

type PreparedPut = {
  type: 'put' | 'append'
  store: FillingStoreName
  id: string
  expectedRevision: number
  stored: StoredRecordByStore[FillingStoreName]
}

type PreparedDelete = {
  type: 'delete'
  store: 'profiles' | 'sessions' | 'settings'
  id: string
  expectedRevision: number
}

type PreparedMutation = PreparedPut | PreparedDelete

function recordId(value: { id: string }, label: string): string {
  if (typeof value.id !== 'string' || value.id.trim() === '') {
    throw new DataCorruptionError(`${label} doit posséder un identifiant non vide.`)
  }
  return value.id
}

function assertExpectedRevision(expectedRevision: number): void {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) {
    throw new RangeError('La révision attendue doit être un entier positif ou zéro pour une création.')
  }
}

function assertStoredMetadataConsistency(
  store: FillingStoreName,
  record: StoredRecordByStore[FillingStoreName],
  value: unknown,
): void {
  if (store === 'settings') {
    return
  }
  if (!value || typeof value !== 'object' || !('id' in value) || value.id !== record.id) {
    throw new DataCorruptionError(`L'identifiant chiffré ne correspond pas à ${store}/${record.id}.`, {
      collection: store,
      entityId: record.id,
    })
  }

  if (store === 'profiles') {
    const profileRecord = record as StoredProfileRecord
    if (!('status' in value) || value.status !== profileRecord.status) {
      throw new DataCorruptionError(`Le statut chiffré ne correspond pas à profiles/${record.id}.`, {
        collection: store,
        entityId: record.id,
      })
    }
  } else if (store === 'sessions') {
    const sessionRecord = record as StoredSessionRecord
    if (!('status' in value) || value.status !== sessionRecord.status) {
      throw new DataCorruptionError(`Le statut chiffré ne correspond pas à sessions/${record.id}.`, {
        collection: store,
        entityId: record.id,
      })
    }
  } else if (store === 'events') {
    const eventRecord = record as StoredEventRecord
    const event = value as Partial<EventLog>
    if (
      event.sequence !== eventRecord.sequence ||
      event.occurredAt !== eventRecord.occurredAt ||
      event.sessionId !== eventRecord.sessionId
    ) {
      throw new DataCorruptionError(`Les index chiffrés ne correspondent pas à events/${record.id}.`, {
        collection: store,
        entityId: record.id,
      })
    }
  }
}

function createSourceId(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

class StorageNotifications {
  readonly sourceId = createSourceId()
  readonly #listeners = new Set<StorageCommitListener>()
  readonly #channel?: BroadcastChannel

  constructor(databaseName: string) {
    if (typeof BroadcastChannel !== 'undefined') {
      this.#channel = new BroadcastChannel(`${databaseName}:changes`)
      this.#channel.addEventListener('message', (event: MessageEvent<unknown>) => {
        const notification = event.data as Partial<StorageCommitNotification>
        if (
          notification?.type === 'storage-commit' &&
          notification.sourceId !== this.sourceId &&
          Array.isArray(notification.changes)
        ) {
          this.#emit(notification as StorageCommitNotification)
        }
      })
    }
  }

  subscribe(listener: StorageCommitListener): () => void {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  publish(notification: StorageCommitNotification): void {
    this.#emit(notification)
    this.#channel?.postMessage(notification)
  }

  close(): void {
    this.#channel?.close()
    this.#listeners.clear()
  }

  #emit(notification: StorageCommitNotification): void {
    for (const listener of this.#listeners) listener(notification)
  }
}

export class FillingRepositories {
  readonly profiles: ProfileRepository
  readonly sessions: SessionRepository
  readonly events: EventRepository
  readonly settings: AppSettingsRepository

  readonly #notifications: StorageNotifications

  constructor(
    readonly database: FillingDatabase,
    readonly cipher: StorageCipher,
    readonly schemas: FillingDocumentSchemas,
    readonly now: () => Date = () => new Date(),
  ) {
    this.#notifications = new StorageNotifications(database.name)
    this.profiles = new ProfileRepository(this)
    this.sessions = new SessionRepository(this)
    this.events = new EventRepository(this)
    this.settings = new AppSettingsRepository(this)
  }

  subscribe(listener: StorageCommitListener): () => void {
    return this.#notifications.subscribe(listener)
  }

  close(): void {
    this.#notifications.close()
    this.cipher.lock()
    this.database.close()
  }

  async atomic(mutations: readonly FillingStorageMutation[]): Promise<CommitResult[]> {
    if (mutations.length === 0) return []
    const prepared = await Promise.all(mutations.map((mutation) => this.#prepareMutation(mutation)))
    this.#assertNoDuplicateMutations(prepared)

    const stores = [...new Set(prepared.map((mutation) => mutation.store))]
    const transaction = this.database.transaction(stores, 'readwrite', { durability: 'strict' })
    const results: CommitResult[] = []

    try {
      for (const mutation of prepared) {
        const store = transaction.objectStore(mutation.store)
        const current = (await store.get(mutation.id)) as
          | StoredRecordByStore[FillingStoreName]
          | undefined
        const actualRevision = current?.revision ?? 0
        if (actualRevision !== mutation.expectedRevision) {
          if (mutation.type === 'append' && current) {
            throw new AppendOnlyViolationError(mutation.id)
          }
          throw new RevisionConflictError(
            mutation.store,
            mutation.id,
            mutation.expectedRevision,
            actualRevision,
          )
        }

        if (mutation.type === 'delete') {
          if (mutation.expectedRevision === 0) {
            throw new RevisionConflictError(mutation.store, mutation.id, 1, actualRevision)
          }
          await store.delete(mutation.id)
          results.push({
            store: mutation.store,
            id: mutation.id,
            revision: actualRevision,
            operation: 'delete',
          })
          continue
        }

        if (
          current &&
          mutation.store === 'profiles' &&
          (current as StoredProfileRecord).kind !== (mutation.stored as StoredProfileRecord).kind
        ) {
          throw new StorageWriteError(
            `Le type du profil ${mutation.id} ne peut pas être modifié sans créer un nouvel identifiant.`,
          )
        }

        const stored = {
          ...mutation.stored,
          createdAt: current?.createdAt ?? mutation.stored.createdAt,
        } as StoredRecordByStore[FillingStoreName]
        await store.put(stored)
        results.push({
          store: mutation.store,
          id: mutation.id,
          revision: stored.revision,
          operation: mutation.type,
        })
      }
      await transaction.done
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        // The transaction may already have aborted on a constraint/quota error.
      }
      await transaction.done.catch(() => undefined)
      if (error instanceof FillingStorageError) throw error
      if (isQuotaExceededError(error)) throw new StorageQuotaError(undefined, error)
      throw new StorageWriteError('La transaction locale a été annulée sans écriture partielle.', error)
    }

    const notification: StorageCommitNotification = {
      type: 'storage-commit',
      sourceId: this.#notifications.sourceId,
      commitId: createSourceId(),
      committedAt: this.now().toISOString(),
      changes: results,
    }
    this.#notifications.publish(notification)
    return results
  }

  async snapshot(): Promise<LogicalStorageSnapshot> {
    const [profiles, sessions, events, settings] = await Promise.all([
      this.profiles.list(),
      this.sessions.list(),
      this.events.list(),
      this.settings.get(),
    ])
    return { version: LOGICAL_SNAPSHOT_VERSION, profiles, sessions, events, settings }
  }

  validateSnapshot(input: unknown): LogicalStorageSnapshot {
    const envelope = LogicalStorageSnapshotEnvelopeSchema.parse(input)
    const profileIds = new Set<string>()
    const profiles = envelope.profiles.map((entry) => {
      const value = this.schemas.profiles[entry.kind].parse(entry.value) as FillingProfile
      if (profileIds.has(value.id)) {
        throw new DataCorruptionError(`Le profil ${value.id} est dupliqué dans la sauvegarde.`)
      }
      profileIds.add(value.id)
      return { ...entry, value } as AnyVersionedProfile
    })

    const sessions = this.#validateVersionedCollection(
      envelope.sessions,
      this.schemas.session,
      'session',
    )
    const events = this.#validateVersionedCollection(envelope.events, this.schemas.event, 'événement')
    const settings = envelope.settings
      ? { ...envelope.settings, value: this.schemas.settings.parse(envelope.settings.value) }
      : null

    return { version: LOGICAL_SNAPSHOT_VERSION, profiles, sessions, events, settings }
  }

  /**
   * Destructive restore used only after backup preview/confirmation. Existing
   * system settings (notably the wrapped local data key) are preserved.
   */
  async replaceAllFromSnapshot(input: unknown): Promise<void> {
    const snapshot = this.validateSnapshot(input)
    const records = await this.#encryptSnapshot(snapshot)
    const transaction = this.database.transaction(
      ['profiles', 'sessions', 'events', 'settings'],
      'readwrite',
      { durability: 'strict' },
    )
    try {
      await Promise.all([
        transaction.objectStore('profiles').clear(),
        transaction.objectStore('sessions').clear(),
        transaction.objectStore('events').clear(),
        transaction.objectStore('settings').delete(APPLICATION_SETTINGS_ID),
      ])
      for (const record of records.profiles) await transaction.objectStore('profiles').put(record)
      for (const record of records.sessions) await transaction.objectStore('sessions').put(record)
      for (const record of records.events) await transaction.objectStore('events').put(record)
      if (records.settings) await transaction.objectStore('settings').put(records.settings)
      await transaction.done
    } catch (error) {
      try {
        transaction.abort()
      } catch {
        // Already aborted by IndexedDB.
      }
      await transaction.done.catch(() => undefined)
      if (isQuotaExceededError(error)) throw new StorageQuotaError(undefined, error)
      throw new StorageWriteError('La restauration a été annulée intégralement.', error)
    }

    this.#notifications.publish({
      type: 'storage-commit',
      sourceId: this.#notifications.sourceId,
      commitId: createSourceId(),
      committedAt: this.now().toISOString(),
      changes: [
        { store: 'profiles', id: '*', revision: 0, operation: 'put' },
        { store: 'sessions', id: '*', revision: 0, operation: 'put' },
        { store: 'events', id: '*', revision: 0, operation: 'put' },
        { store: 'settings', id: APPLICATION_SETTINGS_ID, revision: 0, operation: 'put' },
      ],
    })
  }

  async decodeRecord<Store extends FillingStoreName>(
    store: Store,
    recordInput: StoredRecordByStore[Store],
  ): Promise<VersionedValue<unknown>> {
    try {
      const record = this.#parseStoredRecord(store, recordInput)
      if (record.storage !== 'encrypted') {
        throw new DataCorruptionError(`Le réglage système ${record.id} ne constitue pas une donnée métier.`)
      }
      const value = await this.cipher.decryptJson(
        record.payload,
        encryptedRecordAdditionalData(store, record.id, record.revision),
      )
      assertStoredMetadataConsistency(store, record, value)
      return {
        value,
        revision: record.revision,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }
    } catch (error) {
      if (error instanceof FillingStorageError) throw error
      throw new StorageReadError(`Impossible de lire ${store}/${recordInput.id}.`, error)
    }
  }

  async #prepareMutation(mutation: FillingStorageMutation): Promise<PreparedMutation> {
    if (mutation.type === 'delete') {
      assertExpectedRevision(mutation.expectedRevision)
      if (mutation.store === 'settings' && mutation.id !== APPLICATION_SETTINGS_ID) {
        throw new StorageWriteError('Seuls les réglages applicatifs peuvent être supprimés via ce dépôt.')
      }
      return mutation
    }

    const expectedRevision = mutation.type === 'append' ? 0 : mutation.expectedRevision
    assertExpectedRevision(expectedRevision)
    const revision = expectedRevision + 1
    const timestamp = this.now().toISOString()

    if (mutation.store === 'profiles') {
      const value = this.schemas.profiles[mutation.kind].parse(mutation.value) as FillingProfile
      const id = recordId(value, 'Un profil')
      const payload = await this.cipher.encryptJson(
        value,
        encryptedRecordAdditionalData('profiles', id, revision),
      )
      return {
        type: 'put',
        store: 'profiles',
        id,
        expectedRevision,
        stored: {
          id,
          kind: mutation.kind,
          status: value.status,
          revision,
          createdAt: timestamp,
          updatedAt: timestamp,
          formatVersion: RECORD_FORMAT_VERSION,
          storage: 'encrypted',
          payload,
        },
      }
    }

    if (mutation.store === 'sessions') {
      const value = this.schemas.session.parse(mutation.value)
      const id = recordId(value, 'Une session')
      const payload = await this.cipher.encryptJson(
        value,
        encryptedRecordAdditionalData('sessions', id, revision),
      )
      return {
        type: 'put',
        store: 'sessions',
        id,
        expectedRevision,
        stored: {
          id,
          status: value.status,
          revision,
          createdAt: timestamp,
          updatedAt: timestamp,
          formatVersion: RECORD_FORMAT_VERSION,
          storage: 'encrypted',
          payload,
        },
      }
    }

    if (mutation.store === 'events') {
      const value = this.schemas.event.parse(mutation.value)
      const id = recordId(value, 'Un événement')
      const payload = await this.cipher.encryptJson(
        value,
        encryptedRecordAdditionalData('events', id, revision),
      )
      return {
        type: 'append',
        store: 'events',
        id,
        expectedRevision,
        stored: {
          id,
          sessionId: value.sessionId,
          occurredAt: value.occurredAt,
          sequence: value.sequence,
          revision,
          createdAt: timestamp,
          updatedAt: timestamp,
          formatVersion: RECORD_FORMAT_VERSION,
          storage: 'encrypted',
          payload,
        },
      }
    }

    const value = this.schemas.settings.parse(mutation.value)
    const payload = await this.cipher.encryptJson(
      value,
      encryptedRecordAdditionalData('settings', APPLICATION_SETTINGS_ID, revision),
    )
    return {
      type: 'put',
      store: 'settings',
      id: APPLICATION_SETTINGS_ID,
      expectedRevision,
      stored: {
        id: APPLICATION_SETTINGS_ID,
        scope: 'application',
        revision,
        createdAt: timestamp,
        updatedAt: timestamp,
        formatVersion: RECORD_FORMAT_VERSION,
        storage: 'encrypted',
        payload,
      },
    }
  }

  #assertNoDuplicateMutations(mutations: readonly PreparedMutation[]): void {
    const targets = new Set<string>()
    for (const mutation of mutations) {
      const target = `${mutation.store}\u0000${mutation.id}`
      if (targets.has(target)) throw new DuplicateMutationError(mutation.store, mutation.id)
      targets.add(target)
    }
  }

  #parseStoredRecord<Store extends FillingStoreName>(
    store: Store,
    record: StoredRecordByStore[Store],
  ): StoredRecordByStore[Store] {
    if (store === 'profiles') return StoredProfileRecordSchema.parse(record) as StoredRecordByStore[Store]
    if (store === 'sessions') return StoredSessionRecordSchema.parse(record) as StoredRecordByStore[Store]
    if (store === 'events') return StoredEventRecordSchema.parse(record) as StoredRecordByStore[Store]
    return StoredSettingRecordSchema.parse(record) as StoredRecordByStore[Store]
  }

  #validateVersionedCollection<Value extends { id: string }>(
    entries: Array<{ value: unknown; revision: number; createdAt: string; updatedAt: string }>,
    schema: ZodType<Value>,
    label: string,
  ): VersionedValue<Value>[] {
    const ids = new Set<string>()
    return entries.map((entry) => {
      const value = schema.parse(entry.value)
      if (ids.has(value.id)) {
        throw new DataCorruptionError(`L'identifiant ${value.id} est dupliqué pour ${label}.`)
      }
      ids.add(value.id)
      return { ...entry, value }
    })
  }

  async #encryptSnapshot(snapshot: LogicalStorageSnapshot): Promise<{
    profiles: StoredProfileRecord[]
    sessions: StoredSessionRecord[]
    events: StoredEventRecord[]
    settings: StoredEncryptedSettingRecord | null
  }> {
    const profiles = await Promise.all(
      snapshot.profiles.map(async (entry) => ({
        id: entry.value.id,
        kind: entry.kind,
        status: entry.value.status,
        revision: entry.revision,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        formatVersion: RECORD_FORMAT_VERSION,
        storage: 'encrypted' as const,
        payload: await this.cipher.encryptJson(
          entry.value,
          encryptedRecordAdditionalData('profiles', entry.value.id, entry.revision),
        ),
      })),
    )
    const sessions = await Promise.all(
      snapshot.sessions.map(async (entry) => ({
        id: entry.value.id,
        status: entry.value.status,
        revision: entry.revision,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        formatVersion: RECORD_FORMAT_VERSION,
        storage: 'encrypted' as const,
        payload: await this.cipher.encryptJson(
          entry.value,
          encryptedRecordAdditionalData('sessions', entry.value.id, entry.revision),
        ),
      })),
    )
    const events = await Promise.all(
      snapshot.events.map(async (entry) => ({
        id: entry.value.id,
        sessionId: entry.value.sessionId,
        occurredAt: entry.value.occurredAt,
        sequence: entry.value.sequence,
        revision: entry.revision,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        formatVersion: RECORD_FORMAT_VERSION,
        storage: 'encrypted' as const,
        payload: await this.cipher.encryptJson(
          entry.value,
          encryptedRecordAdditionalData('events', entry.value.id, entry.revision),
        ),
      })),
    )
    const settings = snapshot.settings
      ? {
          id: APPLICATION_SETTINGS_ID,
          scope: 'application' as const,
          revision: snapshot.settings.revision,
          createdAt: snapshot.settings.createdAt,
          updatedAt: snapshot.settings.updatedAt,
          formatVersion: RECORD_FORMAT_VERSION,
          storage: 'encrypted' as const,
          payload: await this.cipher.encryptJson(
            snapshot.settings.value,
            encryptedRecordAdditionalData('settings', APPLICATION_SETTINGS_ID, snapshot.settings.revision),
          ),
        }
      : null
    return { profiles, sessions, events, settings }
  }
}

export class ProfileRepository {
  constructor(private readonly storage: FillingRepositories) {}

  putMutation<Kind extends ProfileKind>(
    kind: Kind,
    value: FillingProfileMap[Kind],
    expectedRevision: number,
  ): FillingStorageMutation {
    return { type: 'put', store: 'profiles', kind, value, expectedRevision } as FillingStorageMutation
  }

  deleteMutation(id: string, expectedRevision: number): FillingStorageMutation {
    return { type: 'delete', store: 'profiles', id, expectedRevision }
  }

  async create<Kind extends ProfileKind>(
    kind: Kind,
    value: FillingProfileMap[Kind],
  ): Promise<VersionedProfile<Kind>> {
    await this.storage.atomic([this.putMutation(kind, value, 0)])
    const persisted = await this.getAs(kind, value.id)
    if (!persisted) throw new StorageWriteError(`Le profil ${value.id} n'est pas relisible après création.`)
    return persisted
  }

  async replace<Kind extends ProfileKind>(
    kind: Kind,
    value: FillingProfileMap[Kind],
    expectedRevision: number,
  ): Promise<VersionedProfile<Kind>> {
    await this.storage.atomic([this.putMutation(kind, value, expectedRevision)])
    const persisted = await this.getAs(kind, value.id)
    if (!persisted) throw new StorageWriteError(`Le profil ${value.id} n'est pas relisible après écriture.`)
    return persisted
  }

  async get(id: string): Promise<AnyVersionedProfile | null> {
    const record = await this.storage.database.get('profiles', id)
    if (!record) return null
    const decoded = await this.storage.decodeRecord('profiles', record)
    const schema = this.storage.schemas.profiles[record.kind]
    return { ...decoded, kind: record.kind, value: schema.parse(decoded.value) } as AnyVersionedProfile
  }

  async getAs<Kind extends ProfileKind>(
    kind: Kind,
    id: string,
  ): Promise<VersionedProfile<Kind> | null> {
    const profile = await this.get(id)
    if (!profile) return null
    if (profile.kind !== kind) {
      throw new DataCorruptionError(`Le profil ${id} est de type ${profile.kind}, pas ${kind}.`)
    }
    return profile as VersionedProfile<Kind>
  }

  async list<Kind extends ProfileKind>(kind?: Kind): Promise<AnyVersionedProfile[]> {
    const records = kind
      ? await this.storage.database.getAllFromIndex('profiles', 'by-kind', kind)
      : await this.storage.database.getAll('profiles')
    const profiles = await Promise.all(records.map((record) => this.get(record.id)))
    return profiles.filter((profile): profile is AnyVersionedProfile => profile !== null)
  }

  async delete(id: string, expectedRevision: number): Promise<void> {
    await this.storage.atomic([this.deleteMutation(id, expectedRevision)])
  }
}

export class SessionRepository {
  constructor(private readonly storage: FillingRepositories) {}

  putMutation(value: SetupSession, expectedRevision: number): FillingStorageMutation {
    return { type: 'put', store: 'sessions', value, expectedRevision }
  }

  deleteMutation(id: string, expectedRevision: number): FillingStorageMutation {
    return { type: 'delete', store: 'sessions', id, expectedRevision }
  }

  async create(value: SetupSession): Promise<VersionedValue<SetupSession>> {
    await this.storage.atomic([this.putMutation(value, 0)])
    const persisted = await this.get(value.id)
    if (!persisted) throw new StorageWriteError(`La session ${value.id} n'est pas relisible après création.`)
    return persisted
  }

  async replace(
    value: SetupSession,
    expectedRevision: number,
  ): Promise<VersionedValue<SetupSession>> {
    await this.storage.atomic([this.putMutation(value, expectedRevision)])
    const persisted = await this.get(value.id)
    if (!persisted) throw new StorageWriteError(`La session ${value.id} n'est pas relisible après écriture.`)
    return persisted
  }

  async get(id: string): Promise<VersionedValue<SetupSession> | null> {
    const record = await this.storage.database.get('sessions', id)
    if (!record) return null
    const decoded = await this.storage.decodeRecord('sessions', record)
    return { ...decoded, value: this.storage.schemas.session.parse(decoded.value) }
  }

  async list(status?: SetupSession['status']): Promise<VersionedValue<SetupSession>[]> {
    const records = status
      ? await this.storage.database.getAllFromIndex('sessions', 'by-status', status)
      : await this.storage.database.getAll('sessions')
    return Promise.all(
      records.map(async (record) => {
        const decoded = await this.storage.decodeRecord('sessions', record)
        return { ...decoded, value: this.storage.schemas.session.parse(decoded.value) }
      }),
    )
  }

  async delete(id: string, expectedRevision: number): Promise<void> {
    await this.storage.atomic([this.deleteMutation(id, expectedRevision)])
  }
}

export class EventRepository {
  constructor(private readonly storage: FillingRepositories) {}

  appendMutation(value: EventLog): FillingStorageMutation {
    return { type: 'append', store: 'events', value }
  }

  async append(value: EventLog): Promise<VersionedValue<EventLog>> {
    await this.storage.atomic([this.appendMutation(value)])
    const persisted = await this.get(value.id)
    if (!persisted) throw new StorageWriteError(`L'événement ${value.id} n'est pas relisible après ajout.`)
    return persisted
  }

  async get(id: string): Promise<VersionedValue<EventLog> | null> {
    const record = await this.storage.database.get('events', id)
    if (!record) return null
    const decoded = await this.storage.decodeRecord('events', record)
    return { ...decoded, value: this.storage.schemas.event.parse(decoded.value) }
  }

  async list(sessionId?: string): Promise<VersionedValue<EventLog>[]> {
    const records = sessionId
      ? await this.storage.database.getAllFromIndex('events', 'by-session', sessionId)
      : await this.storage.database.getAll('events')
    const events = await Promise.all(
      records.map(async (record) => {
        const decoded = await this.storage.decodeRecord('events', record)
        return { ...decoded, value: this.storage.schemas.event.parse(decoded.value) }
      }),
    )
    return events.sort((left, right) => left.value.sequence - right.value.sequence)
  }
}

export class AppSettingsRepository {
  constructor(private readonly storage: FillingRepositories) {}

  putMutation(value: AppSettings, expectedRevision: number): FillingStorageMutation {
    return { type: 'put', store: 'settings', value, expectedRevision }
  }

  deleteMutation(expectedRevision: number): FillingStorageMutation {
    return {
      type: 'delete',
      store: 'settings',
      id: APPLICATION_SETTINGS_ID,
      expectedRevision,
    }
  }

  async save(value: AppSettings, expectedRevision: number): Promise<VersionedValue<AppSettings>> {
    await this.storage.atomic([this.putMutation(value, expectedRevision)])
    const persisted = await this.get()
    if (!persisted) throw new StorageWriteError("Les réglages ne sont pas relisibles après écriture.")
    return persisted
  }

  async get(): Promise<VersionedValue<AppSettings> | null> {
    const record = await this.storage.database.get('settings', APPLICATION_SETTINGS_ID)
    if (!record) return null
    if (record.storage !== 'encrypted') {
      throw new DataCorruptionError("L'identifiant des réglages applicatifs est réservé.")
    }
    const decoded = await this.storage.decodeRecord('settings', record)
    return { ...decoded, value: this.storage.schemas.settings.parse(decoded.value) }
  }

  async delete(expectedRevision: number): Promise<void> {
    await this.storage.atomic([this.deleteMutation(expectedRevision)])
  }
}

export interface EncryptionEnrollment {
  cipher: StorageCipher
  wrappedDataKey: WrappedDataKey
  envelopeRevision: number
}

export async function readWrappedDataKey(
  database: FillingDatabase,
): Promise<{ value: WrappedDataKey; revision: number } | null> {
  const record = await database.get('settings', ENCRYPTION_KEY_SETTING_ID)
  if (!record) return null
  if (record.storage !== 'system') {
    throw new DataCorruptionError("L'enveloppe de chiffrement a un format de stockage invalide.")
  }
  try {
    return { value: WrappedDataKeySchema.parse(record.value), revision: record.revision }
  } catch (error) {
    throw new DataCorruptionError("L'enveloppe de la clé locale est endommagée.", { cause: error })
  }
}

export async function initializeLocalEncryption(
  database: FillingDatabase,
  passphrase: string,
  options: { iterations?: number; now?: () => Date } = {},
): Promise<EncryptionEnrollment> {
  const existing = await readWrappedDataKey(database)
  if (existing) {
    throw new RevisionConflictError('settings', ENCRYPTION_KEY_SETTING_ID, 0, existing.revision)
  }
  const created = await createDataKey(passphrase, options)
  const timestamp = (options.now?.() ?? new Date()).toISOString()
  const record: StoredSystemSettingRecord = {
    id: ENCRYPTION_KEY_SETTING_ID,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    formatVersion: RECORD_FORMAT_VERSION,
    storage: 'system',
    scope: 'system',
    value: created.wrappedDataKey,
  }

  const transaction = database.transaction('settings', 'readwrite', { durability: 'strict' })
  try {
    const concurrent = await transaction.store.get(ENCRYPTION_KEY_SETTING_ID)
    if (concurrent) {
      throw new RevisionConflictError('settings', ENCRYPTION_KEY_SETTING_ID, 0, concurrent.revision)
    }
    await transaction.store.add(record)
    await transaction.done
    return { ...created, envelopeRevision: 1 }
  } catch (error) {
    created.cipher.lock()
    try {
      transaction.abort()
    } catch {
      // Already aborted.
    }
    await transaction.done.catch(() => undefined)
    if (error instanceof FillingStorageError) throw error
    if (isQuotaExceededError(error)) throw new StorageQuotaError(undefined, error)
    throw new StorageWriteError("L'enrôlement du chiffrement local a échoué.", error)
  }
}

export async function unlockLocalEncryption(
  database: FillingDatabase,
  passphrase: string,
): Promise<EncryptionEnrollment> {
  const stored = await readWrappedDataKey(database)
  if (!stored) {
    throw new DataCorruptionError("Aucune clé locale n'est enregistrée sur cet appareil.")
  }
  return {
    cipher: await unlockDataKey(passphrase, stored.value),
    wrappedDataKey: stored.value,
    envelopeRevision: stored.revision,
  }
}

export async function changeLocalPassphrase(
  database: FillingDatabase,
  cipher: StorageCipher,
  newPassphrase: string,
  expectedEnvelopeRevision: number,
  options: { iterations?: number; now?: () => Date } = {},
): Promise<{ wrappedDataKey: WrappedDataKey; envelopeRevision: number }> {
  assertExpectedRevision(expectedEnvelopeRevision)
  const wrappedDataKey = await rewrapDataKey(cipher, newPassphrase, options)
  const transaction = database.transaction('settings', 'readwrite', { durability: 'strict' })
  try {
    const current = await transaction.store.get(ENCRYPTION_KEY_SETTING_ID)
    const actualRevision = current?.revision ?? 0
    if (!current || current.storage !== 'system' || actualRevision !== expectedEnvelopeRevision) {
      throw new RevisionConflictError(
        'settings',
        ENCRYPTION_KEY_SETTING_ID,
        expectedEnvelopeRevision,
        actualRevision,
      )
    }
    const nextRevision = actualRevision + 1
    await transaction.store.put({
      ...current,
      revision: nextRevision,
      updatedAt: (options.now?.() ?? new Date()).toISOString(),
      value: wrappedDataKey,
    })
    await transaction.done
    return { wrappedDataKey, envelopeRevision: nextRevision }
  } catch (error) {
    try {
      transaction.abort()
    } catch {
      // Already aborted.
    }
    await transaction.done.catch(() => undefined)
    if (error instanceof FillingStorageError) throw error
    if (isQuotaExceededError(error)) throw new StorageQuotaError(undefined, error)
    throw new StorageWriteError("Le changement de phrase secrète n'a pas été enregistré.", error)
  }
}
