import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import test from 'node:test';

const SECRET_VITE_PATTERN = /VITE_(?:DEEPSEEK_API_KEY|OPENAI_API_KEY|SHIFTGUIDE_CODE)/g;
const CLIENT_SECRET_NAME_PATTERN = /\b(?:VITE_(?:DEEPSEEK_API_KEY|OPENAI_API_KEY|SHIFTGUIDE_CODE)|DEEPSEEK_API_KEY|OPENAI_API_KEY|SHIFTGUIDE_CODE)\b/g;
const TEXT_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.svg', '.txt', '.xml']);

async function read(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function collectClientFiles(relativePath) {
  const root = new URL(`../${relativePath}`, import.meta.url);
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...await collectClientFiles(child));
    else if (TEXT_EXTENSIONS.has(extname(entry.name))) files.push(child);
  }
  return files;
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

test('browser-facing sources never reference server secret identifiers', async () => {
  const files = [
    ...(await collectClientFiles('src')),
    ...(await collectClientFiles('public')),
    'index.html',
    'vite.config.ts',
  ];

  for (const file of files) {
    const content = await read(file);
    assert.doesNotMatch(content, CLIENT_SECRET_NAME_PATTERN, `${file} must not reference server secret identifiers`);
  }
});
