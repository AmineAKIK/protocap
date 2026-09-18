import { spawn } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('coverage/server');
const rawDirectory = resolve(outputDirectory, 'v8');
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(rawDirectory, { recursive: true });

const tests = (await readdir('tests'))
  .filter((name) => name.endsWith('.test.mjs'))
  .sort()
  .map((name) => `tests/${name}`);

if (tests.length === 0) {
  throw new Error('Server coverage discovered zero Node test files.');
}

const args = [
  '--test',
  '--experimental-test-coverage',
  '--test-coverage-include=server.mjs',
  '--test-coverage-include=server/**/*.mjs',
  '--test-coverage-include=shared/**/*.js',
  '--test-coverage-include=demo/**/*.mjs',
  ...tests,
];

const child = spawn(process.execPath, args, {
  env: {
    ...process.env,
    NODE_V8_COVERAGE: rawDirectory,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
for (const stream of [child.stdout, child.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    output += chunk;
    const destination = stream === child.stdout ? process.stdout : process.stderr;
    destination.write(chunk);
  });
}

const exitCode = await new Promise((resolveExit, reject) => {
  child.once('error', reject);
  child.once('close', (code, signal) => {
    if (signal) reject(new Error(`Server coverage terminated by ${signal}.`));
    else resolveExit(code ?? 1);
  });
});

await writeFile(resolve(outputDirectory, 'summary.txt'), output, 'utf8');
if (exitCode !== 0) process.exitCode = exitCode;
