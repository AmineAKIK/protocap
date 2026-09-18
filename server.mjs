import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerApp, createServerRuntimeState } from './server/app.mjs';
import { DEFAULT_CELINE_COST_LIMITS } from './server/celineCostGuard.mjs';
import { DEFAULT_CELINE_ROUTING_SPEC } from './server/celineRoutingDefault.mjs';
import { RAILWAY_INGRESS_TRUST } from './server/ingressTrust.mjs';
import { installGracefulShutdown } from './server/lifecycle.mjs';
import { createStructuredLogger } from './server/observability.mjs';
import { createDeepSeekProvider } from './server/providers/deepSeekProvider.mjs';
import { createScenarioProvider } from './server/providers/demoScenarioProvider.mjs';
import { cleanupExpiredState, parseJsonEnvValue } from './server/runtimeUtils.mjs';
import { isConfiguredSecret } from './server/security.mjs';
import { DEFAULT_SHIFTGUIDE_URGENCES } from './server/shiftGuideDefaults.mjs';

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

function readPublicOrigin(name, raw) {
  if (raw == null || raw.trim() === '') return null;
  let parsed;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new Error(`${name} must be a valid absolute URL.`);
  }
  const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:')) {
    throw new Error(`${name} must use HTTPS outside loopback test environments.`);
  }
  if (parsed.username || parsed.password) {
    throw new Error(`${name} must not contain credentials.`);
  }
  parsed.pathname = '/';
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

const port = process.env.PORT || 3000;
const host = process.env.HOST?.trim() || undefined;
const shiftGuideCode = process.env.SHIFTGUIDE_CODE ?? '';
const deepSeekApiKey = process.env.DEEPSEEK_API_KEY ?? '';
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
const demoMode = process.env.PROTOCAP_RUNTIME_PROFILE === 'demo' && process.env.PROTOCAP_DEMO_PROVIDER === '1';
const publicDemoUrl = readPublicOrigin('PUBLIC_DEMO_URL', process.env.PUBLIC_DEMO_URL);
const protoCapPublicUrl = readPublicOrigin('PROTOCAP_PUBLIC_URL', process.env.PROTOCAP_PUBLIC_URL);
if (demoMode && !protoCapPublicUrl) {
  throw new Error('PROTOCAP_PUBLIC_URL is required in demo runtime.');
}
if (demoMode && isConfiguredSecret(deepSeekApiKey)) {
  throw new Error('Demo runtime refuses a configured DeepSeek API key.');
}
const celineProvider = demoMode ? createScenarioProvider() : createDeepSeekProvider({
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
  publicDemo: { selfServe: demoMode, url: publicDemoUrl },
  demoPublicOrigin: demoMode ? protoCapPublicUrl : null,
});

const cleanupTimer = setInterval(
  () => cleanupExpiredState(runtimeState),
  15 * 60 * 1000
);
cleanupTimer.unref();

const log = createStructuredLogger(console);
const server = app.listen(port, host, () => {
  log.info('server_started', {
    port: Number(port),
    host: host ?? 'default',
    shiftGuideConfigured: isConfiguredSecret(shiftGuideCode),
    deepSeekConfigured: isConfiguredSecret(deepSeekApiKey),
    runtimeProfile: demoMode ? 'demo' : (process.env.PROTOCAP_RUNTIME_PROFILE || 'production'),
    celineModel,
    celineMaxTokens,
    celineProviderCallsPerMinute: celineCostLimits.providerCallsPerMinute,
    celineProviderTokensPerHour: celineCostLimits.providerTokensPerHour,
  });
});

installGracefulShutdown({
  server,
  cleanupTimer,
  logger: log,
});
