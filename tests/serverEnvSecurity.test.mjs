import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SECRET_VITE_PATTERN = /VITE_(?:DEEPSEEK_API_KEY|OPENAI_API_KEY|SHIFTGUIDE_CODE)/g;

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('server runtime uses canonical server-only secret names', async () => {
  const server = await read('server.mjs');

  assert.match(server, /process\.env\.SHIFTGUIDE_CODE/);
  assert.match(server, /process\.env\.DEEPSEEK_API_KEY/);
  assert.doesNotMatch(server, SECRET_VITE_PATTERN);
});

test('documented environment template never exposes secret-shaped VITE variables', async () => {
  const envExample = await read('.env.example');

  assert.doesNotMatch(envExample, SECRET_VITE_PATTERN);
  assert.match(envExample, /^SHIFTGUIDE_CODE=/m);
  assert.match(envExample, /^DEEPSEEK_API_KEY=/m);
});
