import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  createE2eServerEnvironment,
  replaceEnvironment,
} from './e2e-server-harness.mjs';

export const PUBLIC_DEMO_PROTECTED_E2E_MARKER = 'PROTOCAP_PUBLIC_DEMO_PROTECTED_E2E';

export function createPublicDemoProtectedEnvironment() {
  return {
    ...createE2eServerEnvironment(),
    [PUBLIC_DEMO_PROTECTED_E2E_MARKER]: '1',
    PORT: '4176',
    HOST: '127.0.0.1',
    PUBLIC_DEMO_URL: 'http://127.0.0.1:4175',
  };
}

export async function startPublicDemoProtectedE2e(environment = process.env) {
  if (environment[PUBLIC_DEMO_PROTECTED_E2E_MARKER] !== '1') {
    throw new Error('Protected public-demo E2E harness must be started explicitly.');
  }
  replaceEnvironment(environment, createPublicDemoProtectedEnvironment());
  console.log(JSON.stringify({
    level: 'info',
    event: 'public_demo_protected_e2e_started',
    profile: 'protected',
    demoOrigin: 'http://127.0.0.1:4175',
  }));
  await import('../server.mjs');
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isMain) await startPublicDemoProtectedE2e();
