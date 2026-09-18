import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createDemoServerEnvironment } from '../demo/runtimeFixtures.mjs';

export const PUBLIC_DEMO_E2E_MARKER = 'PROTOCAP_PUBLIC_DEMO_E2E';

export function createPublicDemoE2eEnvironment() {
  return createDemoServerEnvironment({
    [PUBLIC_DEMO_E2E_MARKER]: '1',
    TZ: 'UTC',
    PORT: '4175',
    HOST: '127.0.0.1',
    PROTOCAP_DEMO_PROVIDER: '1',
    PROTOCAP_PUBLIC_URL: 'http://127.0.0.1:4176',
  });
}

export function replaceEnvironment(target, nextEnvironment) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, nextEnvironment);
  return target;
}

export async function startPublicDemoE2e(environment = process.env) {
  if (environment[PUBLIC_DEMO_E2E_MARKER] !== '1') {
    throw new Error('Public demo E2E harness must be started explicitly.');
  }
  replaceEnvironment(environment, createPublicDemoE2eEnvironment());
  console.log(JSON.stringify({
    level: 'info',
    event: 'public_demo_e2e_started',
    profile: 'demo',
    externalProviderConfigured: false,
  }));
  await import('../server.mjs');
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) await startPublicDemoE2e();
