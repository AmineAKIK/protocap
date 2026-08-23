export interface SharedCelineChecklistItem {
  actionId: string;
  text: string;
  note: string | null;
  module: string | null;
}

export interface SharedCelineResponse {
  message: string;
  checklist: SharedCelineChecklistItem[];
  followUp: string | null;
}

export type SharedCelineDecision =
  | { kind: 'route'; id: string }
  | { kind: 'clarify'; id: string }
  | { kind: 'lexicon'; id: string }
  | { kind: 'emergency'; id: string }
  | { kind: 'unknown' };

export function parseCelineDecision(rawContent: unknown): SharedCelineDecision | null;
export function isCelineResponse(value: unknown): value is SharedCelineResponse;
