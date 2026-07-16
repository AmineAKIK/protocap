import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  appSettingsSchema,
  calibrationProfileSchema,
  controlPlanProfileSchema,
  eventLogSchema,
  instrumentProfileSchema,
  machineProfileSchema,
  packagingProfileSchema,
  productProfileSchema,
  setupSessionSchema,
} from '../domain/schemas';
import { ENGINE_VERSION } from '../domain/engineVersion';
import type { EventLog, SetupSession } from '../domain/models';
import { openFillingDatabase, type FillingDatabase } from '../infrastructure/database';
import {
  FillingRepositories,
  initializeLocalEncryption,
  readWrappedDataKey,
  unlockLocalEncryption,
  type AnyVersionedProfile,
  type VersionedValue,
} from '../infrastructure/repositories';
import { requestPersistentStorage, type PersistenceRequestResult } from '../infrastructure/storageHealth';
import type { FillingProfileBundle } from './profileBundle';

type VaultState = 'opening' | 'needs_setup' | 'locked' | 'unlocked' | 'error';

interface BundleRevisionState {
  machine: number;
  product: number;
  packaging: number;
  controlPlan: number;
  instrument: number;
  calibration?: number;
}

interface FillingGoldContextValue {
  vaultState: VaultState;
  error: string | null;
  profiles: FillingProfileBundle[];
  sessions: Array<VersionedValue<SetupSession>>;
  persistence: PersistenceRequestResult | null;
  initializeVault(passphrase: string): Promise<void>;
  unlockVault(passphrase: string): Promise<void>;
  lockVault(): void;
  saveProfile(profile: FillingProfileBundle): Promise<void>;
  deleteProfile(profileId: string): Promise<void>;
  saveSession(session: SetupSession): Promise<VersionedValue<SetupSession>>;
  deleteSession(sessionId: string): Promise<void>;
  refresh(): Promise<void>;
  repositories: FillingRepositories | null;
}

const schemas = {
  profiles: {
    machine: machineProfileSchema,
    product: productProfileSchema,
    packaging: packagingProfileSchema,
    controlPlan: controlPlanProfileSchema,
    instrument: instrumentProfileSchema,
    calibration: calibrationProfileSchema,
  },
  session: setupSessionSchema,
  event: eventLogSchema,
  settings: appSettingsSchema,
};

const FillingGoldContext = createContext<FillingGoldContextValue | null>(null);

function baseProfileId(profileId: string): string {
  const separator = profileId.lastIndexOf(':');
  return separator > 0 ? profileId.slice(0, separator) : profileId;
}

function totalMeasurements(session: SetupSession): number {
  return session.iterations.reduce((total, iteration) => total + iteration.measurements.length, 0);
}

function excludedMeasurementsSignature(session: SetupSession): string {
  return session.iterations
    .flatMap((iteration) => iteration.measurements)
    .filter((measurement) => measurement.excluded)
    .map((measurement) => `${measurement.id}:${measurement.exclusionReason ?? ''}`)
    .sort()
    .join('|');
}

function sessionTransitionEvents(
  previous: SetupSession | undefined,
  next: SetupSession,
): EventLog['type'][] {
  if (!previous) return ['session_created'];
  const types: EventLog['type'][] = [];
  const previousLast = previous.iterations[previous.iterations.length - 1];
  const nextLast = next.iterations[next.iterations.length - 1];

  if (previous.status === 'draft' && next.status === 'active') {
    types.push('context_confirmed', 'setting_applied');
  }
  const previousMeasurements = totalMeasurements(previous);
  const nextMeasurements = totalMeasurements(next);
  if (nextMeasurements > previousMeasurements) types.push('measurement_added');
  if (nextMeasurements < previousMeasurements) types.push('measurement_removed');
  if (excludedMeasurementsSignature(previous) !== excludedMeasurementsSignature(next)) {
    types.push('measurement_excluded');
  }
  if (next.iterations.length > previous.iterations.length) types.push('correction_confirmed');
  if (!previousLast?.decision && nextLast?.decision) types.push('decision_computed');
  if (previousLast?.operatorNote !== nextLast?.operatorNote) types.push('operator_note_recorded');
  if (previous.status !== next.status) {
    if (next.status === 'criterion_achieved') types.push('session_completed');
    if (next.status === 'stopped') types.push('session_stopped');
    if (next.status === 'abandoned') types.push('session_abandoned');
  }
  return types.length > 0 ? [...new Set(types)] : ['session_resumed'];
}

