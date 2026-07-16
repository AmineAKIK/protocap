import { z } from 'zod'

import { decimal } from './decimal'

const requiredString = z.string().trim().min(1)
export const isoDateTimeSchema = z.string().datetime({ offset: true })

function isDecimal(value: string): boolean {
  try {
    decimal(value)
    return true
  } catch {
    return false
  }
}

export const decimalStringSchema = z
  .string()
  .regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/, 'Nombre décimal sérialisé attendu.')
  .refine(isDecimal, 'Nombre décimal fini attendu.')

export const positiveDecimalStringSchema = decimalStringSchema.refine(
  (value) => decimal(value).gt(0),
  'La valeur doit être strictement positive.',
)

export const nonNegativeDecimalStringSchema = decimalStringSchema.refine(
  (value) => decimal(value).gte(0),
  'La valeur doit être positive ou nulle.',
)

export const sourceMetadataSchema = z.object({
  label: requiredString,
  documentReference: requiredString.optional(),
  version: requiredString.optional(),
  effectiveDate: isoDateTimeSchema.optional(),
  notes: z.string().optional(),
})

const profileBaseShape = {
  id: requiredString,
  name: requiredString,
  version: requiredString,
  status: z.enum(['draft', 'verified_by_me', 'obsolete']),
  source: sourceMetadataSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  verifiedAt: isoDateTimeSchema.optional(),
  validFrom: isoDateTimeSchema.optional(),
  validUntil: isoDateTimeSchema.optional(),
}

export const machineProfileSchema = z
  .object({
    ...profileBaseShape,
    line: z.string().optional(),
    setpointType: z.enum(['volume', 'net_mass', 'gross_mass', 'mechanical']),
    unit: z.enum(['mL', 'g', 'graduation', 'turn', 'mm', 's']),
    resolution: positiveDecimalStringSchema,
    roundingPolicy: z.enum([
      'nearest_half_up',
      'nearest_half_even',
      'up',
      'down',
      'toward_zero',
      'away_from_zero',
    ]),
    minimum: decimalStringSchema,
    maximum: decimalStringSchema,
    increaseDirection: z.enum([
      'higher_value',
      'lower_value',
      'clockwise',
      'counterclockwise',
    ]),
    headIds: z.array(requiredString),
    calibrationId: requiredString.optional(),
  })
  .superRefine((profile, context) => {
    if (decimal(profile.minimum).gte(decimal(profile.maximum))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximum'],
        message: 'Le maximum doit être supérieur au minimum.',
      })
    }
    const expectedUnit =
      profile.setpointType === 'volume'
        ? 'mL'
        : profile.setpointType === 'net_mass' || profile.setpointType === 'gross_mass'
          ? 'g'
          : undefined
    if (expectedUnit !== undefined && profile.unit !== expectedUnit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unit'],
        message: `L'unité attendue est ${expectedUnit}.`,
      })
    }
    if (profile.setpointType === 'mechanical' && (profile.unit === 'mL' || profile.unit === 'g')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['unit'],
        message: 'Une machine mécanique doit utiliser une unité mécanique.',
      })
    }
  })

export const densityReferenceSchema = z.object({
  valueGPerMl: positiveDecimalStringSchema,
  referenceTemperatureC: decimalStringSchema,
  measurementType: z.literal('mass_density_g_per_ml'),
  source: sourceMetadataSchema,
  validFrom: isoDateTimeSchema.optional(),
  validUntil: isoDateTimeSchema.optional(),
})

