import type {
  ControlPlanProfile,
  FillingContext,
  InstrumentProfile,
  MachineProfile,
  PackagingProfile,
  ProductProfile,
  ProfileSnapshots,
  ProfileStatus,
  SourceMetadata,
} from '../domain/models';
import { decimal } from '../domain/decimal';
import { parseDecimalInput, parseRequiredDecimal } from '../domain/inputParser';

export interface FillingProfileBundle {
  id: string;
  label: string;
  version: string;
  status: ProfileStatus;
  createdAt: string;
  updatedAt: string;
  verifiedAt?: string;
  profiles: ProfileSnapshots;
}

export interface FillingProfileForm {
  label: string;
  version: string;
  status: ProfileStatus;
  machineName: string;
  line: string;
  setpointType: MachineProfile['setpointType'];
  machineUnit: MachineProfile['unit'];
  resolution: string;
  minimum: string;
  maximum: string;
  roundingPolicy: MachineProfile['roundingPolicy'];
  increaseDirection: MachineProfile['increaseDirection'];
  machineSource: string;
  productSku: string;
  productName: string;
  targetVolumeMl: string;
  densityGPerMl: string;
  densityPlausibleMinimumGPerMl: string;
  densityPlausibleMaximumGPerMl: string;
  referenceTemperatureC: string;
  productSource: string;
  packagingName: string;
  formatCode: string;
  includedComponents: string;
  weighingState: string;
  tareMode: PackagingProfile['tareMode'];
  fixedTareMeanG: string;
  fixedTareSampleSize: string;
  fixedTareStandardDeviationG: string;
  tareSource: string;
  controlPlanName: string;
  sampleSize: string;
  criterionBasis: ControlPlanProfile['startCriterion']['basis'];
  meanLowerDeviation: string;
  meanUpperDeviation: string;
  correctionDeadband: string;
  maxStandardDeviation: string;
  maxRange: string;
  individualLowerDeviation: string;
  individualUpperDeviation: string;
  maxUnitsOutsideIndividualLimits: string;
  maxCorrectionG: string;
  maxIterations: string;
  controlPlanSource: string;
  instrumentName: string;
  instrumentSerialNumber: string;
  instrumentResolutionG: string;
  instrumentMinimumG: string;
  instrumentMaximumG: string;
  instrumentVerificationStatus: InstrumentProfile['verificationStatus'];
  instrumentValidUntil: string;
  instrumentSource: string;
}

export const emptyFillingProfileForm: FillingProfileForm = {
  label: '',
  version: '1',
  status: 'draft',
  machineName: '',
  line: '',
  setpointType: 'mechanical',
  machineUnit: 'graduation',
  resolution: '0.1',
  minimum: '0',
  maximum: '100',
  roundingPolicy: 'nearest_half_up',
  increaseDirection: 'clockwise',
  machineSource: '',
  productSku: '',
  productName: '',
  targetVolumeMl: '',
  densityGPerMl: '',
  densityPlausibleMinimumGPerMl: '0.5',
  densityPlausibleMaximumGPerMl: '2',
  referenceTemperatureC: '20',
  productSource: '',
  packagingName: '',
  formatCode: '',
  includedComponents: 'tube, bouchon',
  weighingState: 'tube rempli complet',
  tareMode: 'fixed',
  fixedTareMeanG: '',
  fixedTareSampleSize: '20',
  fixedTareStandardDeviationG: '',
  tareSource: '',
  controlPlanName: 'Démarrage',
  sampleSize: '',
  criterionBasis: 'net_mass_g',
  meanLowerDeviation: '',
  meanUpperDeviation: '',
  correctionDeadband: '0',
  maxStandardDeviation: '',
  maxRange: '',
  individualLowerDeviation: '',
  individualUpperDeviation: '',
  maxUnitsOutsideIndividualLimits: '',
  maxCorrectionG: '',
  maxIterations: '5',
  controlPlanSource: '',
  instrumentName: '',
  instrumentSerialNumber: '',
  instrumentResolutionG: '0.01',
  instrumentMinimumG: '0',
  instrumentMaximumG: '',
  instrumentVerificationStatus: 'unknown',
  instrumentValidUntil: '',
  instrumentSource: '',
};

