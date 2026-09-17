import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const execute = promisify(execFile);
const toolchain = ['vitest', '@vitest/coverage-v8', '@vitest/mocker'];

// This is a regression floor for the reviewed stable Vitest 4 line, not a
// substitute for live npm audit. A future major needs a separate review.
function assertPatchedVersion(version) {
  assert.equal(typeof version, 'string', 'missing Vitest version');
  const match = /^4\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  assert.ok(match, 'Vitest must use an exact stable version in the reviewed major');
  const minor = Number(match[1]);
  const patch = Number(match[2]);
  assert.ok(Number.isSafeInteger(minor) && Number.isSafeInteger(patch));
  assert.ok(minor > 1 || (minor === 1 && patch >= 11), 'GHSA-82fw-gwwq-j7x9 requires Vitest 4.1.11 or newer');
}

function assertPatchedGraph(manifest, lock) {
  assert.equal(lock.lockfileVersion, 3);
  assertPatchedVersion(manifest.devDependencies?.vitest);
  const version = manifest.devDependencies.vitest;
  assert.equal(manifest.devDependencies['@vitest/coverage-v8'], version);
  for (const name of ['vitest', '@vitest/coverage-v8']) {
    assert.equal(lock.packages?.['']?.devDependencies?.[name], version);
    assert.equal(Object.hasOwn(manifest.dependencies ?? {}, name), false);
  }
  for (const name of toolchain) {
    const entry = lock.packages?.[`node_modules/${name}`];
    assert.ok(entry, `missing locked ${name}`);
    assert.equal(entry.version, version, `misaligned ${name}`);
    assert.equal(entry.dev, true, `${name} must stay outside the runtime install`);
  }
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (/(?:^|\/)node_modules\/(?:vitest|@vitest\/(?:mocker|coverage-v8))$/.test(path)) {
      assertPatchedVersion(entry.version);
      assert.equal(entry.dev, true, `${path} must stay development-only`);
    }
  }
}

function validFixture() {
  const devDependencies = { vitest: '4.1.11', '@vitest/coverage-v8': '4.1.11' };
  return {
    manifest: { devDependencies: { ...devDependencies } },
    lock: {
      lockfileVersion: 3,
      packages: {
        '': { devDependencies: { ...devDependencies } },
        ...Object.fromEntries(toolchain.map((name) => [`node_modules/${name}`, { version: '4.1.11', dev: true }])),
      },
    },
  };
}

test('T32: the security floor rejects vulnerable, ranged, malformed and unreviewed versions', () => {
  for (const version of [undefined, '', '2.1.0', '3.2.0', '4.0.99', '4.1.9', '4.1.10', '^4.1.11', '4.1.11-beta.1', '5.0.0-beta.4', '4.01.11']) {
    assert.throws(() => assertPatchedVersion(version));
  }
  for (const version of ['4.1.11', '4.1.12', '4.2.0']) assert.doesNotThrow(() => assertPatchedVersion(version));
});

test('T32: a nested vulnerable mocker is rejected even with safe root packages', () => {
  const { manifest, lock } = validFixture();
  assert.doesNotThrow(() => assertPatchedGraph(manifest, lock));
  lock.packages['node_modules/example/node_modules/@vitest/mocker'] = { version: '4.1.10', dev: true };
  assert.throws(() => assertPatchedGraph(manifest, lock), /GHSA-82fw-gwwq-j7x9/);
});

test('T32: missing, misaligned and runtime-classified toolchain packages fail closed', () => {
  for (const name of toolchain) {
    const missing = validFixture();
    delete missing.lock.packages[`node_modules/${name}`];
    assert.throws(() => assertPatchedGraph(missing.manifest, missing.lock), /missing locked/);
    const mismatch = validFixture();
    mismatch.lock.packages[`node_modules/${name}`].version = '4.1.12';
    assert.throws(() => assertPatchedGraph(mismatch.manifest, mismatch.lock), /misaligned/);
    const runtime = validFixture();
    runtime.lock.packages[`node_modules/${name}`].dev = false;
    assert.throws(() => assertPatchedGraph(runtime.manifest, runtime.lock), /runtime install/);
  }
  const manifestMismatch = validFixture();
  manifestMismatch.manifest.devDependencies['@vitest/coverage-v8'] = '4.1.12';
  assert.throws(() => assertPatchedGraph(manifestMismatch.manifest, manifestMismatch.lock));
});

test('T32: the reviewed lockfile contains the patched aligned toolchain', async () => {
  const [manifest, lock] = await Promise.all([readJson('package.json'), readJson('package-lock.json')]);
  assertPatchedGraph(manifest, lock);
});

test('T32: actually installed Vitest packages match the reviewed lockfile', async () => {
  const lock = await readJson('package-lock.json');
  for (const name of toolchain) {
    const installed = await readJson(`node_modules/${name}/package.json`);
    assert.equal(installed.name, name);
    assertPatchedVersion(installed.version);
    assert.equal(installed.version, lock.packages[`node_modules/${name}`].version);
  }
});

// Exercise the actual npm scripts against a loopback-only failing registry.
// No external registry, provider key or repository mutation is involved.
for (const script of ['audit:full', 'audit:prod']) {
  test(`T33: ${script} cannot report success when the audit registry fails`, { timeout: 20_000 }, async () => {
    let requests = 0;
    const registry = createServer((request, response) => {
      requests += 1;
      request.resume();
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: 'intentional audit-registry failure' }));
    });
    await new Promise((resolve, reject) => {
      registry.once('error', reject);
      registry.listen(0, '127.0.0.1', resolve);
    });
    try {
      const { port } = registry.address();
      const args = ['run', script, '--', `--registry=http://127.0.0.1:${port}`, '--fetch-retries=0', '--fetch-timeout=1000'];
      const npmCli = process.env.npm_execpath;
      await assert.rejects(
        execute(npmCli ? process.execPath : 'npm', npmCli ? [npmCli, ...args] : args, {
          cwd: fileURLToPath(root), timeout: 10_000, maxBuffer: 1024 * 1024,
        }),
        (error) => Number.isInteger(error.code) && error.code > 0 && !error.killed,
      );
      assert.ok(requests > 0, 'the audit must actually contact the failing local registry');
    } finally {
      registry.closeAllConnections();
      await new Promise((resolve, reject) => registry.close((error) => error ? reject(error) : resolve()));
    }
  });
}
