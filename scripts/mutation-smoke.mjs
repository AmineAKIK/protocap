import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';

const vitest = './node_modules/vitest/vitest.mjs';
const mutations = [
  {
    name: 'inverted logistics transition permission',
    file: 'src/features/logistics/logisticsModel.ts',
    from: '  return allowedTransitions[from].includes(to);',
    to: '  return !allowedTransitions[from].includes(to);',
    spec: 'src/features/logistics/logisticsModel.test.ts',
  },
  {
    name: 'expiry calendar shifted by one extra day',
    file: 'src/features/expiry/time.ts',
    from: ".add({ days }, { overflow: 'reject' });",
    to: ".add({ days: days + 1 }, { overflow: 'reject' });",
    spec: 'src/features/expiry/time.test.ts',
  },
  {
    name: 'ignored logistics post-write verification',
    file: 'src/features/logistics/logisticsPersistence.ts',
    from: "    if (store.getItem(LOGISTICS_WORKSPACE_KEY) !== serialized) return { status: 'degraded', reason: 'verify' };",
    to: "    if (false) return { status: 'degraded', reason: 'verify' };",
    spec: 'src/features/logistics/logisticsPersistence.test.ts',
  },
];

for (const mutation of mutations) {
  const original = await readFile(mutation.file, 'utf8');
  const first = original.indexOf(mutation.from);
  const last = original.lastIndexOf(mutation.from);
  if (first < 0 || first !== last) {
    throw new Error(`Mutation target for ${mutation.name} must exist exactly once.`);
  }

  const mutated = original.replace(mutation.from, mutation.to);
  try {
    await writeFile(mutation.file, mutated, 'utf8');
    const result = spawnSync(
      process.execPath,
      [vitest, 'run', mutation.spec, '--config', 'vitest.config.ts'],
      {
        encoding: 'utf8',
        env: { ...process.env, CI: '1' },
        maxBuffer: 4 * 1024 * 1024,
      },
    );

    if (result.error) throw result.error;
    if (result.status === 0) {
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      throw new Error(`Critical mutation survived: ${mutation.name}.`);
    }
    console.log(`Detected mutation: ${mutation.name}`);
  } finally {
    await writeFile(mutation.file, original, 'utf8');
  }
}
