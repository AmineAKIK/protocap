import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerApp, createServerRuntimeState } from './server/app.mjs';
import { createDeepSeekProvider } from './server/providers/deepSeekProvider.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from './server/shiftGuideDefaults.mjs';
import { cleanupExpiredState, parseJsonEnvValue } from './server/runtimeUtils.mjs';
import { readServerSecret } from './server/security.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = existsSync(join(__dirname, 'dist'))
  ? join(__dirname, 'dist')
  : resolve(process.cwd(), 'dist');

const port = process.env.PORT || 3000;
const shiftGuideCode = readServerSecret(
  process.env,
  'SHIFTGUIDE_CODE',
  'VITE_SHIFTGUIDE_CODE'
);
const deepSeekApiKey = readServerSecret(
  process.env,
  'DEEPSEEK_API_KEY',
  'VITE_DEEPSEEK_API_KEY'
);
const shiftGuideConfig = {
  modules: parseJsonEnvValue('SG_MODULES', process.env.SG_MODULES),
  lexique: parseJsonEnvValue('SG_LEXIQUE', process.env.SG_LEXIQUE),
  systemPromptExtra: process.env.SG_SYSTEM_PROMPT ?? null,
  urgences: parseJsonEnvValue(
    'SG_URGENCES',
    process.env.SG_URGENCES,
    DEFAULT_SHIFTGUIDE_URGENCES
  ),
};

const runtimeState = createServerRuntimeState();
const celineProvider = createDeepSeekProvider({ apiKey: deepSeekApiKey });
const { app } = createServerApp({
  shiftGuideCode,
  shiftGuideConfig,
  celineProvider,
  runtimeState,
  distDir,
});

const cleanupTimer = setInterval(
  () => cleanupExpiredState(runtimeState),
  15 * 60 * 1000
);
cleanupTimer.unref();

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
