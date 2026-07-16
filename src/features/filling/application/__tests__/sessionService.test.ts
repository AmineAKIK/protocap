import { describe, expect, it } from 'vitest';
import {
  controlPlanProfile,
  instrumentProfile,
  machineProfile,
  packagingProfile,
  productProfile,
} from '../../domain/__tests__/fixtures';
import type { FillingContext, ProfileSnapshots, SetupSession } from '../../domain/models';
import {
  activateSession,
  addMeasurement,
  analyzeCurrentIteration,
  beginCorrectionIteration,
  createSetupSession,
  recordIterationNote,
  type SessionClock,
} from '../sessionService';

const context: FillingContext = {
  machineId: 'machine-1',
  productId: 'product-1',
  packagingId: 'packaging-1',
  controlPlanId: 'control-1',
  instrumentId: 'instrument-1',
};

function clock(): SessionClock {
  let id = 0;
  return {
    now: () => '2026-07-16T12:00:00.000Z',
    id: () => `id-${++id}`,
  };
}

function profiles(overrides: Partial<ProfileSnapshots> = {}): ProfileSnapshots {
  return {
    machine: machineProfile(),
    product: productProfile({
      plausibleDensityRangeGPerMl: { minimum: '0.5', maximum: '2' },
    }),
    packaging: packagingProfile(),
    controlPlan: controlPlanProfile(),
    instrument: instrumentProfile(),
    ...overrides,
  };
}

function addGrossSample(
  session: SetupSession,
  values: string[],
  sessionClock: SessionClock,
): SetupSession {
  return values.reduce(
    (current, grossMassG, index) =>
      addMeasurement(
        current,
        { id: `measurement-${current.iterations.length}-${index}`, mode: 'fixed', grossMassG },
        sessionClock,
      ),
    session,
  );
}

describe('sessionService', () => {
  it('réalise le parcours de référence jusqu’au critère atteint sans arrondi intermédiaire', () => {
    const sessionClock = clock();
    let session = createSetupSession('real', context, profiles(), sessionClock);
    expect(session.targets).toMatchObject({ netMassG: '5.26823', grossMassG: '10.26823' });

    session = activateSession(session, '5.27', sessionClock);
    session = addGrossSample(session, ['10.27', '10.27', '10.27'], sessionClock);
    session = analyzeCurrentIteration(session, {}, sessionClock);

    expect(session.status).toBe('criterion_achieved');
    expect(session.iterations[0].statistics?.mean).toBe('5.27');
    expect(session.iterations[0].decision?.status).toBe('achieved');
  });

  it('guide une correction, exige un nouvel échantillon puis converge', () => {
    const sessionClock = clock();
    const basePlan = controlPlanProfile();
    const safeCorrectionPlan = controlPlanProfile({
      startCriterion: {
        ...basePlan.startCriterion,
        individualLowerDeviation: '1',
        individualUpperDeviation: '1',
      },
    });
    let session = createSetupSession(
      'real',
      context,
      profiles({ controlPlan: safeCorrectionPlan }),
      sessionClock,
    );
    session = activateSession(session, '5', sessionClock);
    session = addGrossSample(session, ['10', '10', '10'], sessionClock);
    session = analyzeCurrentIteration(session, {}, sessionClock);

    expect(session.iterations[0].decision?.status).toBe('correct');
    expect(session.iterations[0].recommendation).toMatchObject({
      direction: 'increase_fill',
      recommendedChangeG: '0.26823',
    });

    session = beginCorrectionIteration(session, '5.27', sessionClock);
    session = addGrossSample(session, ['10.27', '10.27', '10.27'], sessionClock);
    session = analyzeCurrentIteration(session, {}, sessionClock);
    expect(session.status).toBe('criterion_achieved');
    expect(session.iterations).toHaveLength(2);
  });

  it('bloque un contexte réel non sûr avant toute session', () => {
    const sessionClock = clock();
    expect(() =>
      createSetupSession(
        'real',
        context,
        profiles({ instrument: instrumentProfile({ verificationStatus: 'expired' }) }),
        sessionClock,
      ),
    ).toThrow(/réglage réel est bloqué/i);
  });

  it('interdit une mesure incluse en trop et arrête à la dernière itération autorisée', () => {
    const sessionClock = clock();
    const basePlan = controlPlanProfile();
    const oneIterationPlan = controlPlanProfile({
      maxIterations: 1,
      startCriterion: {
        ...basePlan.startCriterion,
        individualLowerDeviation: '1',
        individualUpperDeviation: '1',
      },
    });
    let session = createSetupSession(
      'real',
      context,
      profiles({ controlPlan: oneIterationPlan }),
      sessionClock,
    );
    session = activateSession(session, '5', sessionClock);
    session = addGrossSample(session, ['10', '10', '10'], sessionClock);

    expect(() =>
      addMeasurement(
        session,
        { id: 'measurement-too-many', mode: 'fixed', grossMassG: '10' },
        sessionClock,
      ),
    ).toThrow(/échantillon prévu est complet/i);

    session = analyzeCurrentIteration(session, {}, sessionClock);
    expect(session.status).toBe('stopped');
    expect(session.iterations[0].decision?.reasons[0].code).toBe('maximum_iterations_reached');
  });

  it('conserve la décision opérateur shadow après le calcul terminal masqué', () => {
    const sessionClock = clock();
    let session = createSetupSession('shadow', context, profiles(), sessionClock);
    session = activateSession(session, '5.27', sessionClock);
    session = addGrossSample(session, ['10.27', '10.27', '10.27'], sessionClock);
    session = analyzeCurrentIteration(session, {}, sessionClock);
    expect(session.status).toBe('criterion_achieved');
    expect(session.iterations[0].operatorNote).toBeUndefined();

    session = recordIterationNote(session, 'shadow-observation:atteint|5.27', sessionClock);
    expect(session.iterations[0].operatorNote).toBe('shadow-observation:atteint|5.27');
    expect(session.iterations[0].decision?.status).toBe('achieved');
  });
});
