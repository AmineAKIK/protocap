/**
 * Domain contracts for the filling setup assistant.
 *
 * Decimal values deliberately cross every persistence/UI boundary as strings.
 * Arithmetic must only happen through the helpers in `decimal.ts`.
 */

export type DecimalString = string
export type IsoDateTimeString = string
export type EntityId = string

export type ProfileStatus = 'draft' | 'verified_by_me' | 'obsolete'
export type SessionMode = 'real' | 'simulation' | 'shadow'
export type MachineSetpointType = 'volume' | 'net_mass' | 'gross_mass' | 'mechanical'
export type MachineUnit = 'mL' | 'g' | 'graduation' | 'turn' | 'mm' | 's'
export type TareMode = 'fixed' | 'paired' | 'destructive'
export type RoundingPolicy =
  | 'nearest_half_up'
  | 'nearest_half_even'
  | 'up'
  | 'down'
  | 'toward_zero'
  | 'away_from_zero'

export interface SourceMetadata {
  label: string
  documentReference?: string
  version?: string
  effectiveDate?: IsoDateTimeString
  notes?: string
}

export interface VersionedProfileBase {
  id: EntityId
  name: string
  version: string
  status: ProfileStatus
  source: SourceMetadata
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
  verifiedAt?: IsoDateTimeString
  validFrom?: IsoDateTimeString
  validUntil?: IsoDateTimeString
}

export interface MachineProfile extends VersionedProfileBase {
  line?: string
  setpointType: MachineSetpointType
  unit: MachineUnit
  resolution: DecimalString
  roundingPolicy: RoundingPolicy
  minimum: DecimalString
  maximum: DecimalString
  /** Human-verifiable statement of how the mechanism increases filling. */
  increaseDirection: 'higher_value' | 'lower_value' | 'clockwise' | 'counterclockwise'
  headIds: EntityId[]
  calibrationId?: EntityId
}

export interface DensityReference {
  valueGPerMl: DecimalString
  referenceTemperatureC: DecimalString
  measurementType: 'mass_density_g_per_ml'
  source: SourceMetadata
  validFrom?: IsoDateTimeString
  validUntil?: IsoDateTimeString
}

export interface ProductProfile extends VersionedProfileBase {
  sku: string
  designation: string
  approvedTargetVolumeMl: DecimalString
  nominalQuantityMl?: DecimalString
  density: DensityReference
  /** Operator-configured plausibility barrier used to catch unit/factor mistakes. */
  plausibleDensityRangeGPerMl?: {
    minimum: DecimalString
    maximum: DecimalString
  }
  /** No correction is inferred when this is absent. */
  approvedTemperatureRule?: {
    description: string
    formulaReference: string
  }
}

export interface FixedTareReference {
  meanG: DecimalString
  sampleSize: number
  standardDeviationG?: DecimalString
  componentLot?: string
  measuredAt: IsoDateTimeString
  source: SourceMetadata
}

export interface PackagingProfile extends VersionedProfileBase {
  formatCode: string
  description: string
  includedComponents: string[]
  weighingState: string
  tareMode: TareMode
  /** Required for fixed tare, forbidden from being silently used for other modes. */
  fixedTare?: FixedTareReference
}

export type CriterionBasis = 'net_mass_g' | 'gross_mass_g' | 'volume_ml'

export interface StartCriterion {
  basis: CriterionBasis
  /** Accepted interval is target - lowerDeviation through target + upperDeviation. */
  meanLowerDeviation: DecimalString
  meanUpperDeviation: DecimalString
  /** Below this absolute error, a correction is deliberately not proposed. */
  correctionDeadband: DecimalString
  maxStandardDeviation?: DecimalString
  maxRange?: DecimalString
  individualLowerDeviation?: DecimalString
  individualUpperDeviation?: DecimalString
  maxUnitsOutsideIndividualLimits?: number
}

export interface ControlPlanProfile extends VersionedProfileBase {
  sampleSize: number
  startCriterion: StartCriterion
  /** Hard cap for one recommendation, expressed as net product mass. */
  maxCorrectionG: DecimalString
  maxIterations?: number
  exclusionReasons: string[]
  stopRules: string[]
}

export type InstrumentVerificationStatus = 'valid' | 'expired' | 'unknown' | 'failed'

export interface InstrumentProfile extends VersionedProfileBase {
  serialNumber: string
  unit: 'g'
  resolutionG: DecimalString
  minimumG: DecimalString
  maximumG: DecimalString
  verificationStatus: InstrumentVerificationStatus
  lastVerifiedAt?: IsoDateTimeString
  verificationValidUntil?: IsoDateTimeString
}

