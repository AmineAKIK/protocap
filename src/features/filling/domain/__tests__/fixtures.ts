import type {
  CalibrationProfile,
  ControlPlanProfile,
  InstrumentProfile,
  MachineProfile,
  PackagingProfile,
  ProductProfile,
  SourceMetadata,
} from '../models'

export const NOW = '2026-07-16T10:00:00.000Z'

export const source: SourceMetadata = {
  label: 'Procédure atelier',
  documentReference: 'PROC-REMPL-001',
  version: '3',
  effectiveDate: '2026-01-01T00:00:00.000Z',
}

const profileBase = {
  version: '1',
  status: 'verified_by_me' as const,
  source,
  createdAt: NOW,
  updatedAt: NOW,
  verifiedAt: NOW,
}

export function machineProfile(
  overrides: Partial<MachineProfile> = {},
): MachineProfile {
  return {
    ...profileBase,
    id: 'machine-1',
    name: 'Remplisseuse 1',
    setpointType: 'net_mass',
    unit: 'g',
    resolution: '0.01',
    roundingPolicy: 'nearest_half_up',
    minimum: '0',
    maximum: '50',
    increaseDirection: 'higher_value',
    headIds: [],
    ...overrides,
  }
}

export function productProfile(
  overrides: Partial<ProductProfile> = {},
): ProductProfile {
  return {
    ...profileBase,
    id: 'product-1',
    name: 'Produit 1',
    sku: 'SKU-1',
    designation: 'Produit de référence',
    approvedTargetVolumeMl: '5.17',
    density: {
      valueGPerMl: '1.019',
      referenceTemperatureC: '20',
      measurementType: 'mass_density_g_per_ml',
      source,
    },
    ...overrides,
  }
}

export function packagingProfile(
  overrides: Partial<PackagingProfile> = {},
): PackagingProfile {
  return {
    ...profileBase,
    id: 'packaging-1',
    name: 'Tube 1',
    formatCode: 'TUBE-1',
    description: 'Tube complet',
    includedComponents: ['tube', 'bouchon'],
    weighingState: 'Tube plein, fermé et marqué',
    tareMode: 'fixed',
    fixedTare: {
      meanG: '5.00',
      sampleSize: 20,
      standardDeviationG: '0.03',
      measuredAt: NOW,
      source,
    },
    ...overrides,
  }
}

export function controlPlanProfile(
  overrides: Partial<ControlPlanProfile> = {},
): ControlPlanProfile {
  return {
    ...profileBase,
    id: 'control-1',
    name: 'Plan démarrage',
    sampleSize: 3,
    startCriterion: {
      basis: 'net_mass_g',
      meanLowerDeviation: '0.05',
      meanUpperDeviation: '0.05',
      correctionDeadband: '0.01',
      maxStandardDeviation: '0.10',
      maxRange: '0.25',
      individualLowerDeviation: '0.20',
      individualUpperDeviation: '0.20',
      maxUnitsOutsideIndividualLimits: 0,
    },
    maxCorrectionG: '0.50',
    maxIterations: 5,
    exclusionReasons: ['Erreur de manipulation'],
    stopRules: ['Fuite produit'],
    ...overrides,
  }
}

export function instrumentProfile(
  overrides: Partial<InstrumentProfile> = {},
): InstrumentProfile {
  return {
    ...profileBase,
    id: 'instrument-1',
    name: 'Balance 1',
    serialNumber: 'BAL-001',
    unit: 'g',
    resolutionG: '0.01',
    minimumG: '0',
    maximumG: '500',
    verificationStatus: 'valid',
    lastVerifiedAt: NOW,
    verificationValidUntil: '2027-07-16T00:00:00.000Z',
    ...overrides,
  }
}

export function calibrationProfile(
  overrides: Partial<CalibrationProfile> = {},
): CalibrationProfile {
  return {
    ...profileBase,
    id: 'calibration-1',
    name: 'Calibration locale',
    machineId: 'machine-1',
    model: 'linear_local',
    slopeGPerSettingUnit: '0.2',
    interceptG: '0',
    validSettingMinimum: '20',
    validSettingMaximum: '30',
    approachDirection: 'increasing',
    backlashSettingUnits: '0.1',
    uncertaintyG: '0.02',
    points: [
      { setting: '20', netMassG: '4' },
      { setting: '30', netMassG: '6' },
    ],
    ...overrides,
  }
}

