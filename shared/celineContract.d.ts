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

export function parseCelineAssistantContent(
  rawContent: unknown,
  allowedActionIds: ReadonlySet<string>
): SharedCelineResponse | null;

export function collectShiftGuideActionIds(
  modules: Array<{
    type: 'standard' | 'choice';
    actions?: Array<{ id: string }>;
    subModules?: Array<{ actions: Array<{ id: string }> }>;
  }>
): Set<string>;

export function isCelineResponse(value: unknown): value is SharedCelineResponse;