export interface CalibrationPoint {
  setting: DecimalString
  netMassG: DecimalString
}

export interface CalibrationProfile extends VersionedProfileBase {
  machineId: EntityId
  headId?: EntityId
  productId?: EntityId
  productFamily?: string
  packagingId?: EntityId
  model: 'linear_local'
  /** Signed g of net product per one machine-setting unit. Never zero. */
  slopeGPerSettingUnit: DecimalString
  interceptG?: DecimalString
  validSettingMinimum: DecimalString
  validSettingMaximum: DecimalString
  approachDirection: 'increasing' | 'decreasing' | 'either'
  backlashSettingUnits?: DecimalString
  uncertaintyG?: DecimalString
  points: CalibrationPoint[]
  applicableConditions?: Record<string, string>
}

export interface FillingContext {
  machineId: EntityId
  productId: EntityId
  packagingId: EntityId
  controlPlanId: EntityId
  instrumentId: EntityId
  headId?: EntityId
  calibrationId?: EntityId
  workOrder?: string
  batch?: string
  productTemperatureC?: DecimalString
  conditions?: Record<string, string>
}

export interface ProfileSnapshots {
  machine: MachineProfile
  product: ProductProfile
  packaging: PackagingProfile
  controlPlan: ControlPlanProfile
  instrument: InstrumentProfile
  calibration?: CalibrationProfile
}

export interface TargetValues {
  volumeMl: DecimalString
  densityGPerMl: DecimalString
  netMassG: DecimalString
  tareG?: DecimalString
  grossMassG?: DecimalString
}

export interface QuantizedValue {
  exact: DecimalString
  quantized: DecimalString
  resolution: DecimalString
  policy: RoundingPolicy
}

export type MachineSetpoint =
  | {
      kind: 'direct'
      basis: 'volume_ml' | 'net_mass_g' | 'gross_mass_g'
      unit: 'mL' | 'g'
      label: 'VOLUME' | 'NET' | 'BRUT'
      value: QuantizedValue
    }
  | {
      kind: 'mechanical_without_calibration'
      physicalTargets: TargetValues
    }
  | {
      kind: 'mechanical_estimate'
      unit: Exclude<MachineUnit, 'mL' | 'g'>
      value: QuantizedValue
      calibrationId: EntityId
      uncertaintyG?: DecimalString
    }

export interface FixedTareMeasurementInput {
  id: EntityId
  mode: 'fixed'
  grossMassG: DecimalString
  excluded?: boolean
  exclusionReason?: string
  capturedAt?: IsoDateTimeString
  headId?: EntityId
}

export interface PairedTareMeasurementInput {
  id: EntityId
  mode: 'paired'
  grossMassG: DecimalString
  tareMassG: DecimalString
  excluded?: boolean
  exclusionReason?: string
  capturedAt?: IsoDateTimeString
  headId?: EntityId
}

export interface DestructiveTareMeasurementInput {
  id: EntityId
  mode: 'destructive'
  grossBeforeEmptyingG: DecimalString
  cleanedPackagingMassG: DecimalString
  excluded?: boolean
  exclusionReason?: string
  capturedAt?: IsoDateTimeString
  headId?: EntityId
}

export type MeasurementInput =
  | FixedTareMeasurementInput
  | PairedTareMeasurementInput
  | DestructiveTareMeasurementInput

export interface NormalizedMeasurement {
  id: EntityId
  mode: TareMode
  grossMassG: DecimalString
  tareMassG: DecimalString
  netMassG: DecimalString
  excluded: boolean
  exclusionReason?: string
  capturedAt?: IsoDateTimeString
  headId?: EntityId
}

export interface SampleStatistics {
  basis: CriterionBasis
  count: number
  excludedCount: number
  mean: DecimalString
  minimum: DecimalString
  maximum: DecimalString
  range: DecimalString
  standardDeviation: DecimalString
  standardDeviationMethod: 'sample' | 'population'
}

export type DecisionStatus = 'collect_more' | 'stop' | 'investigate' | 'correct' | 'achieved'

export type DecisionReasonCode =
  | 'sample_incomplete'
  | 'profile_not_verified'
  | 'profile_obsolete'
  | 'instrument_not_valid'
  | 'instrument_capacity_exceeded'
  | 'reference_expired'
  | 'reference_not_yet_valid'
  | 'machine_capacity_exceeded'
  | 'context_incompatible'
  | 'calibration_incompatible'
  | 'density_outside_plausible_range'
  | 'gross_target_requires_fixed_tare'
  | 'fixed_tare_missing'
  | 'maximum_iterations_reached'
  | 'explicit_stop_rule'
  | 'dispersion_too_high'
  | 'range_too_high'
  | 'too_many_individual_values_outside_limits'
  | 'oscillation_detected'
  | 'atypical_measurement_requires_review'
  | 'outside_criterion_within_deadband'
  | 'mean_below_target_interval'
  | 'mean_above_target_interval'
  | 'start_criterion_achieved'

