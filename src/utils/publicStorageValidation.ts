import type { ChangeHistoryEntry, ConditioningLine, ContactElement } from '../types/expiry';
import type { LogisticsRequest, LogisticsStatus, Priority } from '../types/logistics';

export interface PersistedPackingFormState {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
  productionStartTime?: string;
  referenceCadence?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || isString(value);
}

function isDateString(value: unknown): value is string {
  return isString(value) && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isLogisticsStatus(value: unknown): value is LogisticsStatus {
  return value === 'waiting' || value === 'seen' || value === 'inProgress' || value === 'pickedUp' || value === 'cancelled';
}

function isPriority(value: unknown): value is Priority {
  return value === 'normal' || value === 'high';
}

function isLogisticsRequest(value: unknown): value is LogisticsRequest {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.line) &&
    isString(value.zone) &&
    isPositiveSafeInteger(value.palletCount) &&
    isPriority(value.priority) &&
    isString(value.nature) &&
    isOptionalString(value.comment) &&
    isDateString(value.createdAt) &&
    (value.completedAt === undefined || isDateString(value.completedAt)) &&
    isLogisticsStatus(value.status)
  );
}

function isLogisticsRequestList(value: unknown): value is LogisticsRequest[] {
  return Array.isArray(value) && value.every(isLogisticsRequest);
}

// Expiry parsing preserves structurally readable evidence. Semantic validity belongs to
// getLineStatus / prepareDeclaration; rejecting a timestamp here would replace it with demo data.
function isContactElement(value: unknown): value is ContactElement {
  if (!isRecord(value)) return false;
  return value.type === 'fillingBlock' && isString(value.label)
    && isString(value.lastChangedAt) && isString(value.expiresAt)
    && typeof value.validityDays === 'number' && Number.isFinite(value.validityDays)
    && isString(value.operator) && isOptionalString(value.comment)
    && isOptionalString(value.timeZone) && isOptionalString(value.validityRule);
}
function isConditioningLine(value: unknown): value is ConditioningLine {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.name) && isString(value.vat) && isString(value.product)
    && isString(value.conditioningStartedAt) && Array.isArray(value.elements) && value.elements.every(isContactElement);
}
function isConditioningLineList(value: unknown): value is ConditioningLine[] {
  return Array.isArray(value) && value.every(isConditioningLine);
}
function isChangeHistoryEntry(value: unknown): value is ChangeHistoryEntry {
  if (!isRecord(value)) return false;
  return isString(value.id) && isString(value.lineId) && isString(value.lineName) && isString(value.elementLabel)
    && isString(value.changedAt) && isString(value.operator) && isOptionalString(value.comment)
    && isOptionalString(value.previousExpiresAt) && isString(value.newExpiresAt)
    && isOptionalString(value.timeZone) && isOptionalString(value.validityRule);
}
function isChangeHistoryList(value: unknown): value is ChangeHistoryEntry[] {
  return Array.isArray(value) && value.every(isChangeHistoryEntry);
}

function isPackingFormState(value: unknown): value is PersistedPackingFormState {
  if (!isRecord(value)) return false;
  return (
    isString(value.quantity) &&
    isString(value.unitsPerCarton) &&
    isString(value.cartonsPerPalette) &&
    isOptionalString(value.productionStartTime) &&
    isOptionalString(value.referenceCadence)
  );
}

type Validator = (value: unknown) => boolean;

const validators: Readonly<Record<string, Validator>> = {
  'lineops.expiry.lines': isConditioningLineList,
  'lineops.expiry.history': isChangeHistoryList,
  'lineops.logistics.requests': isLogisticsRequestList,
  'lineops.packing.form.inputs': isPackingFormState,
};

export function isValidPublicStorageValue(key: string, value: unknown): boolean {
  return validators[key]?.(value) ?? false;
}
