import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const dockerignore = readFileSync(new URL('../.dockerignore', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('production packaging uses the repository Dockerfile only', () => {
  assert.equal(existsSync(new URL('../nixpacks.toml', import.meta.url)), false);
  assert.equal(existsSync(new URL('../railway.toml', import.meta.url)), false);
  assert.match(dockerfile, /^FROM node:24-bookworm-slim AS build/m);
  assert.match(dockerfile, /^FROM node:24-bookworm-slim AS runtime/m);
  assert.match(dockerfile, /npm ci --omit=dev --ignore-scripts/);
  assert.match(dockerfile, /^USER node$/m);
  assert.match(dockerfile, /^CMD \["node", "server\.mjs"\]$/m);
});

test('direct runtime dependencies contain only server execution packages', () => {
  assert.ok(
    packageJson.dependencies &&
      typeof packageJson.dependencies === 'object' &&
      !Array.isArray(packageJson.dependencies),
    'package.json must declare a dependencies object'
  );
  assert.ok(
    packageJson.devDependencies &&
      typeof packageJson.devDependencies === 'object' &&
      !Array.isArray(packageJson.devDependencies),
    'package.json must declare a devDependencies object'
  );

  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), ['express']);

  for (const dependency of ['lucide-react', 'react', 'react-dom', 'react-router-dom']) {
    assert.equal(
      typeof packageJson.devDependencies[dependency],
      'string',
      `${dependency} must remain a build-stage dependency`
    );
  }
});

test('Docker build context excludes generated and non-runtime material', () => {
  for (const entry of ['node_modules', 'dist', 'docs', 'e2e', 'evals', 'tests']) {
    assert.match(dockerignore, new RegExp(`^${entry}$`, 'm'));
  }
});
