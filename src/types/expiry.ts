export type ContactElementType = 'fillingBlock';
export type ElementStatus = 'ok' | 'warning' | 'expired' | 'unknown';
export type LineStatus = 'conform' | 'watch' | 'nonConform' | 'unknown';

export interface ContactElement {
  type: ContactElementType;
  label: string;
  lastChangedAt: string;
  expiresAt: string;
  validityDays: number;
  operator: string;
  comment?: string;
  /** Absent for legacy records; never backfilled by guessing the writer's zone. */
  timeZone?: string;
  validityRule?: string;
}

export interface ConditioningLine {
  id: string;
  name: string;
  vat: string;
  product: string;
  conditioningStartedAt: string;
  elements: ContactElement[];
}

export interface ChangeHistoryEntry {
  id: string;
  lineId: string;
  lineName: string;
  elementLabel: string;
  changedAt: string;
  operator: string;
  comment?: string;
  previousExpiresAt?: string;
  newExpiresAt: string;
  /** Zone of the declared intervention, not necessarily the active block's zone. */
  timeZone?: string;
  validityRule?: string;
}
