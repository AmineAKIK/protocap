function isRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function optionalText(value) {
  return value === null || (typeof value === 'string' && value.length <= 4_000);
}

export function parseCelineAssistantContent(rawContent, actionCatalog) {
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
    if (typeof item.actionId !== 'string') return null;
    const canonical = actionCatalog.get(item.actionId);
    if (!canonical) return null;
    if (seenActionIds.has(item.actionId)) return null;

    seenActionIds.add(item.actionId);
    checklist.push({
      actionId: item.actionId,
      text: canonical.text,
      note: canonical.note,
      module: canonical.module,
    });
  }

  return {
    message: parsed.message,
    checklist,
    followUp: parsed.followUp ?? null,
  };
}

export function collectShiftGuideActions(modules) {
  const actionsById = new Map();
  for (const module of modules) {
    if (module.type === 'choice') {
      for (const subModule of module.subModules) {
        for (const action of subModule.actions) {
          actionsById.set(action.id, {
            text: action.text,
            note: action.note ?? null,
            module: subModule.title,
          });
        }
      }
      continue;
    }

    for (const action of module.actions) {
      actionsById.set(action.id, {
        text: action.text,
        note: action.note ?? null,
        module: module.title,
      });
    }
  }
  return actionsById;
}

export function collectShiftGuideActionIds(modules) {
  return new Set(collectShiftGuideActions(modules).keys());
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
