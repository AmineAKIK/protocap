import { describe, expect, it } from 'vitest';
import {
  emptyFillingProfileForm,
  profileBundleFromForm,
  type FillingProfileForm,
} from '../profileBundle';

function validForm(): FillingProfileForm {
  return {
    ...emptyFillingProfileForm,
    label: 'Produit A · Tube 5 mL · Machine 1',
    version: '1',
    status: 'verified_by_me',
    machineName: 'Remplisseuse 1',
    machineSource: 'Notice machine M1',
    setpointType: 'net_mass',
    machineUnit: 'g',
    resolution: '0,01',
    minimum: '0',
    maximum: '50',
    increaseDirection: 'higher_value',
    productSku: 'SKU-A',
    productName: 'Produit A',
    targetVolumeMl: '5,17',
    densityGPerMl: '1,019',
    densityPlausibleMinimumGPerMl: '0,5',
    densityPlausibleMaximumGPerMl: '2',
    productSource: 'Fiche produit A',
    packagingName: 'Tube 5 mL',
    formatCode: 'T5',
    includedComponents: 'tube, bouchon',
    weighingState: 'tube rempli fermé',
    tareMode: 'fixed',
    fixedTareMeanG: '5,00',
    fixedTareSampleSize: '20',
    tareSource: 'Étude tare T5',
    controlPlanName: 'Démarrage A',
    sampleSize: '3',
    criterionBasis: 'net_mass_g',
    meanLowerDeviation: '0,05',
    meanUpperDeviation: '0,05',
    correctionDeadband: '0,01',
    maxCorrectionG: '0,5',
    maxUnitsOutsideIndividualLimits: '0',
    maxIterations: '5',
    controlPlanSource: 'Procédure démarrage',
    instrumentName: 'Balance 1',
    instrumentSerialNumber: 'BAL-001',
    instrumentResolutionG: '0,01',
    instrumentMinimumG: '0',
    instrumentMaximumG: '500',
    instrumentVerificationStatus: 'valid',
    instrumentValidUntil: '2027-12-31',
    instrumentSource: 'Registre métrologie',
  };
}

describe('profileBundleFromForm', () => {
  it('normalise les virgules et stocke la barrière plausible de masse volumique', () => {
    const bundle = profileBundleFromForm(
      validForm(),
      undefined,
      '2026-07-16T12:00:00.000Z',
      'bundle-1',
    );
    expect(bundle.profiles.product.density.valueGPerMl).toBe('1.019');
    expect(bundle.profiles.product.plausibleDensityRangeGPerMl).toEqual({
      minimum: '0.5',
      maximum: '2',
    });
    expect(bundle.profiles.controlPlan.startCriterion.maxUnitsOutsideIndividualLimits).toBe(0);
  });

  it('refuse 1019 et indique le facteur mille suspecté', () => {
    const form = validForm();
    form.densityGPerMl = '1019';
    expect(() =>
      profileBundleFromForm(form, undefined, '2026-07-16T12:00:00.000Z', 'bundle-2'),
    ).toThrow(/facteur 1 000.*1\.019/i);
  });
});
