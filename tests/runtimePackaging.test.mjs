import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const dockerignore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');

test('production packaging uses the repository Dockerfile only', () => {
  assert.equal(existsSync(new URL('../nixpacks.toml', import.meta.url)), false);
  assert.equal(existsSync(new URL('../railway.toml', import.meta.url)), false);
  assert.match(dockerfile, /^FROM node:24-bookworm-slim AS build/m);
  assert.match(dockerfile, /^FROM node:24-bookworm-slim AS runtime/m);
  assert.match(dockerfile, /npm ci --omit=dev --ignore-scripts/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /^CMD \["node", "server\.mjs"\]$/m);
});

test('Docker build context excludes generated and non-runtime material', () => {
  for (const entry of ['node_modules', 'dist', 'docs', 'e2e', 'evals', 'tests']) {
    assert.match(dockerignore, new RegExp(`^${entry}$`, 'm'));
  }
});
