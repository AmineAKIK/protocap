import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerApp, createServerRuntimeState } from './server/app.mjs';
import { DEFAULT_CELINE_COST_LIMITS } from './server/celineCostGuard.mjs';
import { DEFAULT_CELINE_ROUTING_SPEC } from './server/celineRoutingDefault.mjs';
import { resolveServerSecret } from './server/envCompat.mjs';
import { RAILWAY_INGRESS_TRUST } from './server/ingressTrust.mjs';
import { createStructuredLogger } from './server/observability.mjs';
import { createDeepSeekProvider } from './server/providers/deepSeekProvider.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from './server/shiftGuideDefaults.mjs';
import { cleanupExpiredState, parseJsonEnvValue } from './server/runtimeUtils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = existsSync(join(__dirname, 'dist'))
  ? join(__dirname, 'dist')
  : resolve(process.cwd(), 'dist');

function readBoundedInteger(name, raw, fallback, min, max) {
  if (raw == null || raw === '') return fallback;
  if (!/^\d+$/.test(raw)) throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

const port = process.env.PORT || 3000;
const shiftGuideCode = resolveServerSecret(process.env, 'SHIFTGUIDE_CODE', 'VITE_SHIFTGUIDE_CODE');
const deepSeekApiKey = resolveServerSecret(process.env, 'DEEPSEEK_API_KEY', 'VITE_DEEPSEEK_API_KEY');
const celineModel = process.env.CELINE_MODEL?.trim() || 'deepseek-v4-flash';
const celineMaxTokens = readBoundedInteger('CELINE_MAX_TOKENS', process.env.CELINE_MAX_TOKENS, 160, 32, 512);
const celineCostLimits = {
  ...DEFAULT_CELINE_COST_LIMITS,
  providerCallsPerMinute: readBoundedInteger(
    'CELINE_PROVIDER_CALLS_PER_MINUTE',
    process.env.CELINE_PROVIDER_CALLS_PER_MINUTE,
    DEFAULT_CELINE_COST_LIMITS.providerCallsPerMinute,
    1,
    60
  ),
  providerTokensPerHour: readBoundedInteger(
    'CELINE_PROVIDER_TOKENS_PER_HOUR',
    process.env.CELINE_PROVIDER_TOKENS_PER_HOUR,
    DEFAULT_CELINE_COST_LIMITS.providerTokensPerHour,
    1_000,
    5_000_000
  ),
};
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
const celineRoutingSpec = parseJsonEnvValue(
  'SG_CELINE_ROUTING',
  process.env.SG_CELINE_ROUTING,
  DEFAULT_CELINE_ROUTING_SPEC
);

const runtimeState = createServerRuntimeState();
const celineProvider = createDeepSeekProvider({
  apiKey: deepSeekApiKey,
  model: celineModel,
  maxTokens: celineMaxTokens,
  costLimits: celineCostLimits,
});
const { app } = createServerApp({
  shiftGuideCode,
  shiftGuideConfig,
  celineRoutingSpec,
  celineProvider,
  runtimeState,
  distDir,
  ingressTrust: RAILWAY_INGRESS_TRUST,
});

const cleanupTimer = setInterval(
  () => cleanupExpiredState(runtimeState),
  15 * 60 * 1000
);
cleanupTimer.unref();

const log = createStructuredLogger(console);
app.listen(port, () => {
  log.info('server_started', {
    port: Number(port),
    celineModel,
    celineMaxTokens,
    celineProviderCallsPerMinute: celineCostLimits.providerCallsPerMinute,
    celineProviderTokensPerHour: celineCostLimits.providerTokensPerHour,
  });
});