export const productProfileSchema = z
  .object({
    ...profileBaseShape,
    sku: requiredString,
    designation: requiredString,
    approvedTargetVolumeMl: positiveDecimalStringSchema,
    nominalQuantityMl: positiveDecimalStringSchema.optional(),
    density: densityReferenceSchema,
    plausibleDensityRangeGPerMl: z
      .object({
        minimum: positiveDecimalStringSchema,
        maximum: positiveDecimalStringSchema,
      })
      .optional(),
    approvedTemperatureRule: z
      .object({ description: requiredString, formulaReference: requiredString })
      .optional(),
  })
  .superRefine((profile, context) => {
    const range = profile.plausibleDensityRangeGPerMl
    if (range && decimal(range.minimum).gte(decimal(range.maximum))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['plausibleDensityRangeGPerMl', 'maximum'],
        message: 'La borne plausible maximale doit dépasser la borne minimale.',
      })
    }
    if (
      range &&
      (decimal(profile.density.valueGPerMl).lt(range.minimum) ||
        decimal(profile.density.valueGPerMl).gt(range.maximum))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['density', 'valueGPerMl'],
        message: 'La masse volumique est hors de la plage plausible configurée.',
      })
    }
  })

export const fixedTareReferenceSchema = z.object({
  meanG: nonNegativeDecimalStringSchema,
  sampleSize: z.number().int().positive(),
  standardDeviationG: nonNegativeDecimalStringSchema.optional(),
  componentLot: z.string().optional(),
  measuredAt: isoDateTimeSchema,
  source: sourceMetadataSchema,
})

export const packagingProfileSchema = z
  .object({
    ...profileBaseShape,
    formatCode: requiredString,
    description: requiredString,
    includedComponents: z.array(requiredString).min(1),
    weighingState: requiredString,
    tareMode: z.enum(['fixed', 'paired', 'destructive']),
    fixedTare: fixedTareReferenceSchema.optional(),
  })
  .superRefine((profile, context) => {
    if (profile.tareMode === 'fixed' && profile.fixedTare === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fixedTare'],
        message: 'Une référence de tare est obligatoire en mode fixe.',
      })
    }
  })

export const startCriterionSchema = z
  .object({
    basis: z.enum(['net_mass_g', 'gross_mass_g', 'volume_ml']),
    meanLowerDeviation: nonNegativeDecimalStringSchema,
    meanUpperDeviation: nonNegativeDecimalStringSchema,
    correctionDeadband: nonNegativeDecimalStringSchema,
    maxStandardDeviation: nonNegativeDecimalStringSchema.optional(),
    maxRange: nonNegativeDecimalStringSchema.optional(),
    individualLowerDeviation: nonNegativeDecimalStringSchema.optional(),
    individualUpperDeviation: nonNegativeDecimalStringSchema.optional(),
    maxUnitsOutsideIndividualLimits: z.number().int().nonnegative().optional(),
  })
  .superRefine((criterion, context) => {
    const hasIndividualLimits =
      criterion.individualLowerDeviation !== undefined ||
      criterion.individualUpperDeviation !== undefined
    if (criterion.maxUnitsOutsideIndividualLimits !== undefined && !hasIndividualLimits) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxUnitsOutsideIndividualLimits'],
        message: 'Définir au moins une limite individuelle avant le nombre maximal hors limites.',
      })
    }
  })

export const controlPlanProfileSchema = z.object({
  ...profileBaseShape,
  sampleSize: z.number().int().positive(),
  startCriterion: startCriterionSchema,
  maxCorrectionG: positiveDecimalStringSchema,
  maxIterations: z.number().int().positive().optional(),
  exclusionReasons: z.array(requiredString),
  stopRules: z.array(requiredString),
})

export const instrumentProfileSchema = z
  .object({
    ...profileBaseShape,
    serialNumber: requiredString,
    unit: z.literal('g'),
    resolutionG: positiveDecimalStringSchema,
    minimumG: nonNegativeDecimalStringSchema,
    maximumG: positiveDecimalStringSchema,
    verificationStatus: z.enum(['valid', 'expired', 'unknown', 'failed']),
    lastVerifiedAt: isoDateTimeSchema.optional(),
    verificationValidUntil: isoDateTimeSchema.optional(),
  })
  .superRefine((instrument, context) => {
    if (decimal(instrument.minimumG).gte(decimal(instrument.maximumG))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maximumG'],
        message: 'La capacité maximale doit dépasser la capacité minimale.',
      })
    }
  })

