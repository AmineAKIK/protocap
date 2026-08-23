import { randomBytes } from 'node:crypto';
import express from 'express';
import { join } from 'node:path';
import { parseCelineDecision } from '../shared/celineContract.js';
import { validateShiftGuideConfig } from '../shared/shiftGuideContract.js';
import { createCelineAuthority, resolveCelineDecision } from './celineAuthority.mjs';
import {
  createCelineAuthorityRevision,
  validateCelineRoutingSpec,
} from './celineRoutingContract.mjs';
import { createCelineSafeFallbackResponse } from './celineFallback.mjs';
import { buildCelineSystemPrompt } from './celinePrompt.mjs';
import {
  appendCelineProviderDecision,
  buildCelineProviderHistory,
  extractLatestCelineUserMessage,
} from './celineProviderContext.mjs';
import {
  attachRequestObservability,
  createStructuredLogger,
} from './observability.mjs';
import { CelineProviderError } from './providers/deepSeekProvider.mjs';
import { createReadinessSnapshot } from './readiness.mjs';
import { createClientDisconnectSignal } from './requestCancellation.mjs';
import {
  buildSecurityHeaders,
  safeCompareSecrets,
  toClientShiftGuideData,
} from './security.mjs';
import {
  hasValidSession,
  revokeSession,
  takeRateLimit,
} from './runtimeUtils.mjs';
import { createShiftGuideConfigRevision } from './shiftGuideRevision.mjs';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const UNLOCK_WINDOW_MS = 10 * 60 * 1000;
const UNLOCK_MAX_ATTEMPTS = 10;
const MAX_UNLOCK_CODE_LENGTH = 256;
const CHAT_WINDOW_MS = 60 * 1000;
const CHAT_MAX_REQUESTS = 30;
const CHAT_IP_MAX_REQUESTS = 60;

