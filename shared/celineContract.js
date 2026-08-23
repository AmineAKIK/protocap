function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value) {
  return value === null || (typeof value === 'string' && value.length <= 4_000);
}

const DECISION_KINDS = new Set(['route', 'clarify', 'lexicon', 'emergency', 'unknown']);

export function parseCelineDecision(rawContent) {
  if (typeof rawContent !== 'string' || rawContent.length === 0 || rawContent.length > 20_000) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !DECISION_KINDS.has(parsed.kind)) return null;
  if (parsed.kind === 'unknown') return { kind: 'unknown' };

  if (typeof parsed.id !== 'string' || parsed.id.length === 0 || parsed.id.length > 200) return null;
  return { kind: parsed.kind, id: parsed.id };
}

export function isCelineResponse(value) {
  if (!isRecord(value)) return false;
  if (typeof value.message !== 'string' || value.message.length === 0 || value.message.length > 20_000) return false;
  if (!Array.isArray(value.checklist) || value.checklist.length > 100) return false;
  if (!optionalText(value.followUp)) return false;

  const seenActionIds = new Set();
  return value.checklist.every((item) => {
    if (!isRecord(item)) return false;
    if (typeof item.actionId !== 'string' || item.actionId.length === 0 || seenActionIds.has(item.actionId)) return false;
    if (typeof item.text !== 'string' || item.text.length === 0 || item.text.length > 4_000) return false;
    if (!optionalText(item.note) || !optionalText(item.module)) return false;
    seenActionIds.add(item.actionId);
    return true;
  });
}
