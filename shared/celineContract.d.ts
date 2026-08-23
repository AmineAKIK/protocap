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

export interface SharedCelineActionDefinition {
  text: string;
  note: string | null;
  module: string | null;
}

export function parseCelineAssistantContent(
  rawContent: unknown,
  actionCatalog: ReadonlyMap<string, SharedCelineActionDefinition>
): SharedCelineResponse | null;

export function collectShiftGuideActions(
  modules: Array<{
    title: string;
    type: 'standard' | 'choice';
    actions?: Array<{ id: string; text: string; note?: string }>;
    subModules?: Array<{
      title: string;
      actions: Array<{ id: string; text: string; note?: string }>;
    }>;
  }>
): Map<string, SharedCelineActionDefinition>;

export function collectShiftGuideActionIds(
  modules: Array<{
    title: string;
    type: 'standard' | 'choice';
    actions?: Array<{ id: string; text: string; note?: string }>;
    subModules?: Array<{
      title: string;
      actions: Array<{ id: string; text: string; note?: string }>;
    }>;
  }>
): Set<string>;

export function isCelineResponse(value: unknown): value is SharedCelineResponse;
