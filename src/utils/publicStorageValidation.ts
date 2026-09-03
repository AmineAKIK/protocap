import type { ChangeHistoryEntry, ConditioningLine, ContactElement } from '../types/expiry';
import type { LogisticsRequest, LogisticsStatus, Priority } from '../types/logistics';
import type { PackingPolicy } from './packing';

export interface PersistedPackingFormState {
  quantity: string;
  unitsPerCarton: string;
  cartonsPerPalette: string;
  policy: PackingPolicy;
}

export interface PersistedPackingTrackingState {
  progressByCalculation: Record<string, number>;
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

function isIsoDateString(value: unknown): value is string {
  return isString(value) && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
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
    isIsoDateString(value.createdAt) &&
    (value.completedAt === undefined || isIsoDateString(value.completedAt)) &&
    isLogisticsStatus(value.status)
  );
}

export function isLogisticsRequestList(value: unknown): value is LogisticsRequest[] {
  return Array.isArray(value) && value.every(isLogisticsRequest);
}

function isContactElement(value: unknown): value is ContactElement {
  if (!isRecord(value)) return false;
  return (
    value.type === 'fillingBlock' &&
    isString(value.label) &&
    isIsoDateString(value.lastChangedAt) &&
    isIsoDateString(value.expiresAt) &&
    isPositiveSafeInteger(value.validityDays) &&
    isString(value.operator) &&
    isOptionalString(value.comment)
  );
}

function isConditioningLine(value: unknown): value is ConditioningLine {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.name) &&
    isString(value.vat) &&
    isString(value.product) &&
    isIsoDateString(value.conditioningStartedAt) &&
    Array.isArray(value.elements) &&
    value.elements.length > 0 &&
    value.elements.every(isContactElement)
  );
}

export function isConditioningLineList(value: unknown): value is ConditioningLine[] {
  return Array.isArray(value) && value.length > 0 && value.every(isConditioningLine);
}

function isChangeHistoryEntry(value: unknown): value is ChangeHistoryEntry {
  if (!isRecord(value)) return false;
  return (
    isString(value.id) &&
    isString(value.lineId) &&
    isString(value.lineName) &&
    isString(value.elementLabel) &&
    isIsoDateString(value.changedAt) &&
    isString(value.operator) &&
    isOptionalString(value.comment) &&
    (value.previousExpiresAt === undefined || isIsoDateString(value.previousExpiresAt)) &&
    isIsoDateString(value.newExpiresAt)
  );
}

export function isChangeHistoryList(value: unknown): value is ChangeHistoryEntry[] {
  return Array.isArray(value) && value.every(isChangeHistoryEntry);
}

function isPackingPolicy(value: unknown): value is PackingPolicy {
  return value === 'no-overrun' || value === 'round-carton' || value === 'round-pallet';
}

export function isPackingFormState(value: unknown): value is PersistedPackingFormState {
  if (!isRecord(value)) return false;
  return (
    isString(value.quantity) &&
    isString(value.unitsPerCarton) &&
    isString(value.cartonsPerPalette) &&
    isPackingPolicy(value.policy)
  );
}

export function isPackingTrackingState(value: unknown): value is PersistedPackingTrackingState {
  if (!isRecord(value) || !isRecord(value.progressByCalculation)) return false;
  return Object.values(value.progressByCalculation).every(isNonNegativeSafeInteger);
}
