import { spawn } from 'node:child_process';
import { createDemoServerEnvironment } from '../demo/runtimeFixtures.mjs';

const forbidden = ['DEEPSEEK_API_KEY'];
for (const key of forbidden) {
  if ((process.env[key] ?? '').trim()) {
    throw new Error(`Demo refuses inherited ${key}; unset it before starting the synthetic runtime.`);
  }
}

const host = process.env.DEMO_HOST || '127.0.0.1';
const apiPort = process.env.DEMO_API_PORT || '4174';
const vitePort = process.env.DEMO_PORT || '4173';
const demoEnv = createDemoServerEnvironment({
  ...process.env,
  PORT: apiPort,
  HOST: '127.0.0.1',
  PROTOCAP_DEMO_PROVIDER: '1',
});

function start(command, args, env) {
  return spawn(command, args, { stdio: 'inherit', env, shell: false });
}

const api = start(process.execPath, ['server.mjs'], demoEnv);
const ui = start(process.execPath, ['./node_modules/vite/bin/vite.js', '--host', host, '--port', vitePort], {
  ...demoEnv,
  VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
});

let stopping = false;
function shutdown(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  if (!api.killed) api.kill(signal);
  if (!ui.killed) ui.kill(signal);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

const exits = await Promise.all([
  new Promise((resolve) => api.once('exit', (code, signal) => resolve({ name: 'api', code, signal }))),
  new Promise((resolve) => ui.once('exit', (code, signal) => resolve({ name: 'ui', code, signal }))),
]);
const unexpected = exits.find((entry) => entry.code && entry.code !== 0);
shutdown();
if (unexpected) process.exitCode = unexpected.code;