function source(label: string, version: string): SourceMetadata {
  return { label: label.trim(), version };
}

function optionalDecimal(value: string): string | undefined {
  return value.trim() ? parseRequiredDecimal(value, { allowZero: true }) : undefined;
}

const nonNegativeDecimal = (value: string) => parseRequiredDecimal(value, { allowZero: true });

function requiredInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${field} doit être un entier strictement positif.`);
  }
  return parsed;
}

function nonNegativeInteger(value: string, field: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${field} doit être un entier positif ou nul.`);
  }
  return parsed;
}

function densityWithinConfiguredRange(value: string, minimum: string, maximum: string): string {
  const parsedMinimum = parseRequiredDecimal(minimum);
  const parsedMaximum = parseRequiredDecimal(maximum);
  if (decimal(parsedMinimum).gte(parsedMaximum)) {
    throw new Error('La borne plausible maximale de masse volumique doit dépasser la borne minimale.');
  }
  const result = parseDecimalInput(value, {
    minimum: parsedMinimum,
    maximum: parsedMaximum,
    detectFactorThousand: true,
  });
  if (result.status !== 'valid') {
    const suggestion = 'warnings' in result && result.warnings[0]?.message;
    throw new Error(suggestion ? `${result.message} ${suggestion}` : result.message);
  }
  return result.value;
}