function bundlesFromProfiles(entries: AnyVersionedProfile[]): {
  bundles: FillingProfileBundle[];
  revisions: Map<string, BundleRevisionState>;
} {
  const groups = new Map<string, AnyVersionedProfile[]>();
  for (const entry of entries) {
    const id = baseProfileId(entry.value.id);
    groups.set(id, [...(groups.get(id) ?? []), entry]);
  }

  const bundles: FillingProfileBundle[] = [];
  const revisions = new Map<string, BundleRevisionState>();
  for (const [id, group] of groups) {
    const machine = group.find((entry) => entry.kind === 'machine');
    const product = group.find((entry) => entry.kind === 'product');
    const packaging = group.find((entry) => entry.kind === 'packaging');
    const controlPlan = group.find((entry) => entry.kind === 'controlPlan');
    const instrument = group.find((entry) => entry.kind === 'instrument');
    const calibration = group.find((entry) => entry.kind === 'calibration');
    if (!machine || !product || !packaging || !controlPlan || !instrument) continue;

    const typedMachine = machine.value as FillingProfileBundle['profiles']['machine'];
    const typedProduct = product.value as FillingProfileBundle['profiles']['product'];
    const typedPackaging = packaging.value as FillingProfileBundle['profiles']['packaging'];
    const typedControlPlan = controlPlan.value as FillingProfileBundle['profiles']['controlPlan'];
    const typedInstrument = instrument.value as FillingProfileBundle['profiles']['instrument'];
    const typedCalibration = calibration?.value as FillingProfileBundle['profiles']['calibration'];
    const sortedDates = [machine, product, packaging, controlPlan, instrument]
      .map((entry) => entry.updatedAt)
      .sort();
    const updatedAt = sortedDates[sortedDates.length - 1] ?? machine.updatedAt;
    const storedLabel = typedMachine.source.notes?.startsWith('gold-bundle-label:')
      ? typedMachine.source.notes.slice('gold-bundle-label:'.length).trim()
      : '';
    bundles.push({
      id,
      label: storedLabel || `${typedProduct.designation} · ${typedMachine.name} · ${typedPackaging.name}`,
      version: typedProduct.version,
      status: typedMachine.status,
      createdAt: machine.createdAt,
      updatedAt,
      verifiedAt: typedMachine.verifiedAt,
      profiles: {
        machine: typedMachine,
        product: typedProduct,
        packaging: typedPackaging,
        controlPlan: typedControlPlan,
        instrument: typedInstrument,
        calibration: typedCalibration,
      },
    });
    revisions.set(id, {
      machine: machine.revision,
      product: product.revision,
      packaging: packaging.revision,
      controlPlan: controlPlan.revision,
      instrument: instrument.revision,
      calibration: calibration?.revision,
    });
  }
  return {
    bundles: bundles.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    revisions,
  };
}

