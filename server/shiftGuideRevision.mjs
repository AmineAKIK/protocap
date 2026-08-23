import { createHash } from 'node:crypto';
import { parseShiftGuideConfig } from '../shared/shiftGuideContract.js';

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
  const parsed = parseShiftGuideConfig(config);
  if (!parsed.ok) {
    throw new Error(`Cannot create ShiftGuide revision from invalid configuration: ${parsed.errors.join('; ')}`);
  }

  const canonical = stableSerialize(parsed.value);
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}
