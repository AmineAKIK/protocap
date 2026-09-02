import { randomBytes } from 'node:crypto';
import express from 'express';
import { extname, join } from 'node:path';
import { parseCelineDecision } from '../shared/celineContract.js';
import { parseShiftGuideConfig } from '../shared/shiftGuideContract.js';
import { createCelineAuthority, resolveCelineDecision } from './celineAuthority.mjs';
import { createCelineDomainEngine } from './celineDomainEngine.mjs';
import {
  createCelineAuthorityRevision,
  parseCelineRoutingSpec,
} from './celineRoutingContract.mjs';
import { createCelineSafeFallbackResponse } from './celineFallback.mjs';
import { buildCelineSystemPrompt } from './celinePrompt.mjs';
import {
  appendCelineProviderDecision,
  buildCelineProviderHistory,
  extractLatestCelineUserMessage,
} from './celineProviderContext.mjs';
import { createCelineSemanticIndex } from './celineSemanticIndex.mjs';
import { DIRECT_INGRESS_TRUST } from './ingressTrust.mjs';
import {
  attachRequestObservability,
  createStructuredLogger,
} from './observability.mjs';
import { CelineProviderError } from './providers/deepSeekProvider.mjs';
import { createReadinessSnapshot } from './readiness.mjs';
import { createClientDisconnectSignal } from './requestCancellation.mjs';
import {
  buildSecurityHeaders,
  isConfiguredSecret,
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
const CELINE_CONTEXT_HINTS = new Set([
  'debut_equipe',
  'debut_oc',
  'production',
  'evenement',
  'cloture',
  'tri',
  'reprise',
]);

export function createServerRuntimeState() {
  return {
    sessions: new Map(),
    unlockAttempts: new Map(),
    chatRequests: new Map(),
    celineContexts: new Map(),
    celineOperationalStates: new Map(),
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

function normalizeProviderResult(result, provider) {
  if (typeof result === 'string') {
    return { content: result, usage: null, model: provider?.model ?? null, finishReason: null };
  }
  if (!result || typeof result !== 'object' || typeof result.content !== 'string') {
    return { content: '', usage: null, model: provider?.model ?? null, finishReason: null };
  }
  return {
    content: result.content,
    usage: result.usage && typeof result.usage === 'object' ? result.usage : null,
    model: typeof result.model === 'string' ? result.model : provider?.model ?? null,
    finishReason: typeof result.finishReason === 'string' ? result.finishReason : null,
  };
}

function withContextHint(state, contextHint) {
  if (typeof contextHint !== 'string' || !CELINE_CONTEXT_HINTS.has(contextHint)) return state;
  return { ...state, context: contextHint };
}

function authorizeProviderDecision(authority, decision) {
  if (!decision || typeof decision !== 'object') return { authorized: false, response: null };
  if (decision.kind === 'route') {
    return { authorized: authority.routes.has(decision.id), response: null };
  }
  if (decision.kind === 'clarify') {
    return { authorized: authority.clarifications.has(decision.id), response: null };
  }
  const response = resolveCelineDecision(authority, decision);
  return { authorized: Boolean(response), response };
}

function selectProviderContextDecision(authority, providerDecision, resolved, response) {
  if (!response) return { kind: 'unknown' };
  const candidate = resolved?.decision ?? providerDecision;
  return authorizeProviderDecision(authority, candidate).authorized
    ? candidate
    : { kind: 'unknown' };
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
  ingressTrust = DIRECT_INGRESS_TRUST,
} = {}) {
  const log = createStructuredLogger(logger);
  const shiftGuideConfigured = isConfiguredSecret(shiftGuideCode);
  const parsedConfig = parseShiftGuideConfig(shiftGuideConfig);
  if (shiftGuideConfigured && !parsedConfig.ok) {
    throw new Error(`ShiftGuide configuration is invalid: ${parsedConfig.errors.join('; ')}`);
  }
  const canonicalConfig = parsedConfig.value;

  const parsedRouting = canonicalConfig
    ? parseCelineRoutingSpec(celineRoutingSpec, canonicalConfig)
    : { ok: false, errors: ['ShiftGuide configuration must be valid before routing validation'], value: null };
  if (shiftGuideConfigured && !parsedRouting.ok) {
    throw new Error(`Celine routing configuration is invalid: ${parsedRouting.errors.join('; ')}`);
  }
  const canonicalRouting = parsedRouting.value;

  const configRevision = canonicalConfig ? createShiftGuideConfigRevision(canonicalConfig) : null;
  const shiftGuideClientData = canonicalConfig ? toClientShiftGuideData(canonicalConfig) : null;
  const celineAuthority = canonicalConfig && canonicalRouting
    ? createCelineAuthority(canonicalConfig, canonicalRouting)
    : null;
  const celineSemanticIndex = canonicalConfig ? createCelineSemanticIndex(canonicalConfig) : null;
  const celineDomainEngine = celineAuthority && celineSemanticIndex
    ? createCelineDomainEngine({ authority: celineAuthority, semanticIndex: celineSemanticIndex })
    : null;
  const celineAuthorityRevision = canonicalRouting
    ? createCelineAuthorityRevision(canonicalRouting)
    : null;
  const celineSystemPrompt = canonicalConfig && celineAuthority
    ? buildCelineSystemPrompt(canonicalConfig, celineAuthority)
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
  const {
    sessions,
    unlockAttempts,
    chatRequests,
    celineContexts,
    celineOperationalStates = new Map(),
  } = runtimeState;
  runtimeState.celineOperationalStates = celineOperationalStates;

  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    const headers = buildSecurityHeaders({ secure: ingressTrust.isSecure(req) });
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
    if (celineDomainEngine) celineOperationalStates.set(token, celineDomainEngine.initialState());
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
      !shiftGuideConfigured ||
      !celineSystemPrompt ||
      !shiftGuideClientData ||
      !configRevision ||
      !celineAuthorityRevision
    ) {
      return res.status(503).json({ error: 'Accès ShiftGuide non configuré.' });
    }

    const clientKey = ingressTrust.clientAddress(req);
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
    if (!hasValidSession(
      sessions,
      chatRequests,
      token,
      now(),
      celineContexts,
      celineOperationalStates
    )) {
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
    revokeSession(
      sessions,
      chatRequests,
      getSessionToken(req),
      celineContexts,
      celineOperationalStates
    );
    return res.status(204).end();
  });

  app.post('/api/celine/chat', async (req, res) => {
    const token = getSessionToken(req);
    if (!hasValidSession(
      sessions,
      chatRequests,
      token,
      now(),
      celineContexts,
      celineOperationalStates
    )) {
      return res.status(401).json({ error: 'Session ShiftGuide invalide ou expirée.' });
    }

    const clientKey = ingressTrust.clientAddress(req);
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

    if (!celineSystemPrompt || !celineAuthority || !celineDomainEngine) {
      return res.status(503).json({ error: 'Service Céline non configuré.' });
    }

    const userMessage = extractLatestCelineUserMessage(req.body?.messages);
    if (!userMessage) {
      return res.status(400).json({ error: 'Requête IA invalide.' });
    }

    const storedOperationalState = celineOperationalStates.get(token) ?? celineDomainEngine.initialState();
    const currentOperationalState = withContextHint(storedOperationalState, req.body?.contextHint);
    const direct = celineDomainEngine.handleBeforeProvider(currentOperationalState, userMessage);
    if (direct?.handled && direct.response) {
      celineOperationalStates.set(token, direct.state);
      celineContexts.set(
        token,
        appendCelineProviderDecision(
          celineContexts.get(token),
          userMessage,
          direct.decision ?? { kind: 'unknown' }
        )
      );
      log.info('celine_domain', {
        requestId: req.requestId,
        outcome: 'deterministic',
        decisionKind: direct.decision?.kind ?? 'unknown',
        providerCalled: false,
      });
      return res.json(direct.response);
    }

    if (!celineProvider) {
      return res.status(503).json({ error: 'Service IA non configuré.' });
    }

    const providerHistory = buildCelineProviderHistory(
      celineContexts.get(token),
      userMessage
    );
    const clientDisconnect = createClientDisconnectSignal(res);
    const providerStartedAt = telemetryNow();

    try {
      const rawProviderResult = await celineProvider.complete({
        systemPrompt: celineSystemPrompt,
        history: providerHistory,
        signal: clientDisconnect.signal,
      });
      const providerResult = normalizeProviderResult(rawProviderResult, celineProvider);
      const providerDurationMs = Math.max(0, telemetryNow() - providerStartedAt);
      const decision = parseCelineDecision(providerResult.content);
      const authorization = authorizeProviderDecision(celineAuthority, decision);
      const resolved = decision && authorization.authorized
        ? celineDomainEngine.handleProviderDecision(
            direct?.state ?? currentOperationalState,
            decision,
            () => authorization.response
          )
        : null;
      const response = resolved?.handled ? resolved.response : null;
      const storedDecision = selectProviderContextDecision(
        celineAuthority,
        decision,
        resolved,
        response
      );

      if (resolved?.state) celineOperationalStates.set(token, resolved.state);
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
          model: providerResult.model,
          providerCalled: true,
        });
        return res.json(createCelineSafeFallbackResponse());
      }

      const usage = providerResult.usage;
      log.info('celine_provider', {
        requestId: req.requestId,
        outcome: 'success',
        decisionKind: decision?.kind ?? 'unknown',
        durationMs: providerDurationMs,
        model: providerResult.model,
        finishReason: providerResult.finishReason,
        providerCalled: true,
        promptTokens: usage?.promptTokens ?? null,
        completionTokens: usage?.completionTokens ?? null,
        totalTokens: usage?.totalTokens ?? null,
        promptCacheHitTokens: usage?.promptCacheHitTokens ?? null,
        promptCacheMissTokens: usage?.promptCacheMissTokens ?? null,
      });
      return res.json(response);
    } catch (error) {
      const durationMs = Math.max(0, telemetryNow() - providerStartedAt);
      if (error instanceof CelineProviderError && error.code === 'cancelled') {
        log.info('celine_provider', {
          requestId: req.requestId,
          outcome: 'cancelled',
          durationMs,
          providerCalled: true,
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
        providerCalled: true,
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
    app.get('/{*path}', (req, res) => {
      if (extname(req.path)) {
        return res.status(404).type('text/plain').send('Asset introuvable.');
      }
      return res.sendFile(join(distDir, 'index.html'));
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
