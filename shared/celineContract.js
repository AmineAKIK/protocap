function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value) {
  return value === null || (typeof value === 'string' && value.length <= 4_000);
}

export function parseCelineAssistantContent(rawContent, allowedActionIds) {
  if (typeof rawContent !== 'string' || rawContent.length === 0 || rawContent.length > 100_000) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  if (typeof parsed.message !== 'string' || parsed.message.length === 0 || parsed.message.length > 20_000) {
    return null;
  }
  if (!Array.isArray(parsed.checklist) || parsed.checklist.length > 100) return null;
  if (!optionalText(parsed.followUp)) return null;

  const seenActionIds = new Set();
  const checklist = [];

  for (const item of parsed.checklist) {
    if (!isRecord(item)) return null;
    if (typeof item.actionId !== 'string' || !allowedActionIds.has(item.actionId)) return null;
    if (seenActionIds.has(item.actionId)) return null;
    if (typeof item.text !== 'string' || item.text.length === 0 || item.text.length > 4_000) return null;
    if (!optionalText(item.note) || !optionalText(item.module)) return null;

    seenActionIds.add(item.actionId);
    checklist.push({
      actionId: item.actionId,
      text: item.text,
      note: item.note ?? null,
      module: item.module ?? null,
    });
  }

  return {
    message: parsed.message,
    checklist,
    followUp: parsed.followUp ?? null,
  };
}

export function collectShiftGuideActionIds(modules) {
  const actionIds = new Set();
  for (const module of modules) {
    const actionCollections = module.type === 'choice'
      ? module.subModules.map((subModule) => subModule.actions)
      : [module.actions];
    for (const actions of actionCollections) {
      for (const action of actions) actionIds.add(action.id);
    }
  }
  return actionIds;
}

export function isCelineResponse(value) {
  if (!isRecord(value)) return false;
  if (typeof value.message !== 'string' || !Array.isArray(value.checklist)) return false;
  if (!optionalText(value.followUp)) return false;
  return value.checklist.every((item) =>
    isRecord(item) &&
    typeof item.actionId === 'string' &&
    typeof item.text === 'string' &&
    optionalText(item.note) &&
    optionalText(item.module)
  );
}
