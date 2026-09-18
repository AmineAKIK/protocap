import { spawnSync } from 'node:child_process';
import { E2E_SUITES, playwrightArguments } from './e2e-suites.mjs';

const suiteName = process.argv[2];
const suite = E2E_SUITES[suiteName];
if (!suite) {
  throw new Error(`Usage: node scripts/run-e2e-suite.mjs <${Object.keys(E2E_SUITES).join('|')}>`);
}

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const environment = {
  ...process.env,
  PLAYWRIGHT_SUITE: suiteName,
};

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: environment,
    encoding: options.capture ? 'utf8' : undefined,
    stdio: options.capture ? 'pipe' : 'inherit',
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  return result;
}

if (process.env.E2E_SKIP_BUILD !== '1') {
  const build = run(npmCommand, ['run', 'build']);
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const playwrightCli = './node_modules/@playwright/test/cli.js';
const listing = run(process.execPath, [playwrightCli, ...playwrightArguments(suiteName, { list: true })], {
  capture: true,
});
const listOutput = `${listing.stdout ?? ''}${listing.stderr ?? ''}`;
if (listing.status !== 0) {
  process.stdout.write(listOutput);
  process.exit(listing.status ?? 1);
}
const discovered = /Total:\s+([1-9]\d*)\s+tests?\b/.exec(listOutput);
if (!discovered) {
  process.stdout.write(listOutput);
  throw new Error(`E2E suite ${suiteName} discovered zero tests or produced an unreadable list.`);
}
console.log(`E2E suite ${suiteName}: ${discovered[1]} tests discovered.`);

const execution = run(process.execPath, [playwrightCli, ...playwrightArguments(suiteName)]);
if (execution.status !== 0) process.exit(execution.status ?? 1);
