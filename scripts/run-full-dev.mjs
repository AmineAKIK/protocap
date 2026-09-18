import { spawn } from 'node:child_process';
import { loadEnvironmentFile } from './runtime-env.mjs';

loadEnvironmentFile(process.env.PROTOCAP_ENV_FILE || '.env.local');

const host = process.env.DEV_HOST || '127.0.0.1';
const apiPort = process.env.PORT || '3000';
const vitePort = process.env.VITE_PORT || '5173';

function start(command, args, env) {
  return spawn(command, args, { stdio: 'inherit', env, shell: false });
}

const api = start(process.execPath, ['server.mjs'], {
  ...process.env,
  PORT: apiPort,
  HOST: '127.0.0.1',
  PROTOCAP_RUNTIME_PROFILE: 'development',
});
const ui = start(process.execPath, ['./node_modules/vite/bin/vite.js', '--host', host, '--port', vitePort], {
  ...process.env,
  VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
  PROTOCAP_RUNTIME_PROFILE: 'development',
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
