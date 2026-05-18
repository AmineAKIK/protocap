export type ContactElementType = 'hoses' | 'fillingHead';
export type ElementStatus = 'ok' | 'warning' | 'expired';
export type LineStatus = 'conform' | 'watch' | 'nonConform' | 'actionRequired';

export interface ContactElement {
  type: ContactElementType;
  label: string;
  lastChangedAt: string;
  expiresAt: string;
  validityDays: number;
  operator: string;
  comment?: string;
}

export interface ProductionLine {
  id: string;
  name: string;
  vat: string;
  product: string;
  productionStartedAt: string;
  materialChangePending: boolean;
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
}