export const calibrationPointSchema = z.object({
  setting: decimalStringSchema,
  netMassG: nonNegativeDecimalStringSchema,
})

export const calibrationProfileSchema = z
  .object({
    ...profileBaseShape,
    machineId: requiredString,
    headId: requiredString.optional(),
    productId: requiredString.optional(),
    productFamily: requiredString.optional(),
    packagingId: requiredString.optional(),
    model: z.literal('linear_local'),
    slopeGPerSettingUnit: decimalStringSchema,
    interceptG: decimalStringSchema.optional(),
    validSettingMinimum: decimalStringSchema,
    validSettingMaximum: decimalStringSchema,
    approachDirection: z.enum(['increasing', 'decreasing', 'either']),
    backlashSettingUnits: nonNegativeDecimalStringSchema.optional(),
    uncertaintyG: nonNegativeDecimalStringSchema.optional(),
    points: z.array(calibrationPointSchema).min(2),
    applicableConditions: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((calibration, context) => {
    if (decimal(calibration.slopeGPerSettingUnit).isZero()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['slopeGPerSettingUnit'],
        message: 'La pente ne peut pas être nulle.',
      })
    }
    if (decimal(calibration.validSettingMinimum).gte(decimal(calibration.validSettingMaximum))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['validSettingMaximum'],
        message: 'Le domaine de calibration est invalide.',
      })
    }
  })

export const fillingContextSchema = z.object({
  machineId: requiredString,
  productId: requiredString,
  packagingId: requiredString,
  controlPlanId: requiredString,
  instrumentId: requiredString,
  headId: requiredString.optional(),
  calibrationId: requiredString.optional(),
  workOrder: z.string().optional(),
  batch: z.string().optional(),
  productTemperatureC: decimalStringSchema.optional(),
  conditions: z.record(z.string(), z.string()).optional(),
})

export const profileSnapshotsSchema = z.object({
  machine: machineProfileSchema,
  product: productProfileSchema,
  packaging: packagingProfileSchema,
  controlPlan: controlPlanProfileSchema,
  instrument: instrumentProfileSchema,
  calibration: calibrationProfileSchema.optional(),
})

export const targetValuesSchema = z.object({
  volumeMl: positiveDecimalStringSchema,
  densityGPerMl: positiveDecimalStringSchema,
  netMassG: positiveDecimalStringSchema,
  tareG: nonNegativeDecimalStringSchema.optional(),
  grossMassG: positiveDecimalStringSchema.optional(),
})

export const quantizedValueSchema = z.object({
  exact: decimalStringSchema,
  quantized: decimalStringSchema,
  resolution: positiveDecimalStringSchema,
  policy: z.enum([
    'nearest_half_up',
    'nearest_half_even',
    'up',
    'down',
    'toward_zero',
    'away_from_zero',
  ]),
})

export const machineSetpointSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('direct'),
    basis: z.enum(['volume_ml', 'net_mass_g', 'gross_mass_g']),
    unit: z.enum(['mL', 'g']),
    label: z.enum(['VOLUME', 'NET', 'BRUT']),
    value: quantizedValueSchema,
  }),
  z.object({
    kind: z.literal('mechanical_without_calibration'),
    physicalTargets: targetValuesSchema,
  }),
  z.object({
    kind: z.literal('mechanical_estimate'),
    unit: z.enum(['graduation', 'turn', 'mm', 's']),
    value: quantizedValueSchema,
    calibrationId: requiredString,
    uncertaintyG: nonNegativeDecimalStringSchema.optional(),
  }),
])

const measurementCommonShape = {
  id: requiredString,
  excluded: z.boolean().optional(),
  exclusionReason: z.string().optional(),
  capturedAt: isoDateTimeSchema.optional(),
  headId: requiredString.optional(),
}

export const fixedTareMeasurementInputSchema = z.object({
  ...measurementCommonShape,
  mode: z.literal('fixed'),
  grossMassG: positiveDecimalStringSchema,
})

