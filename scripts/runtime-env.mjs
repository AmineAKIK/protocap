import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;
  const index = trimmed.indexOf('=');
  if (index < 1) throw new Error(`Invalid environment line: ${line}`);
  const key = trimmed.slice(0, index).trim();
  const raw = trimmed.slice(index + 1).trim();
  const value = raw.length >= 2 && ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'")))
    ? raw.slice(1, -1)
    : raw;
  return [key, value];
}

export function loadEnvironmentFile(path = '.env.local', { override = false } = {}) {
  const absolute = resolve(path);
  if (!existsSync(absolute)) return { path: absolute, loaded: false };
  const content = readFileSync(absolute, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (override || process.env[key] === undefined) process.env[key] = value;
  }
  return { path: absolute, loaded: true };
}