export function createServerRuntimeState() {
  return {
    sessions: new Map(),
    unlockAttempts: new Map(),
    chatRequests: new Map(),
    celineContexts: new Map(),
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
  celineRoutingSpec,
  celineProvider = null,
  runtimeState = createServerRuntimeState(),
  distDir = null,
  logger = console,
  now = () => Date.now(),
  telemetryNow = () => Date.now(),
  issueToken = defaultIssueToken,
} = {}) {
  const log = createStructuredLogger(logger);
  const validation = validateShiftGuideConfig(shiftGuideConfig);
  if (shiftGuideCode && !validation.ok) {
    throw new Error(`ShiftGuide configuration is invalid: ${validation.errors.join('; ')}`);
  }

  const routingValidation = validation.ok
    ? validateCelineRoutingSpec(celineRoutingSpec, shiftGuideConfig)
    : { ok: false, errors: ['ShiftGuide configuration must be valid before routing validation'] };
  if (shiftGuideCode && !routingValidation.ok) {
    throw new Error(`Celine routing configuration is invalid: ${routingValidation.errors.join('; ')}`);
  }

  const configRevision = validation.ok ? createShiftGuideConfigRevision(shiftGuideConfig) : null;
  const shiftGuideClientData = validation.ok ? toClientShiftGuideData(shiftGuideConfig) : null;
  const celineAuthority = validation.ok && routingValidation.ok
    ? createCelineAuthority(shiftGuideConfig, celineRoutingSpec)
    : null;
  const celineAuthorityRevision = routingValidation.ok
    ? createCelineAuthorityRevision(celineRoutingSpec)
    : null;
  const celineSystemPrompt = celineAuthority
    ? buildCelineSystemPrompt(shiftGuideConfig, celineAuthority)
    : null;
  const readiness = createReadinessSnapshot({
    shiftGuideCode,
    shiftGuideClientData,
    configRevision,
    celineAuthorityRevision,
    celineSystemPrompt,
    celineAuthority,
    celineProvider,
  });
  const { sessions, unlockAttempts, chatRequests, celineContexts } = runtimeState;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use((req, res, next) => {
    const headers = buildSecurityHeaders({ secure: req.secure });
    for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
    next();
  });
  attachRequestObservability(app, { logger: log, now: telemetryNow });
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
    const expiresAt = now() + SESSION_TTL_MS;
    sessions.set(token, expiresAt);
    return { token, expiresAt };
  }

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.get('/api/ready', (_req, res) => {
    return res.status(readiness.ok ? 200 : 503).json(readiness);
  });

  app.post('/api/shiftguide/unlock', (req, res) => {
    if (
      !shiftGuideCode ||
      !celineSystemPrompt ||
      !shiftGuideClientData ||
      !configRevision ||
      !celineAuthorityRevision
    ) {
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

    return res.json({
      ...issueSession(),
      configRevision,
      celineAuthorityRevision,
      ...shiftGuideClientData,
    });
  });

  app.get('/api/shiftguide/session', (req, res) => {
    const token = getSessionToken(req);
    if (!hasValidSession(sessions, chatRequests, token, now(), celineContexts)) {
      return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
    }
    return res.json({
      ok: true,
      expiresAt: sessions.get(token),
      configRevision,
      celineAuthorityRevision,
    });
  });

  app.delete('/api/shiftguide/session', (req, res) => {
    revokeSession(sessions, chatRequests, getSessionToken(req), celineContexts);
    return res.status(204).end();
  });

  app.post('/api/celine/chat', async (req, res) => {
    const token = getSessionToken(req);
    if (!hasValidSession(sessions, chatRequests, token, now(), celineContexts)) {
      return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
    }

    const clientKey = req.ip || 'unknown';
    const clientLimit = takeRateLimit(
      chatRequests,
      `ip:${clientKey}`,
      CHAT_IP_MAX_REQUESTS,
      CHAT_WINDOW_MS,
      now()
    );
    if (!clientLimit.allowed) {
      res.set('Retry-After', String(clientLimit.retryAfterSeconds));
      return res.status(429).json({ error: 'Trop de requêtes depuis ce client. Réessaie dans un moment.' });
    }

    const sessionLimit = takeRateLimit(chatRequests, token, CHAT_MAX_REQUESTS, CHAT_WINDOW_MS, now());
    if (!sessionLimit.allowed) {
      res.set('Retry-After', String(sessionLimit.retryAfterSeconds));
      return res.status(429).json({ error: 'Trop de requêtes. Réessaie dans un moment.' });
    }

    if (!celineProvider || !celineSystemPrompt || !celineAuthority) {
      return res.status(503).json({ error: 'Service IA non configuré.' });
    }

    const userMessage = extractLatestCelineUserMessage(req.body?.messages);
    if (!userMessage) {
      return res.status(400).json({ error: 'Requête IA invalide.' });
    }

    const providerHistory = buildCelineProviderHistory(
      celineContexts.get(token),
      userMessage
    );
    const clientDisconnect = createClientDisconnectSignal(res);
    const providerStartedAt = telemetryNow();

    try {
      const providerContent = await celineProvider.complete({
        systemPrompt: celineSystemPrompt,
        history: providerHistory,
        signal: clientDisconnect.signal,
      });
      const providerDurationMs = Math.max(0, telemetryNow() - providerStartedAt);
      const decision = parseCelineDecision(providerContent);
      const response = decision ? resolveCelineDecision(celineAuthority, decision) : null;
      const storedDecision = response && decision ? decision : { kind: 'unknown' };
      celineContexts.set(
        token,
        appendCelineProviderDecision(celineContexts.get(token), userMessage, storedDecision)
      );
      if (!response) {
        log.warn('celine_provider', {
          requestId: req.requestId,
          outcome: 'fallback',
          code: 'invalid_decision',
          durationMs: providerDurationMs,
        });
        return res.json(createCelineSafeFallbackResponse());
      }
      log.info('celine_provider', {
        requestId: req.requestId,
        outcome: 'success',
        durationMs: providerDurationMs,
      });
      return res.json(response);
    } catch (error) {
      const durationMs = Math.max(0, telemetryNow() - providerStartedAt);
      if (error instanceof CelineProviderError && error.code === 'cancelled') {
        log.info('celine_provider', {
          requestId: req.requestId,
          outcome: 'cancelled',
          durationMs,
        });
        return;
      }
      const mapped = mapProviderError(error);
      log.error('celine_provider', {
        requestId: req.requestId,
        outcome: 'error',
        code: error instanceof CelineProviderError ? error.code : 'unknown',
        upstreamStatus: error instanceof CelineProviderError ? error.upstreamStatus : null,
        durationMs,
      });
      return res.status(mapped.status).json({ error: mapped.error });
    } finally {
      clientDisconnect.dispose();
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

  app.use((error, req, res, next) => {
    log.error('server_error', {
      requestId: req.requestId ?? null,
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Erreur serveur.' });
  });

  return { app, runtimeState };
}
