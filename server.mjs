import { randomBytes } from 'node:crypto';
import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCelineSystemPrompt } from './server/celinePrompt.mjs';
import {
  buildSecurityHeaders,
  readServerSecret,
  safeCompareSecrets,
  toClientShiftGuideData,
} from './server/security.mjs';
import {
  cleanupExpiredState,
  hasValidSession,
  normalizeChatHistory,
  parseJsonEnvValue,
  revokeSession,
  takeRateLimit,
} from './server/runtimeUtils.mjs';
import { isValidShiftGuideConfig } from './server/shiftGuideValidation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = existsSync(join(__dirname, 'dist'))
  ? join(__dirname, 'dist')
  : resolve(process.cwd(), 'dist');

const PORT = process.env.PORT || 3000;
const SHIFTGUIDE_CODE = readServerSecret(
  process.env,
  'SHIFTGUIDE_CODE',
  'VITE_SHIFTGUIDE_CODE'
);
const DEEPSEEK_API_KEY = readServerSecret(
  process.env,
  'DEEPSEEK_API_KEY',
  'VITE_DEEPSEEK_API_KEY'
);
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const UNLOCK_MAX_ATTEMPTS = 10;
const MAX_UNLOCK_CODE_LENGTH = 256;
const CHAT_WINDOW_MS = 60 * 1000;
const CHAT_MAX_REQUESTS = 30;

const shiftGuideConfig = {
  modules: parseJsonEnvValue('SG_MODULES', process.env.SG_MODULES),
  lexique: parseJsonEnvValue('SG_LEXIQUE', process.env.SG_LEXIQUE),
  systemPromptExtra: process.env.SG_SYSTEM_PROMPT ?? null,
  urgences: parseJsonEnvValue('SG_URGENCES', process.env.SG_URGENCES),
};
const shiftGuideClientData = toClientShiftGuideData(shiftGuideConfig);

const hasValidShiftGuideConfig = isValidShiftGuideConfig(shiftGuideConfig);
if (SHIFTGUIDE_CODE && !hasValidShiftGuideConfig) {
  throw new Error('ShiftGuide is enabled but SG_MODULES or SG_LEXIQUE has an invalid structure.');
}

const celineSystemPrompt = hasValidShiftGuideConfig
  ? buildCelineSystemPrompt(shiftGuideConfig)
  : null;

const sessions = new Map();
const unlockAttempts = new Map();
const chatRequests = new Map();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use((req, res, next) => {
  const headers = buildSecurityHeaders({ secure: req.secure });
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value);
  }
  next();
});
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.json({ limit: '128kb' }));
app.use((error, _req, res, next) => {
  if (error && typeof error === 'object' && error.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse.' });
  }
  if (error && typeof error === 'object' && error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide.' });
  }
  return next(error);
});

function issueSession() {
  const token = randomBytes(32).toString('base64url');
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function getSessionToken(req) {
  const authorization = req.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

const cleanupTimer = setInterval(
  () => cleanupExpiredState({ sessions, unlockAttempts, chatRequests }),
  15 * 60 * 1000
);
cleanupTimer.unref();

// ── API ──────────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/shiftguide/unlock', (req, res) => {
  if (!SHIFTGUIDE_CODE || !celineSystemPrompt) {
    return res.status(503).json({ error: 'Accès ShiftGuide non configuré.' });
  }

  const clientKey = req.ip || 'unknown';
  const limit = takeRateLimit(unlockAttempts, clientKey, UNLOCK_MAX_ATTEMPTS, UNLOCK_WINDOW_MS);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({ error: 'Trop de tentatives. Réessaie plus tard.' });
  }

  const { code } = req.body ?? {};
  if (
    typeof code !== 'string' ||
    code.length === 0 ||
    code.length > MAX_UNLOCK_CODE_LENGTH ||
    !safeCompareSecrets(code, SHIFTGUIDE_CODE)
  ) {
    return res.status(401).json({ error: 'Code incorrect.' });
  }

  unlockAttempts.delete(clientKey);
  const token = issueSession();
  return res.json({ token, ...shiftGuideClientData });
});

app.get('/api/shiftguide/session', (req, res) => {
  const token = getSessionToken(req);
  if (!hasValidSession(sessions, chatRequests, token)) {
    return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
  }

  return res.json({ ok: true });
});

app.delete('/api/shiftguide/session', (req, res) => {
  const token = getSessionToken(req);
  revokeSession(sessions, chatRequests, token);
  return res.status(204).end();
});

app.post('/api/celine/chat', async (req, res) => {
  const token = getSessionToken(req);
  if (!hasValidSession(sessions, chatRequests, token)) {
    return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
  }

  const limit = takeRateLimit(chatRequests, token, CHAT_MAX_REQUESTS, CHAT_WINDOW_MS);
  if (!limit.allowed) {
    res.set('Retry-After', String(limit.retryAfterSeconds));
    return res.status(429).json({ error: 'Trop de requêtes. Réessaie dans un moment.' });
  }

  if (!DEEPSEEK_API_KEY || !celineSystemPrompt) {
    return res.status(503).json({ error: 'Service IA non configuré.' });
  }

  const history = normalizeChatHistory(req.body?.messages);
  if (!history) {
    return res.status(400).json({ error: 'Requête IA invalide.' });
  }

  try {
    const upstream = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'system', content: celineSystemPrompt }, ...history],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(45_000),
    });

    if (!upstream.ok) {
      console.error('DeepSeek upstream request failed', { status: upstream.status });
      if (upstream.status === 429) {
        return res.status(429).json({ error: 'Service IA temporairement saturé.' });
      }
      return res.status(502).json({ error: 'Service IA indisponible.' });
    }

    const payload = await upstream.json();
    return res.json(payload);
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Service IA trop lent.' });
    }
    console.error('DeepSeek request failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(502).json({ error: 'Service IA indisponible.' });
  }
});

app.use('/api', (_req, res) => {
  return res.status(404).json({ error: 'Route API introuvable.' });
});

// ── Static SPA ────────────────────────────────────────────────────────────────

app.use(express.static(DIST));

app.get('/{*path}', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

app.use((error, _req, res, next) => {
  console.error('Unhandled server error', {
    error: error instanceof Error ? error.name : 'UnknownError',
  });

  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Erreur serveur.' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