export const pairedTareMeasurementInputSchema = z.object({
  ...measurementCommonShape,
  mode: z.literal('paired'),
  grossMassG: positiveDecimalStringSchema,
  tareMassG: nonNegativeDecimalStringSchema,
})

export const destructiveTareMeasurementInputSchema = z.object({
  ...measurementCommonShape,
  mode: z.literal('destructive'),
  grossBeforeEmptyingG: positiveDecimalStringSchema,
  cleanedPackagingMassG: nonNegativeDecimalStringSchema,
})

export const measurementInputSchema = z
  .discriminatedUnion('mode', [
    fixedTareMeasurementInputSchema,
    pairedTareMeasurementInputSchema,
    destructiveTareMeasurementInputSchema,
  ])
  .superRefine((measurement, context) => {
    if (measurement.excluded && !measurement.exclusionReason?.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['exclusionReason'],
        message: "Le motif d'exclusion est obligatoire.",
      })
    }
  })

export const normalizedMeasurementSchema = z.object({
  id: requiredString,
  mode: z.enum(['fixed', 'paired', 'destructive']),
  grossMassG: positiveDecimalStringSchema,
  tareMassG: nonNegativeDecimalStringSchema,
  netMassG: nonNegativeDecimalStringSchema,
  excluded: z.boolean(),
  exclusionReason: z.string().optional(),
  capturedAt: isoDateTimeSchema.optional(),
  headId: requiredString.optional(),
})

export const sampleStatisticsSchema = z.object({
  basis: z.enum(['net_mass_g', 'gross_mass_g', 'volume_ml']),
  count: z.number().int().positive(),
  excludedCount: z.number().int().nonnegative(),
  mean: decimalStringSchema,
  minimum: decimalStringSchema,
  maximum: decimalStringSchema,
  range: nonNegativeDecimalStringSchema,
  standardDeviation: nonNegativeDecimalStringSchema,
  standardDeviationMethod: z.enum(['sample', 'population']),
})

export const decisionReasonCodeSchema = z.enum([
  'sample_incomplete',
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
  'maximum_iterations_reached',
  'explicit_stop_rule',
  'dispersion_too_high',
  'range_too_high',
  'too_many_individual_values_outside_limits',
  'oscillation_detected',
  'atypical_measurement_requires_review',
  'outside_criterion_within_deadband',
  'mean_below_target_interval',
  'mean_above_target_interval',
  'start_criterion_achieved',
])

export const decisionReasonSchema = z.object({
  code: decisionReasonCodeSchema,
  message: requiredString,
  actual: z.union([z.string(), z.number().finite()]).optional(),
  limit: z.union([z.string(), z.number().finite()]).optional(),
})

export const setupDecisionSchema = z.object({
  status: z.enum(['collect_more', 'stop', 'investigate', 'correct', 'achieved']),
  reasons: z.array(decisionReasonSchema).min(1),
  evaluatedCount: z.number().int().nonnegative(),
  requiredCount: z.number().int().positive(),
  target: decimalStringSchema,
  lowerLimit: decimalStringSchema,
  upperLimit: decimalStringSchema,
  meanError: decimalStringSchema,
  unitsOutsideIndividualLimits: z.number().int().nonnegative(),
})

export const mechanicalSettingEstimateSchema = z.object({
  calibrationId: requiredString,
  currentSetting: decimalStringSchema,
  deltaSetting: decimalStringSchema,
  proposedSetting: decimalStringSchema,
  quantizedSetting: decimalStringSchema,
  withinCalibrationDomain: z.literal(true),
  requiredApproachDirection: z.enum(['increasing', 'decreasing', 'either']),
  backlashSettingUnits: nonNegativeDecimalStringSchema.optional(),
  uncertaintyG: nonNegativeDecimalStringSchema.optional(),
})