export interface DecisionReason {
  code: DecisionReasonCode
  message: string
  actual?: DecimalString | number | string
  limit?: DecimalString | number | string
}

export interface SetupDecision {
  status: DecisionStatus
  reasons: DecisionReason[]
  evaluatedCount: number
  requiredCount: number
  target: DecimalString
  lowerLimit: DecimalString
  upperLimit: DecimalString
  meanError: DecimalString
  unitsOutsideIndividualLimits: number
}

export interface DecisionSignals {
  stopReasons?: DecisionReason[]
  investigationReasons?: DecisionReason[]
  oscillationDetected?: boolean
  atypicalMeasurementIds?: EntityId[]
  currentIteration?: number
}

export interface MechanicalSettingEstimate {
  calibrationId: EntityId
  currentSetting: DecimalString
  deltaSetting: DecimalString
  proposedSetting: DecimalString
  quantizedSetting: DecimalString
  withinCalibrationDomain: boolean
  requiredApproachDirection: 'increasing' | 'decreasing' | 'either'
  backlashSettingUnits?: DecimalString
  uncertaintyG?: DecimalString
}

export interface CorrectionRecommendation {
  direction: 'increase_fill' | 'decrease_fill'
  fullErrorG: DecimalString
  fullErrorMl: DecimalString
  recommendedChangeG: DecimalString
  recommendedChangeMl: DecimalString
  capped: boolean
  mechanicalEstimate?: MechanicalSettingEstimate
  explanation: string
}

export interface SetupIteration {
  id: EntityId
  index: number
  startedAt: IsoDateTimeString
  completedAt?: IsoDateTimeString
  appliedSetting?: DecimalString
  appliedSettingUnit?: MachineUnit
  measurements: NormalizedMeasurement[]
  statistics?: SampleStatistics
  decision?: SetupDecision
  recommendation?: CorrectionRecommendation
  operatorNote?: string
}

export type SessionStatus = 'draft' | 'active' | 'criterion_achieved' | 'stopped' | 'abandoned'

export interface SetupSession {
  id: EntityId
  mode: SessionMode
  status: SessionStatus
  context: FillingContext
  profiles: ProfileSnapshots
  targets: TargetValues
  engineVersion: string
  iterations: SetupIteration[]
  createdAt: IsoDateTimeString
  updatedAt: IsoDateTimeString
  completedAt?: IsoDateTimeString
}

export type FillingEventType =
  | 'session_created'
  | 'session_resumed'
  | 'context_confirmed'
  | 'setting_applied'
  | 'measurement_added'
  | 'measurement_removed'
  | 'measurement_excluded'
  | 'decision_computed'
  | 'correction_confirmed'
  | 'session_completed'
  | 'session_stopped'
  | 'session_abandoned'
  | 'operator_note_recorded'
  | 'profile_created'
  | 'profile_updated'
  | 'profile_verified'
  | 'profile_obsoleted'
  | 'profile_deleted'
  | 'backup_exported'
  | 'backup_imported'

export interface EventLog {
  id: EntityId
  sequence: number
  type: FillingEventType
  occurredAt: IsoDateTimeString
  sessionId?: EntityId
  entityId?: EntityId
  engineVersion: string
  payload?: Record<string, unknown>
}

export interface AppSettings {
  schemaVersion: number
  deviceId: EntityId
  locale: 'fr-FR' | 'en-US'
  autoLockMinutes: number
  offlineEnrollmentCompleted: boolean
  lastBackupAt?: IsoDateTimeString
  lastSuccessfulMigration?: number
}

export interface HistoryCompatibilityKey {
  machineId: EntityId
  productId: EntityId
  packagingId: EntityId
  headId?: EntityId
  calibrationId?: EntityId
  productProfileVersion?: string
  machineProfileVersion?: string
  packagingProfileVersion?: string
  conditions?: Record<string, string>
}

export interface HistoryRecord {
  id: EntityId
  sessionId: EntityId
  achievedAt: IsoDateTimeString
  key: HistoryCompatibilityKey
  successfulSetting: DecimalString
  successfulSettingUnit: MachineUnit
  finalMeanNetMassG: DecimalString
  finalMeanVolumeMl: DecimalString
  engineVersion: string
}

export interface DomainIssue {
  code: string
  severity: 'error' | 'warning'
  path: string
  message: string
}

export interface DomainValidationResult {
  valid: boolean
  issues: DomainIssue[]
}
