import { ENGINE_VERSION } from '../domain/engineVersion';
import { measurementValueForBasis, normalizeMeasurement } from '../domain/tare';
import { calculateSampleStatistics } from '../domain/statistics';
import { evaluateStartCriterion } from '../domain/decision';
import { recommendCorrection } from '../domain/correction';
import { calculateTargetsFromProfiles } from '../domain/targets';
import { DomainError } from '../domain/decimal';
import { validateContext } from '../domain/invariants';
import type {
  DecisionReason,
  DecisionReasonCode,
  DecisionSignals,
  FillingContext,
  MeasurementInput,
  ProfileSnapshots,
  SetupDecision,
  SetupIteration,
  SetupSession,
} from '../domain/models';

const VALIDATION_REASON_CODES = new Set<DecisionReasonCode>([
  'profile_not_verified',
  'profile_obsolete',
  'instrument_not_valid',
  'instrument_capacity_exceeded',
  'reference_expired',
  'reference_not_yet_valid',
  'machine_capacity_exceeded',
  'context_incompatible',
  'calibration_incompatible',
  'density_outside_plausible_range',
  'gross_target_requires_fixed_tare',
  'fixed_tare_missing',
]);

function contextStopReasons(
  session: Pick<SetupSession, 'mode' | 'context' | 'profiles'>,
  now: Date,
): DecisionReason[] {
  return validateContext({
    mode: session.mode,
    context: session.context,
    profiles: session.profiles,
    now,
  }).issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => ({
      code: VALIDATION_REASON_CODES.has(issue.code as DecisionReasonCode)
        ? issue.code as DecisionReasonCode
        : 'explicit_stop_rule',
      message: issue.message,
      actual: issue.path,
    }));
}

export interface SessionClock {
  now(): string;
  id(): string;
}