export function profileBundleFromForm(
  form: FillingProfileForm,
  existing?: FillingProfileBundle,
  now = new Date().toISOString(),
  id = existing?.id ?? crypto.randomUUID(),
): FillingProfileBundle {
  const status = form.status;
  const verifiedAt = status === 'verified_by_me' ? existing?.verifiedAt ?? now : undefined;
  const base = (suffix: string, name: string, metadata: SourceMetadata) => ({
    id: `${id}:${suffix}`,
    name: name.trim(),
    version: form.version.trim(),
    status,
    source: metadata,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    verifiedAt,
  });

  const machine: MachineProfile = {
    ...base('machine', form.machineName, source(form.machineSource, form.version)),
    line: form.line.trim() || undefined,
    setpointType: form.setpointType,
    unit: form.machineUnit,
    resolution: parseRequiredDecimal(form.resolution),
    roundingPolicy: form.roundingPolicy,
    minimum: nonNegativeDecimal(form.minimum),
    maximum: parseRequiredDecimal(form.maximum),
    increaseDirection: form.increaseDirection,
    headIds: [],
  };
  machine.source.notes = `gold-bundle-label:${form.label.trim()}`;

  const densitySource = source(form.productSource, form.version);
  const plausibleDensityMinimum = parseRequiredDecimal(form.densityPlausibleMinimumGPerMl);
  const plausibleDensityMaximum = parseRequiredDecimal(form.densityPlausibleMaximumGPerMl);
  const densityGPerMl = densityWithinConfiguredRange(
    form.densityGPerMl,
    plausibleDensityMinimum,
    plausibleDensityMaximum,
  );
  const product: ProductProfile = {
    ...base('product', form.productName, densitySource),
    sku: form.productSku.trim(),
    designation: form.productName.trim(),
    approvedTargetVolumeMl: parseRequiredDecimal(form.targetVolumeMl),
    density: {
      valueGPerMl: densityGPerMl,
      referenceTemperatureC: parseRequiredDecimal(form.referenceTemperatureC),
      measurementType: 'mass_density_g_per_ml',
      source: densitySource,
    },
    plausibleDensityRangeGPerMl: {
      minimum: plausibleDensityMinimum,
      maximum: plausibleDensityMaximum,
    },
  };

  const tareSource = source(form.tareSource, form.version);
  const packaging: PackagingProfile = {
    ...base('packaging', form.packagingName, tareSource),
    formatCode: form.formatCode.trim(),
    description: form.packagingName.trim(),
    includedComponents: form.includedComponents
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    weighingState: form.weighingState.trim(),
    tareMode: form.tareMode,
    fixedTare:
      form.tareMode === 'fixed'
        ? {
            meanG: parseRequiredDecimal(form.fixedTareMeanG),
            sampleSize: requiredInteger(form.fixedTareSampleSize, 'Taille de la tare'),
            standardDeviationG: optionalDecimal(form.fixedTareStandardDeviationG),
            measuredAt: now,
            source: tareSource,
          }
        : undefined,
  };

  const controlPlan: ControlPlanProfile = {
    ...base(
      'control-plan',
      form.controlPlanName,
      source(form.controlPlanSource, form.version),
    ),
    sampleSize: requiredInteger(form.sampleSize, "Taille d'échantillon"),
    startCriterion: {
      basis: form.criterionBasis,
      meanLowerDeviation: nonNegativeDecimal(form.meanLowerDeviation),
      meanUpperDeviation: nonNegativeDecimal(form.meanUpperDeviation),
      correctionDeadband: nonNegativeDecimal(form.correctionDeadband),
      maxStandardDeviation: optionalDecimal(form.maxStandardDeviation),
      maxRange: optionalDecimal(form.maxRange),
      individualLowerDeviation: optionalDecimal(form.individualLowerDeviation),
      individualUpperDeviation: optionalDecimal(form.individualUpperDeviation),
      maxUnitsOutsideIndividualLimits: form.maxUnitsOutsideIndividualLimits.trim()
        ? nonNegativeInteger(form.maxUnitsOutsideIndividualLimits, 'Nombre hors limites')
        : undefined,
    },
    maxCorrectionG: parseRequiredDecimal(form.maxCorrectionG),
    maxIterations: form.maxIterations.trim()
      ? requiredInteger(form.maxIterations, "Nombre maximal d'itérations")
      : undefined,
    exclusionReasons: ['Erreur de transcription', 'Erreur de manipulation', 'Tube endommagé'],
    stopRules: [],
  };

  const instrument: InstrumentProfile = {
    ...base(
      'instrument',
      form.instrumentName,
      source(form.instrumentSource, form.version),
    ),
    serialNumber: form.instrumentSerialNumber.trim(),
    unit: 'g',
    resolutionG: parseRequiredDecimal(form.instrumentResolutionG),
    minimumG: nonNegativeDecimal(form.instrumentMinimumG),
    maximumG: parseRequiredDecimal(form.instrumentMaximumG),
    verificationStatus: form.instrumentVerificationStatus,
    verificationValidUntil: form.instrumentValidUntil
      ? new Date(`${form.instrumentValidUntil}T23:59:59.999Z`).toISOString()
      : undefined,
  };

  return {
    id,
    label: form.label.trim(),
    version: form.version.trim(),
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    verifiedAt,
    profiles: { machine, product, packaging, controlPlan, instrument },
  };
}

