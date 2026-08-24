export interface SharedCelineChecklistItem {
  actionId: string;
  text: string;
  note: string | null;
  module: string | null;
}

export type SharedCelinePresentation = 'focus' | 'all' | 'answer' | 'question' | 'completion';

export interface SharedCelineWorkflow {
  runId: string;
  routeId: string;
  label: string;
  currentIndex: number;
  totalActions: number;
}

export interface SharedCompletedCelineWorkflow {
  routeId: string;
  label: string;
}

export interface SharedCelineResponse {
  message: string;
  checklist: SharedCelineChecklistItem[];
  followUp: string | null;
  presentation?: SharedCelinePresentation;
  workflow?: SharedCelineWorkflow;
  completedWorkflow?: SharedCompletedCelineWorkflow;
}

export type SharedCelineDecision =
  | { kind: 'route'; id: string }
  | { kind: 'clarify'; id: string }
  | { kind: 'lexicon'; id: string }
  | { kind: 'emergency'; id: string }
  | { kind: 'unknown' };

export function parseCelineDecision(rawContent: unknown): SharedCelineDecision | null;
export function isCelineResponse(value: unknown): value is SharedCelineResponse;