export const browserSessionClock: SessionClock = {
  now: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

function currentIteration(session: SetupSession): SetupIteration {
  const iteration = session.iterations[session.iterations.length - 1];
  if (!iteration) {
    throw new DomainError('missing_iteration', "La session ne contient aucune itération.");
  }
  return iteration;
}

function ensureEditable(session: SetupSession): void {
  if (session.status !== 'active' && session.status !== 'draft') {
    throw new DomainError('session_not_editable', "Cette session n'est plus modifiable.");
  }
}

export function createSetupSession(
  mode: SetupSession['mode'],
  context: FillingContext,
  profiles: ProfileSnapshots,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  const now = clock.now();
  if (mode === 'real') {
    const stopReasons = contextStopReasons({ mode, context, profiles }, new Date(now));
    if (stopReasons.length > 0) {
      throw new DomainError(
        'unsafe_real_context',
        `Le réglage réel est bloqué : ${stopReasons.map((reason) => reason.message).join(' ')}`,
      );
    }
  }
  const targets = calculateTargetsFromProfiles(profiles.product, profiles.packaging);

  return {
    id: clock.id(),
    mode,
    status: 'draft',
    context: clone(context),
    profiles: clone(profiles),
    targets,
    engineVersion: ENGINE_VERSION,
    iterations: [
      {
        id: clock.id(),
        index: 1,
        startedAt: now,
        measurements: [],
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function activateSession(
  session: SetupSession,
  appliedSetting: string | undefined,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  const now = clock.now();
  const next = clone(session);
  next.status = 'active';
  next.updatedAt = now;
  const iteration = currentIteration(next);
  iteration.appliedSetting = appliedSetting?.trim() || undefined;
  iteration.appliedSettingUnit = next.profiles.machine.unit;
  return next;
}

export function addMeasurement(
  session: SetupSession,
  input: MeasurementInput,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  if (session.status !== 'active') {
    throw new DomainError('session_not_active', "La consigne doit être appliquée avant la saisie.");
  }
  const next = clone(session);
  const iteration = currentIteration(next);
  if (iteration.decision) {
    throw new DomainError('iteration_already_analyzed', "Cette itération a déjà été analysée.");
  }
  if (iteration.measurements.some((measurement) => measurement.id === input.id)) {
    throw new DomainError('duplicate_measurement_id', "Cette mesure existe déjà.");
  }
  const includedCount = iteration.measurements.filter((measurement) => !measurement.excluded).length;
  if (!input.excluded && includedCount >= next.profiles.controlPlan.sampleSize) {
    throw new DomainError(
      'sample_already_complete',
      "L'échantillon prévu est complet. Analyser ou exclure une mesure avant d'en ajouter une autre.",
    );
  }
  iteration.measurements.push(
    normalizeMeasurement(
      { ...input, capturedAt: input.capturedAt ?? clock.now() },
      next.profiles.packaging,
    ),
  );
  next.updatedAt = clock.now();
  return next;
}

export function removeLastMeasurement(
  session: SetupSession,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  const next = clone(session);
  const iteration = currentIteration(next);
  if (iteration.decision) {
    throw new DomainError('iteration_already_analyzed', "L'analyse doit être annulée avant modification.");
  }
  iteration.measurements.pop();
  next.updatedAt = clock.now();
  return next;
}

export function setMeasurementExclusion(
  session: SetupSession,
  measurementId: string,
  excluded: boolean,
  reason: string | undefined,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  if (excluded && !reason?.trim()) {
    throw new DomainError('exclusion_reason_required', "Un motif d'exclusion est obligatoire.");
  }
  const next = clone(session);
  const iteration = currentIteration(next);
  if (iteration.decision) {
    throw new DomainError('iteration_already_analyzed', "L'analyse doit être annulée avant modification.");
  }
  const measurement = iteration.measurements.find((item) => item.id === measurementId);
  if (!measurement) throw new DomainError('measurement_not_found', "Mesure introuvable.");
  measurement.excluded = excluded;
  measurement.exclusionReason = excluded ? reason?.trim() : undefined;
  next.updatedAt = clock.now();
  return next;
}

function targetForDecision(session: SetupSession): string {
  switch (session.profiles.controlPlan.startCriterion.basis) {
    case 'net_mass_g':
      return session.targets.netMassG;
    case 'gross_mass_g':
      if (!session.targets.grossMassG) {
        throw new DomainError(
          'gross_target_unavailable',
          'Un critère BRUT nécessite une tare fixe applicable.',
        );
      }
      return session.targets.grossMassG;
    case 'volume_ml':
      return session.targets.volumeMl;
  }
}

export function analyzeCurrentIteration(
  session: SetupSession,
  signals: DecisionSignals = {},
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  const next = clone(session);
  const iteration = currentIteration(next);
  const criterion = next.profiles.controlPlan.startCriterion;
  const statistics = calculateSampleStatistics({
    measurements: iteration.measurements,
    basis: criterion.basis,
    densityGPerMl: next.profiles.product.density.valueGPerMl,
  });
  const includedValues = iteration.measurements
    .filter((measurement) => !measurement.excluded)
    .map((measurement) =>
      measurementValueForBasis(
        measurement,
        criterion.basis,
        next.profiles.product.density.valueGPerMl,
      ),
    );
  const decision = evaluateStartCriterion({
    target: targetForDecision(next),
    statistics,
    includedValues,
    controlPlan: next.profiles.controlPlan,
    signals: {
      ...signals,
      currentIteration: iteration.index,
      stopReasons: [
        ...contextStopReasons(next, new Date(clock.now())),
        ...(signals.stopReasons ?? []),
      ],
    },
  });

  iteration.statistics = statistics;
  iteration.decision = decision;
  iteration.completedAt = clock.now();

  if (decision.status === 'correct') {
    const netStatistics = calculateSampleStatistics({
      measurements: iteration.measurements,
      basis: 'net_mass_g',
    });
    iteration.recommendation = recommendCorrection({
      decision,
      targetNetMassG: next.targets.netMassG,
      measuredMeanNetMassG: netStatistics.mean,
      densityGPerMl: next.profiles.product.density.valueGPerMl,
      maxCorrectionG: next.profiles.controlPlan.maxCorrectionG,
      machine: next.profiles.machine,
      calibration: next.profiles.calibration,
      currentSetting: iteration.appliedSetting,
    });
  }

  if (decision.status === 'achieved') next.status = 'criterion_achieved';
  if (decision.status === 'stop') next.status = 'stopped';
  next.updatedAt = clock.now();
  if (next.status === 'criterion_achieved' || next.status === 'stopped') {
    next.completedAt = next.updatedAt;
  }
  return next;
}

export function beginCorrectionIteration(
  session: SetupSession,
  appliedSetting: string | undefined,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  const previous = currentIteration(session);
  if (previous.decision?.status !== 'correct' || !previous.recommendation) {
    throw new DomainError('correction_not_allowed', "Aucune correction n'est autorisée.");
  }
  const maximumIterations = session.profiles.controlPlan.maxIterations;
  if (maximumIterations !== undefined && previous.index >= maximumIterations) {
    throw new DomainError(
      'maximum_iterations_reached',
      "Le nombre maximal d'itérations est atteint. Arrêter et appeler le référent.",
    );
  }
  const next = clone(session);
  const now = clock.now();
  next.iterations.push({
    id: clock.id(),
    index: previous.index + 1,
    startedAt: now,
    appliedSetting: appliedSetting?.trim() || undefined,
    appliedSettingUnit: next.profiles.machine.unit,
    measurements: [],
  });
  next.status = 'active';
  next.updatedAt = now;
  return next;
}

export function reopenCurrentIteration(
  session: SetupSession,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  const next = clone(session);
  const iteration = currentIteration(next);
  if (!iteration.decision || !['collect_more', 'investigate'].includes(iteration.decision.status)) {
    throw new DomainError('iteration_not_reopenable', "Cette analyse ne peut pas être rouverte.");
  }
  iteration.statistics = undefined;
  iteration.decision = undefined;
  iteration.recommendation = undefined;
  iteration.completedAt = undefined;
  next.status = 'active';
  next.completedAt = undefined;
  next.updatedAt = clock.now();
  return next;
}

export function stopSession(
  session: SetupSession,
  note: string,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  if (!note.trim()) throw new DomainError('stop_reason_required', "Le motif d'arrêt est obligatoire.");
  const next = clone(session);
  const now = clock.now();
  next.status = 'stopped';
  next.updatedAt = now;
  next.completedAt = now;
  currentIteration(next).operatorNote = note.trim();
  return next;
}

export function recordIterationNote(
  session: SetupSession,
  note: string,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  const next = clone(session);
  currentIteration(next).operatorNote = note.trim() || undefined;
  next.updatedAt = clock.now();
  return next;
}

export function abandonSession(
  session: SetupSession,
  note?: string,
  clock: SessionClock = browserSessionClock,
): SetupSession {
  ensureEditable(session);
  const next = clone(session);
  const now = clock.now();
  next.status = 'abandoned';
  next.updatedAt = now;
  next.completedAt = now;
  currentIteration(next).operatorNote = note?.trim() || undefined;
  return next;
}

export function sessionDecision(session: SetupSession): SetupDecision | undefined {
  return session.iterations[session.iterations.length - 1]?.decision;
}
