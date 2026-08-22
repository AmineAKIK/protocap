import { randomBytes } from 'node:crypto';
import express from 'express';
import { join } from 'node:path';
import { collectShiftGuideActionIds, parseCelineAssistantContent } from '../shared/celineContract.js';
import { validateShiftGuideConfig } from '../shared/shiftGuideContract.js';
import { buildCelineSystemPrompt } from './celinePrompt.mjs';
import { CelineProviderError } from './providers/deepSeekProvider.mjs';
import {
  buildSecurityHeaders,
  safeCompareSecrets,
  toClientShiftGuideData,
} from './security.mjs';
import {
  hasValidSession,
  normalizeChatHistory,
  revokeSession,
  takeRateLimit,
} from './runtimeUtils.mjs';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const UNLOCK_MAX_ATTEMPTS = 10;
const MAX_UNLOCK_CODE_LENGTH = 256;
const CHAT_WINDOW_MS = 60 * 1000;
const CHAT_MAX_REQUESTS = 30;

export function createServerRuntimeState() {
  return {
    sessions: new Map(),
    unlockAttempts: new Map(),
    chatRequests: new Map(),
  };
}

function defaultIssueToken() {
  return randomBytes(32).toString('base64url');
}

function getSessionToken(req) {
  const authorization = req.get('authorization') ?? '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
}

function mapProviderError(error) {
  if (!(error instanceof CelineProviderError)) {
    return { status: 502, error: 'Service IA indisponible.' };
  }
  if (error.code === 'rate_limited') {
    return { status: 429, error: 'Service IA temporairement saturé.' };
  }
  if (error.code === 'timeout') {
    return { status: 504, error: 'Service IA trop lent.' };
  }
  return { status: 502, error: 'Service IA indisponible.' };
}

export function createServerApp({
  shiftGuideCode,
  shiftGuideConfig,
  celineProvider = null,
  runtimeState = createServerRuntimeState(),
  distDir = null,
  logger = console,
  now = () => Date.now(),
  issueToken = defaultIssueToken,
} = {}) {
  const validation = validateShiftGuideConfig(shiftGuideConfig);
  if (shiftGuideCode && !validation.ok) {
    throw new Error(`ShiftGuide configuration is invalid: ${validation.errors.join('; ')}`);
  }

  const shiftGuideClientData = validation.ok ? toClientShiftGuideData(shiftGuideConfig) : null;
  const celineSystemPrompt = validation.ok ? buildCelineSystemPrompt(shiftGuideConfig) : null;
  const allowedActionIds = validation.ok
    ? collectShiftGuideActionIds(shiftGuideConfig.modules)
    : new Set();
  const { sessions, unlockAttempts, chatRequests } = runtimeState;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const headers = buildSecurityHeaders({ secure: req.secure });
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
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
    const token = issueToken();
    sessions.set(token, now() + SESSION_TTL_MS);
    return token;
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/shiftguide/unlock', (req, res) => {
    if (!shiftGuideCode || !celineSystemPrompt || !shiftGuideClientData) {
      return res.status(503).json({ error: 'Accès ShiftGuide non configuré.' });
    }

    const clientKey = req.ip || 'unknown';
    const limit = takeRateLimit(
      unlockAttempts,
      clientKey,
      UNLOCK_MAX_ATTEMPTS,
      UNLOCK_WINDOW_MS,
      now()
    );
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Trop de tentatives. Réessaie plus tard.' });
    }

    const { code } = req.body ?? {};
    if (
      typeof code !== 'string' ||
      code.length === 0 ||
      code.length > MAX_UNLOCK_CODE_LENGTH ||
      !safeCompareSecrets(code, shiftGuideCode)
    ) {
      return res.status(401).json({ error: 'Code incorrect.' });
    }

    unlockAttempts.delete(clientKey);
    return res.json({ token: issueSession(), ...shiftGuideClientData });
  });

  app.get('/api/shiftguide/session', (req, res) => {
    const token = getSessionToken(req);
    if (!hasValidSession(sessions, chatRequests, token, now())) {
      return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
    }
    return res.json({ ok: true });
  });

  app.delete('/api/shiftguide/session', (req, res) => {
    revokeSession(sessions, chatRequests, getSessionToken(req));
    return res.status(204).end();
  });

  app.post('/api/celine/chat', async (req, res) => {
    const token = getSessionToken(req);
    if (!hasValidSession(sessions, chatRequests, token, now())) {
      return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
    }

    const limit = takeRateLimit(chatRequests, token, CHAT_MAX_REQUESTS, CHAT_WINDOW_MS, now());
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfterSeconds));
      return res.status(429).json({ error: 'Trop de requêtes. Réessaie dans un moment.' });
    }

    if (!celineProvider || !celineSystemPrompt) {
      return res.status(503).json({ error: 'Service IA non configuré.' });
    }

    const history = normalizeChatHistory(req.body?.messages);
    if (!history) {
      return res.status(400).json({ error: 'Requête IA invalide.' });
    }

    try {
      const providerContent = await celineProvider.complete({
        systemPrompt: celineSystemPrompt,
        history,
      });
      const response = parseCelineAssistantContent(providerContent, allowedActionIds);
      if (!response) {
        logger.error('Celine provider returned an invalid domain response');
        return res.status(502).json({ error: 'Service IA indisponible.' });
      }
      return res.json(response);
    } catch (error) {
      const mapped = mapProviderError(error);
      logger.error('Celine provider request failed', {
        code: error instanceof CelineProviderError ? error.code : 'unknown',
      });
      return res.status(mapped.status).json({ error: mapped.error });
    }
  });

  app.use('/api', (_req, res) => {
    return res.status(404).json({ error: 'Route API introuvable.' });
  });

  if (distDir) {
    app.use(express.static(distDir));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(join(distDir, 'index.html'));
    });
  }

  app.use((error, _req, res, next) => {
    logger.error('Unhandled server error', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Erreur serveur.' });
  });

  return { app, runtimeState };
}
