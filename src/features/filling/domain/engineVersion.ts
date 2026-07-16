import { DomainError } from './decimal'

/** Increment whenever a persisted calculation can produce a different result. */
export const FILLING_ENGINE_VERSION = '1.0.0'
/** Backward-compatible concise name used by the application layer. */
export const ENGINE_VERSION = FILLING_ENGINE_VERSION
export const FILLING_DOMAIN_SCHEMA_VERSION = 1

export function engineMajor(version: string): number {
  const match = /^(\d+)\./.exec(version)
  if (match === null) {
    throw new DomainError('invalid_engine_version', `Version moteur invalide : ${version}.`)
  }
  return Number(match[1])
}

export function isEngineVersionReadable(version: string): boolean {
  try {
    return engineMajor(version) === engineMajor(FILLING_ENGINE_VERSION)
  } catch {
    return false
  }
}

export function assertEngineVersionReadable(version: string): void {
  if (!isEngineVersionReadable(version)) {
    throw new DomainError(
      'incompatible_engine_version',
      `La session utilise le moteur ${version}, incompatible avec ${FILLING_ENGINE_VERSION}.`,
      'engineVersion',
    )
  }
}