export function profileBundleToForm(bundle: FillingProfileBundle): FillingProfileForm {
  const { machine, product, packaging, controlPlan, instrument } = bundle.profiles;
  const criterion = controlPlan.startCriterion;
  return {
    label: bundle.label,
    version: bundle.version,
    status: bundle.status,
    machineName: machine.name,
    line: machine.line ?? '',
    setpointType: machine.setpointType,
    machineUnit: machine.unit,
    resolution: machine.resolution,
    minimum: machine.minimum,
    maximum: machine.maximum,
    roundingPolicy: machine.roundingPolicy,
    increaseDirection: machine.increaseDirection,
    machineSource: machine.source.label,
    productSku: product.sku,
    productName: product.designation,
    targetVolumeMl: product.approvedTargetVolumeMl,
    densityGPerMl: product.density.valueGPerMl,
    densityPlausibleMinimumGPerMl: product.plausibleDensityRangeGPerMl?.minimum ?? '0.5',
    densityPlausibleMaximumGPerMl: product.plausibleDensityRangeGPerMl?.maximum ?? '2',
    referenceTemperatureC: product.density.referenceTemperatureC,
    productSource: product.source.label,
    packagingName: packaging.name,
    formatCode: packaging.formatCode,
    includedComponents: packaging.includedComponents.join(', '),
    weighingState: packaging.weighingState,
    tareMode: packaging.tareMode,
    fixedTareMeanG: packaging.fixedTare?.meanG ?? '',
    fixedTareSampleSize: String(packaging.fixedTare?.sampleSize ?? 20),
    fixedTareStandardDeviationG: packaging.fixedTare?.standardDeviationG ?? '',
    tareSource: packaging.source.label,
    controlPlanName: controlPlan.name,
    sampleSize: String(controlPlan.sampleSize),
    criterionBasis: criterion.basis,
    meanLowerDeviation: criterion.meanLowerDeviation,
    meanUpperDeviation: criterion.meanUpperDeviation,
    correctionDeadband: criterion.correctionDeadband,
    maxStandardDeviation: criterion.maxStandardDeviation ?? '',
    maxRange: criterion.maxRange ?? '',
    individualLowerDeviation: criterion.individualLowerDeviation ?? '',
    individualUpperDeviation: criterion.individualUpperDeviation ?? '',
    maxUnitsOutsideIndividualLimits: String(criterion.maxUnitsOutsideIndividualLimits ?? ''),
    maxCorrectionG: controlPlan.maxCorrectionG,
    maxIterations: String(controlPlan.maxIterations ?? ''),
    controlPlanSource: controlPlan.source.label,
    instrumentName: instrument.name,
    instrumentSerialNumber: instrument.serialNumber,
    instrumentResolutionG: instrument.resolutionG,
    instrumentMinimumG: instrument.minimumG,
    instrumentMaximumG: instrument.maximumG,
    instrumentVerificationStatus: instrument.verificationStatus,
    instrumentValidUntil: instrument.verificationValidUntil?.slice(0, 10) ?? '',
    instrumentSource: instrument.source.label,
  };
}

export function buildContext(bundle: FillingProfileBundle): FillingContext {
  const { machine, product, packaging, controlPlan, instrument, calibration } = bundle.profiles;
  return {
    machineId: machine.id,
    productId: product.id,
    packagingId: packaging.id,
    controlPlanId: controlPlan.id,
    instrumentId: instrument.id,
    calibrationId: calibration?.id,
  };
}

export function profileReadinessIssues(bundle: FillingProfileBundle): string[] {
  const issues: string[] = [];
  const { machine, product, packaging, controlPlan, instrument } = bundle.profiles;
  if (bundle.status !== 'verified_by_me') issues.push("Le profil n'est pas vérifié par toi.");
  if (!bundle.label || !machine.name || !product.designation || !packaging.name) {
    issues.push('Le contexte machine–produit–tube est incomplet.');
  }
  if (
    !machine.source.label ||
    !product.source.label ||
    !packaging.source.label ||
    !controlPlan.source.label ||
    !instrument.source.label
  ) {
    issues.push('Chaque bloc doit indiquer sa source.');
  }
  if (instrument.verificationStatus !== 'valid') {
    issues.push("L'instrument n'a pas un statut de vérification valide.");
  }
  if (
    instrument.verificationValidUntil &&
    new Date(instrument.verificationValidUntil).getTime() < Date.now()
  ) {
    issues.push("La vérification de l'instrument est expirée.");
  }
  if (machine.setpointType === 'gross_mass' && packaging.tareMode !== 'fixed') {
    issues.push('Une consigne BRUT exige une tare fixe ou moyenne.');
  }
  if (controlPlan.startCriterion.basis === 'gross_mass_g' && packaging.tareMode !== 'fixed') {
    issues.push('Un critère BRUT exige une tare fixe ou moyenne.');
  }
  return issues;
}