export const correctionRecommendationSchema = z.object({
  direction: z.enum(['increase_fill', 'decrease_fill']),
  fullErrorG: decimalStringSchema,
  fullErrorMl: decimalStringSchema,
  recommendedChangeG: decimalStringSchema,
  recommendedChangeMl: decimalStringSchema,
  capped: z.boolean(),
  mechanicalEstimate: mechanicalSettingEstimateSchema.optional(),
  explanation: requiredString,
})

export const setupIterationSchema = z.object({
  id: requiredString,
  index: z.number().int().nonnegative(),
  startedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.optional(),
  appliedSetting: decimalStringSchema.optional(),
  appliedSettingUnit: z.enum(['mL', 'g', 'graduation', 'turn', 'mm', 's']).optional(),
  measurements: z.array(normalizedMeasurementSchema),
  statistics: sampleStatisticsSchema.optional(),
  decision: setupDecisionSchema.optional(),
  recommendation: correctionRecommendationSchema.optional(),
  operatorNote: z.string().optional(),
})

export const setupSessionSchema = z.object({
  id: requiredString,
  mode: z.enum(['real', 'simulation', 'shadow']),
  status: z.enum(['draft', 'active', 'criterion_achieved', 'stopped', 'abandoned']),
  context: fillingContextSchema,
  profiles: profileSnapshotsSchema,
  targets: targetValuesSchema,
  engineVersion: requiredString,
  iterations: z.array(setupIterationSchema),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
  completedAt: isoDateTimeSchema.optional(),
})

export const fillingEventTypeSchema = z.enum([
  'session_created',
  'session_resumed',
  'context_confirmed',
  'setting_applied',
  'measurement_added',
  'measurement_removed',
  'measurement_excluded',
  'decision_computed',
  'correction_confirmed',
  'session_completed',
  'session_stopped',
  'session_abandoned',
  'operator_note_recorded',
  'profile_created',
  'profile_updated',
  'profile_verified',
  'profile_obsoleted',
  'profile_deleted',
  'backup_exported',
  'backup_imported',
])

export const eventLogSchema = z.object({
  id: requiredString,
  sequence: z.number().int().nonnegative(),
  type: fillingEventTypeSchema,
  occurredAt: isoDateTimeSchema,
  sessionId: requiredString.optional(),
  entityId: requiredString.optional(),
  engineVersion: requiredString,
  payload: z.record(z.string(), z.unknown()).optional(),
})

export const appSettingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  deviceId: requiredString,
  locale: z.enum(['fr-FR', 'en-US']),
  autoLockMinutes: z.number().int().positive(),
  offlineEnrollmentCompleted: z.boolean(),
  lastBackupAt: isoDateTimeSchema.optional(),
  lastSuccessfulMigration: z.number().int().nonnegative().optional(),
})

export const historyCompatibilityKeySchema = z.object({
  machineId: requiredString,
  productId: requiredString,
  packagingId: requiredString,
  headId: requiredString.optional(),
  calibrationId: requiredString.optional(),
  productProfileVersion: requiredString.optional(),
  machineProfileVersion: requiredString.optional(),
  packagingProfileVersion: requiredString.optional(),
  conditions: z.record(z.string(), z.string()).optional(),
})

export const historyRecordSchema = z.object({
  id: requiredString,
  sessionId: requiredString,
  achievedAt: isoDateTimeSchema,
  key: historyCompatibilityKeySchema,
  successfulSetting: decimalStringSchema,
  successfulSettingUnit: z.enum(['mL', 'g', 'graduation', 'turn', 'mm', 's']),
  finalMeanNetMassG: nonNegativeDecimalStringSchema,
  finalMeanVolumeMl: nonNegativeDecimalStringSchema,
  engineVersion: requiredString,
})

export const domainIssueSchema = z.object({
  code: requiredString,
  severity: z.enum(['error', 'warning']),
  path: requiredString,
  message: requiredString,
})

export const anyProfileSchema = z.union([
  machineProfileSchema,
  productProfileSchema,
  packagingProfileSchema,
  controlPlanProfileSchema,
  instrumentProfileSchema,
  calibrationProfileSchema,
])
