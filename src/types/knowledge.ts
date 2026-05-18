export type StandardStatus = 'active' | 'review' | 'draft';
export type StandardType = 'SOP' | 'OPL' | 'CHECK' | 'REACT';

export interface StandardStep {
  action: string;
  expected: string;
}

export interface ProcedureDoc {
  id: string;
  code: string;
  title: string;
  category: string;
  type: StandardType;
  status: StandardStatus;
  version: string;
  lineArea: string;
  summary: string;
  steps: StandardStep[];
  keyChecks: string[];
  watchPoints: string[];
  author: string;
  validator: string;
  updatedAt: string;
  nextReviewAt: string;
  relatedDocs: string[];
}
