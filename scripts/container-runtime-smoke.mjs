import { spawnSync } from 'node:child_process';
import { createDemoServerEnvironment } from '../demo/runtimeFixtures.mjs';

const image = process.argv[2] || 'protocap-ci';
const name = `protocap-ci-smoke-${process.pid}`;
const port = process.env.CONTAINER_SMOKE_PORT || '4180';
const baseUrl = `http://127.0.0.1:${port}`;
const environment = createDemoServerEnvironment({
  PORT: '3000',
  PROTOCAP_DEMO_PROVIDER: '1',
  PROTOCAP_PUBLIC_URL: 'http://127.0.0.1:4173',
});

function docker(args, options = {}) {
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
  });
  if (result.error) throw result.error;
  return result;
}

const runArgs = [
  'run', '--detach', '--rm', '--name', name,
  '--publish', `127.0.0.1:${port}:3000`,
  ...Object.entries(environment).flatMap(([key, value]) => ['--env', `${key}=${value}`]),
  image,
];

const started = docker(runArgs);
if (started.status !== 0) {
  process.stderr.write(started.stderr ?? '');
  process.exit(started.status ?? 1);
}

try {
  const deadline = Date.now() + 30_000;
  let ready = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/ready`);
      if (response.ok) {
        ready = await response.json();
        break;
      }
    } catch {
      // Container is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (!ready?.ok || ready.checks?.shiftGuide !== true || ready.checks?.celine !== true) {
    const logs = docker(['logs', name]);
    process.stderr.write(logs.stdout ?? '');
    process.stderr.write(logs.stderr ?? '');
    throw new Error('Built container never reached synthetic readiness.');
  }

  const availability = await fetch(`${baseUrl}/api/public-demo`).then((response) => response.json());
  if (availability.selfServe !== true || availability.entryUrl !== '/demo') {
    throw new Error('Built container did not start in the isolated demo profile.');
  }

  const unlock = await fetch(`${baseUrl}/api/shiftguide/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: environment.SHIFTGUIDE_CODE }),
  });
  if (unlock.status !== 404) {
    throw new Error('Demo container unexpectedly exposed the protected unlock route.');
  }

  console.log(`Container runtime smoke passed for ${image}.`);
} finally {
  docker(['rm', '--force', name]);
}