export function FillingGoldProvider({ children }: { children: ReactNode }) {
  const [vaultState, setVaultState] = useState<VaultState>('opening');
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<FillingProfileBundle[]>([]);
  const [sessions, setSessions] = useState<Array<VersionedValue<SetupSession>>>([]);
  const [repositories, setRepositories] = useState<FillingRepositories | null>(null);
  const [persistence, setPersistence] = useState<PersistenceRequestResult | null>(null);
  const databaseRef = useRef<FillingDatabase | null>(null);
  const revisionRef = useRef(new Map<string, BundleRevisionState>());
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const openDatabase = useCallback(async () => {
    if (databaseRef.current) return databaseRef.current;
    const database = await openFillingDatabase({
      onBlocked: () => setError('Fermer les autres onglets pour mettre à jour le stockage local.'),
      onTerminated: () => {
        setError('Le stockage local a été interrompu. Verrouiller puis rouvrir la Gold.');
        setVaultState('error');
      },
    });
    databaseRef.current = database;
    return database;
  }, []);

  const refresh = useCallback(async () => {
    if (!repositories) return;
    const [profileEntries, sessionEntries] = await Promise.all([
      repositories.profiles.list(),
      repositories.sessions.list(),
    ]);
    const reconstructed = bundlesFromProfiles(profileEntries);
    revisionRef.current = reconstructed.revisions;
    setProfiles(reconstructed.bundles);
    setSessions(sessionEntries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
  }, [repositories]);

  const attachRepositories = useCallback((next: FillingRepositories) => {
    unsubscribeRef.current?.();
    setRepositories(next);
    setVaultState('unlocked');
    setError(null);
    setPersistence(null);
    requestPersistentStorage().then(setPersistence).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    openDatabase()
      .then(async (database) => {
        const enrolled = await readWrappedDataKey(database);
        if (!cancelled) setVaultState(enrolled ? 'locked' : 'needs_setup');
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'Stockage local indisponible.');
          setVaultState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [openDatabase]);

  useEffect(() => {
    if (!repositories) return;
    unsubscribeRef.current = repositories.subscribe(() => void refresh());
    void refresh();
    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, [refresh, repositories]);

  useEffect(
    () => () => {
      unsubscribeRef.current?.();
      repositories?.close();
    },
    [repositories],
  );

  const initializeVault = useCallback(
    async (passphrase: string) => {
      try {
        const database = await openDatabase();
        const enrollment = await initializeLocalEncryption(database, passphrase);
        attachRepositories(new FillingRepositories(database, enrollment.cipher, schemas));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "L'enrôlement local a échoué.");
        throw cause;
      }
    },
    [attachRepositories, openDatabase],
  );

  const unlockVault = useCallback(
    async (passphrase: string) => {
      try {
        const database = await openDatabase();
        const enrollment = await unlockLocalEncryption(database, passphrase);
        attachRepositories(new FillingRepositories(database, enrollment.cipher, schemas));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Phrase secrète incorrecte.');
        throw cause;
      }
    },
    [attachRepositories, openDatabase],
  );

  const lockVault = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    repositories?.close();
    databaseRef.current = null;
    setRepositories(null);
    setProfiles([]);
    setSessions([]);
    setVaultState('locked');
  }, [repositories]);

  const saveProfile = useCallback(
    async (profile: FillingProfileBundle) => {
      if (!repositories) throw new Error('La Gold est verrouillée.');
      const revisions = revisionRef.current.get(profile.id);
      const previous = profiles.find((entry) => entry.id === profile.id);
      const mutations = [
        repositories.profiles.putMutation('machine', profile.profiles.machine, revisions?.machine ?? 0),
        repositories.profiles.putMutation('product', profile.profiles.product, revisions?.product ?? 0),
        repositories.profiles.putMutation('packaging', profile.profiles.packaging, revisions?.packaging ?? 0),
        repositories.profiles.putMutation('controlPlan', profile.profiles.controlPlan, revisions?.controlPlan ?? 0),
        repositories.profiles.putMutation('instrument', profile.profiles.instrument, revisions?.instrument ?? 0),
      ];
      if (profile.profiles.calibration) {
        mutations.push(
          repositories.profiles.putMutation(
            'calibration',
            profile.profiles.calibration,
            revisions?.calibration ?? 0,
          ),
        );
      }
      const existingEvents = (await repositories.events.list()).filter(
        (entry) => !entry.value.sessionId,
      );
      const sequence = existingEvents.reduce(
        (maximum, entry) => Math.max(maximum, entry.value.sequence),
        -1,
      ) + 1;
      const eventType: EventLog['type'] = !previous
        ? 'profile_created'
        : profile.status === 'verified_by_me' && previous.status !== 'verified_by_me'
          ? 'profile_verified'
          : profile.status === 'obsolete'
            ? 'profile_obsoleted'
            : 'profile_updated';
      mutations.push(
        repositories.events.appendMutation({
          id: crypto.randomUUID(),
          sequence,
          type: eventType,
          occurredAt: new Date().toISOString(),
          entityId: profile.id,
          engineVersion: ENGINE_VERSION,
        }),
      );
      await repositories.atomic(mutations);
      await refresh();
    },
    [profiles, refresh, repositories],
  );

  const deleteProfile = useCallback(
    async (profileId: string) => {
      if (!repositories) throw new Error('La Gold est verrouillée.');
      const bundle = profiles.find((profile) => profile.id === profileId);
      const revisions = revisionRef.current.get(profileId);
      if (!bundle || !revisions) return;
      const mutations = [
        repositories.profiles.deleteMutation(bundle.profiles.machine.id, revisions.machine),
        repositories.profiles.deleteMutation(bundle.profiles.product.id, revisions.product),
        repositories.profiles.deleteMutation(bundle.profiles.packaging.id, revisions.packaging),
        repositories.profiles.deleteMutation(bundle.profiles.controlPlan.id, revisions.controlPlan),
        repositories.profiles.deleteMutation(bundle.profiles.instrument.id, revisions.instrument),
      ];
      if (bundle.profiles.calibration && revisions.calibration) {
        mutations.push(
          repositories.profiles.deleteMutation(bundle.profiles.calibration.id, revisions.calibration),
        );
      }
      const existingEvents = (await repositories.events.list()).filter(
        (entry) => !entry.value.sessionId,
      );
      const sequence = existingEvents.reduce(
        (maximum, entry) => Math.max(maximum, entry.value.sequence),
        -1,
      ) + 1;
      mutations.push(
        repositories.events.appendMutation({
          id: crypto.randomUUID(),
          sequence,
          type: 'profile_deleted',
          occurredAt: new Date().toISOString(),
          entityId: profileId,
          engineVersion: ENGINE_VERSION,
        }),
      );
      await repositories.atomic(mutations);
      await refresh();
    },
    [profiles, refresh, repositories],
  );

  const saveSession = useCallback(
    async (session: SetupSession) => {
      if (!repositories) throw new Error('La Gold est verrouillée.');
      const current = sessions.find((entry) => entry.value.id === session.id);
      const existingEvents = await repositories.events.list(session.id);
      const firstSequence = existingEvents.reduce(
        (maximum, entry) => Math.max(maximum, entry.value.sequence),
        -1,
      ) + 1;
      const occurredAt = new Date().toISOString();
      const eventMutations = sessionTransitionEvents(current?.value, session).map((type, index) =>
        repositories.events.appendMutation({
          id: crypto.randomUUID(),
          sequence: firstSequence + index,
          type,
          occurredAt,
          sessionId: session.id,
          engineVersion: ENGINE_VERSION,
          payload: {
            status: session.status,
            iterationCount: session.iterations.length,
            measurementCount: totalMeasurements(session),
          },
        }),
      );
      await repositories.atomic([
        repositories.sessions.putMutation(session, current?.revision ?? 0),
        ...eventMutations,
      ]);
      const saved = await repositories.sessions.get(session.id);
      if (!saved) throw new Error('La session enregistrée ne peut pas être relue.');
      await refresh();
      return saved;
    },
    [refresh, repositories, sessions],
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      if (!repositories) throw new Error('La Gold est verrouillée.');
      const current = sessions.find((entry) => entry.value.id === sessionId);
      if (!current) return;
      await repositories.sessions.delete(sessionId, current.revision);
      await refresh();
    },
    [refresh, repositories, sessions],
  );

  const value = useMemo<FillingGoldContextValue>(
    () => ({
      vaultState,
      error,
      profiles,
      sessions,
      persistence,
      initializeVault,
      unlockVault,
      lockVault,
      saveProfile,
      deleteProfile,
      saveSession,
      deleteSession,
      refresh,
      repositories,
    }),
    [
      vaultState,
      error,
      profiles,
      sessions,
      persistence,
      initializeVault,
      unlockVault,
      lockVault,
      saveProfile,
      deleteProfile,
      saveSession,
      deleteSession,
      refresh,
      repositories,
    ],
  );

  return <FillingGoldContext.Provider value={value}>{children}</FillingGoldContext.Provider>;
}

// Provider and hook intentionally share the same module to keep the context contract private.
// eslint-disable-next-line react-refresh/only-export-components
export function useFillingGold(): FillingGoldContextValue {
  const value = useContext(FillingGoldContext);
  if (!value) throw new Error('useFillingGold doit être utilisé dans FillingGoldProvider.');
  return value;
}
