import { createHash } from 'node:crypto';

function stableSerialize(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`);
    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createShiftGuideConfigRevision(config) {
  const canonical = stableSerialize({
    modules: config.modules,
    lexique: config.lexique,
    urgences: config.urgences,
    systemPromptExtra: config.systemPromptExtra ?? null,
  });

  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
