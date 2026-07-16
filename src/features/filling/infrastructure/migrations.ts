import type { IDBPDatabase, IDBPTransaction } from 'idb'

import type { FillingDatabaseSchema, FillingStoreName } from './databaseSchema'

type UpgradeTransaction = IDBPTransaction<
  FillingDatabaseSchema,
  FillingStoreName[],
  'versionchange'
>

export interface DatabaseMigration {
  version: number
  description: string
  apply: (database: IDBPDatabase<FillingDatabaseSchema>, transaction: UpgradeTransaction) => void
}

function createInitialStores(database: IDBPDatabase<FillingDatabaseSchema>): void {
  const profiles = database.createObjectStore('profiles', { keyPath: 'id' })
  profiles.createIndex('by-kind', 'kind')

  database.createObjectStore('sessions', { keyPath: 'id' })

  const events = database.createObjectStore('events', { keyPath: 'id' })
  events.createIndex('by-session', 'sessionId')
  events.createIndex('by-occurred-at', 'occurredAt')

  const settings = database.createObjectStore('settings', { keyPath: 'id' })
  settings.createIndex('by-scope', 'scope')
}

function addOperationalIndexes(
  _database: IDBPDatabase<FillingDatabaseSchema>,
  transaction: UpgradeTransaction,
): void {
  const profiles = transaction.objectStore('profiles')
  if (!profiles.indexNames.contains('by-status')) {
    profiles.createIndex('by-status', 'status')
  }
  if (!profiles.indexNames.contains('by-updated-at')) {
    profiles.createIndex('by-updated-at', 'updatedAt')
  }

  const sessions = transaction.objectStore('sessions')
  if (!sessions.indexNames.contains('by-status')) {
    sessions.createIndex('by-status', 'status')
  }
  if (!sessions.indexNames.contains('by-updated-at')) {
    sessions.createIndex('by-updated-at', 'updatedAt')
  }

  const settings = transaction.objectStore('settings')
  if (!settings.indexNames.contains('by-updated-at')) {
    settings.createIndex('by-updated-at', 'updatedAt')
  }
}

function addEventOrderingIndex(
  _database: IDBPDatabase<FillingDatabaseSchema>,
  transaction: UpgradeTransaction,
): void {
  const events = transaction.objectStore('events')
  if (!events.indexNames.contains('by-session-sequence')) {
    events.createIndex('by-session-sequence', ['sessionId', 'sequence'], { unique: true })
  }
}

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    description: 'Création des magasins chiffrés principaux.',
    apply: createInitialStores,
  },
  {
    version: 2,
    description: "Ajout des index d'état et de fraîcheur.",
    apply: addOperationalIndexes,
  },
  {
    version: 3,
    description: "Ajout de l'ordre append-only des événements par session.",
    apply: addEventOrderingIndex,
  },
] as const

export function runDatabaseMigrations(
  database: IDBPDatabase<FillingDatabaseSchema>,
  oldVersion: number,
  newVersion: number | null,
  transaction: UpgradeTransaction,
): void {
  if (newVersion === null) {
    throw new Error('IndexedDB ne fournit pas la version cible de la migration.')
  }

  for (const migration of DATABASE_MIGRATIONS) {
    if (migration.version > oldVersion && migration.version <= newVersion) {
      migration.apply(database, transaction)
    }
  }
}
