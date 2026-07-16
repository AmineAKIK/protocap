import { openDB, type IDBPDatabase } from 'idb'

import {
  DATABASE_NAME,
  DATABASE_VERSION,
  type FillingDatabaseSchema,
} from './databaseSchema'
import { StorageUnavailableError } from './errors'
import { runDatabaseMigrations } from './migrations'

export type FillingDatabase = IDBPDatabase<FillingDatabaseSchema>

export interface OpenFillingDatabaseOptions {
  name?: string
  /** Called when an older tab prevents a schema upgrade from completing. */
  onBlocked?: (oldVersion: number, newVersion: number | null) => void
  /** Called before this connection closes to let a newer tab upgrade. */
  onVersionChange?: (oldVersion: number, newVersion: number | null) => void
  onTerminated?: () => void
}

export function isIndexedDbAvailable(): boolean {
  return typeof globalThis.indexedDB !== 'undefined'
}

export async function openFillingDatabase(
  options: OpenFillingDatabaseOptions = {},
): Promise<FillingDatabase> {
  if (!isIndexedDbAvailable()) {
    throw new StorageUnavailableError()
  }

  let database: FillingDatabase | undefined
  try {
    database = await openDB<FillingDatabaseSchema>(options.name ?? DATABASE_NAME, DATABASE_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        runDatabaseMigrations(db, oldVersion, newVersion, transaction)
      },
      blocked(oldVersion, newVersion) {
        options.onBlocked?.(oldVersion, newVersion)
      },
      blocking(oldVersion, newVersion) {
        options.onVersionChange?.(oldVersion, newVersion)
        database?.close()
      },
      terminated() {
        options.onTerminated?.()
      },
    })

    // A read proves that every migration reached a usable committed state.
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
    return database
  } catch (error) {
    database?.close()
    throw new StorageUnavailableError("La base locale de l'assistant remplissage ne peut pas être ouverte.", error)
  }
}

export function closeFillingDatabase(database: FillingDatabase): void {
  database.close()
}
