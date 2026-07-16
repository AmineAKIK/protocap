import express from 'express';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createFailureRateLimiter,
  createSessionClaims,
  createSessionToken,
  parseCookies,
  refreshSessionClaims,
  verifyAccessCode,
  verifySessionToken,
} from './src/auth/shiftguideSecurity.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DIST = existsSync(join(__dirname, 'dist'))
  ? join(__dirname, 'dist')
  : resolve(process.cwd(), 'dist');

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function boundedNumber(raw, fallback, min, max) {
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function envBoolean(raw, fallback) {
  if (raw === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());
}

const SESSION_IDLE_MS =
  boundedNumber(process.env.SHIFTGUIDE_SESSION_IDLE_MINUTES, 30, 5, 240) * 60_000;
const SESSION_ABSOLUTE_MS =
  boundedNumber(process.env.SHIFTGUIDE_SESSION_ABSOLUTE_HOURS, 8, 1, 24) * 60 * 60_000;
const COOKIE_SECURE = envBoolean(process.env.SHIFTGUIDE_COOKIE_SECURE, IS_PRODUCTION);
const COOKIE_NAME = COOKIE_SECURE ? '__Host-shiftguide_session' : 'shiftguide_session';
const ACCESS_CODE_HASH = process.env.SHIFTGUIDE_ACCESS_CODE_HASH ?? '';
const LEGACY_ACCESS_CODE =
  process.env.SHIFTGUIDE_ACCESS_CODE ?? process.env.VITE_SHIFTGUIDE_CODE ?? '';
const CONFIGURED_SESSION_SECRET = process.env.SHIFTGUIDE_SESSION_SECRET ?? '';
const SESSION_SECRET = CONFIGURED_SESSION_SECRET || randomBytes(48).toString('base64url');
const DEEPSEEK_API_KEY =
  process.env.DEEPSEEK_API_KEY ?? process.env.VITE_DEEPSEEK_API_KEY ?? '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? 'deepseek-chat';
const ALLOWED_ORIGINS = new Set(
  (process.env.SHIFTGUIDE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
);

if (!CONFIGURED_SESSION_SECRET) {
  console.warn(
    'SHIFTGUIDE_SESSION_SECRET absent: les sessions seront invalidées au prochain redémarrage.'
  );
}

if (!ACCESS_CODE_HASH && process.env.VITE_SHIFTGUIDE_CODE) {
  console.warn(
    'VITE_SHIFTGUIDE_CODE est conservé en compatibilité. Préférer SHIFTGUIDE_ACCESS_CODE_HASH.'
  );
}

const app = express();

const trustProxy = process.env.TRUST_PROXY;
if (trustProxy === undefined && IS_PRODUCTION) {
  app.set('trust proxy', 1);
} else if (trustProxy && trustProxy !== 'false' && trustProxy !== '0') {
  const numericValue = Number.parseInt(trustProxy, 10);
  app.set('trust proxy', Number.isNaN(numericValue) ? trustProxy : numericValue);
}

app.disable('x-powered-by');

app.use((req, res, next) => {
  const connectSources = ["'self'"];
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      `connect-src ${connectSources.join(' ')}`,
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ].join('; ')
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=(self), payment=(), usb=()'
  );
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(
  '/api/shiftguide',
  express.json({ limit: '192kb', strict: true, type: 'application/json' })
);
app.use('/api/shiftguide', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  next();
});

function expectedRequestOrigin(req) {
  return `${req.protocol}://${req.get('host')}`.replace(/\/$/, '');
}

function requireTrustedOrigin(req, res, next) {
  const fetchSite = req.get('sec-fetch-site');
  if (fetchSite === 'cross-site') {
    return res.status(403).json({ error: 'Requête refusée.' });
  }

  const origin = req.get('origin');
  if (!origin) {
    if (!IS_PRODUCTION || fetchSite === 'same-origin') return next();
    return res.status(403).json({ error: 'Origine de requête absente.' });
  }

  const normalizedOrigin = origin.replace(/\/$/, '');
  if (
    normalizedOrigin !== expectedRequestOrigin(req) &&
    !ALLOWED_ORIGINS.has(normalizedOrigin)
  ) {
    return res.status(403).json({ error: 'Origine de requête non autorisée.' });
  }

  next();
}

function serializeSessionCookie(name, value, { maxAgeSeconds, secure = COOKIE_SECURE } = {}) {
  const attributes = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (Number.isFinite(maxAgeSeconds)) {
    attributes.push(`Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`);
  }
  if (secure) attributes.push('Secure');
  return attributes.join('; ');
}

function sessionMeta(claims, now = Date.now()) {
  return {
    expiresAt: claims.absoluteExpiresAt,
    idleExpiresAt: Math.min(claims.absoluteExpiresAt, now + SESSION_IDLE_MS),
    idleTimeoutMs: SESSION_IDLE_MS,
  };
}

function issueSessionCookie(res, claims, now = Date.now()) {
  const token = createSessionToken(claims, SESSION_SECRET);
  const maxAgeSeconds = Math.max(0, Math.ceil((claims.absoluteExpiresAt - now) / 1000));
  res.setHeader(
    'Set-Cookie',
    serializeSessionCookie(COOKIE_NAME, token, { maxAgeSeconds })
  );
}

function clearSessionCookies(res) {
  res.setHeader('Set-Cookie', [
    serializeSessionCookie('shiftguide_session', '', { maxAgeSeconds: 0, secure: false }),
    serializeSessionCookie('__Host-shiftguide_session', '', {
      maxAgeSeconds: 0,
      secure: true,
    }),
  ]);
}

function requireShiftGuideSession(req, res, next) {
  const cookies = parseCookies(req.get('cookie'));
  const token = cookies[COOKIE_NAME];
  const now = Date.now();
  const verified = verifySessionToken(token, SESSION_SECRET, {
    now,
    idleTimeoutMs: SESSION_IDLE_MS,
  });

  if (!verified.ok) {
    clearSessionCookies(res);
    return res.status(401).json({ error: 'Session expirée ou invalide.' });
  }

  const refreshedClaims = refreshSessionClaims(verified.claims, now);
  req.shiftGuideSession = refreshedClaims;
  issueSessionCookie(res, refreshedClaims, now);
  next();
}

function loadShiftGuideData() {
  try {
    const modules = JSON.parse(process.env.SG_MODULES ?? 'null');
    const lexique = JSON.parse(process.env.SG_LEXIQUE ?? 'null');
    const systemPromptExtra = process.env.SG_SYSTEM_PROMPT ?? null;
    const urgences = JSON.parse(process.env.SG_URGENCES ?? 'null');
    if (!modules || !lexique) return null;
    return { modules, lexique, systemPromptExtra, urgences };
  } catch {
    return null;
  }
}

const unlockLimiter = createFailureRateLimiter({
  maxFailures: boundedNumber(process.env.SHIFTGUIDE_MAX_LOGIN_FAILURES, 5, 3, 20),
  windowMs: boundedNumber(process.env.SHIFTGUIDE_LOGIN_WINDOW_MINUTES, 15, 1, 120) * 60_000,
  baseBlockMs: boundedNumber(process.env.SHIFTGUIDE_LOGIN_BLOCK_SECONDS, 30, 5, 900) * 1000,
  maxBlockMs: 15 * 60_000,
});

const limiterPruneTimer = setInterval(() => unlockLimiter.prune(), 10 * 60_000);
limiterPruneTimer.unref?.();

app.post('/api/shiftguide/unlock', requireTrustedOrigin, async (req, res) => {
  const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
  const limit = unlockLimiter.check(clientKey);
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil(limit.retryAfterMs / 1000));
    res.setHeader('Retry-After', String(retryAfter));
    return res.status(429).json({
      error: `Trop de tentatives. Réessaie dans ${retryAfter} seconde${retryAfter > 1 ? 's' : ''}.`,
    });
  }

  const code = req.body?.code;
  const validInput = typeof code === 'string' && code.length > 0 && code.length <= 256;
  const hasConfiguredCode = Boolean(ACCESS_CODE_HASH || LEGACY_ACCESS_CODE);
  const validCode =
    validInput &&
    hasConfiguredCode &&
    (await verifyAccessCode(code, {
      hash: ACCESS_CODE_HASH,
      plain: LEGACY_ACCESS_CODE,
    }));

  if (!validCode) {
    const failure = unlockLimiter.recordFailure(clientKey);
    if (!failure.allowed) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil(failure.retryAfterMs / 1000))));
    }
    return res.status(401).json({ error: 'Code incorrect.' });
  }

  const data = loadShiftGuideData();
  if (!data) {
    return res.status(500).json({ error: 'Données non configurées sur le serveur.' });
  }

  unlockLimiter.reset(clientKey);
  const now = Date.now();
  const claims = createSessionClaims({ now, absoluteTtlMs: SESSION_ABSOLUTE_MS });
  issueSessionCookie(res, claims, now);
  return res.json({ ...data, session: sessionMeta(claims, now) });
});

app.get('/api/shiftguide/session', requireShiftGuideSession, (req, res) => {
  const now = Date.now();
  return res.json({ ok: true, session: sessionMeta(req.shiftGuideSession, now) });
});

app.post('/api/shiftguide/logout', requireTrustedOrigin, (_req, res) => {
  clearSessionCookies(res);
  return res.status(204).end();
});

const chatWindows = new Map();
const CHAT_WINDOW_MS = 60_000;
const CHAT_REQUESTS_PER_WINDOW = boundedNumber(
  process.env.SHIFTGUIDE_CHAT_REQUESTS_PER_MINUTE,
  20,
  1,
  120
);

function allowChatRequest(clientKey, now = Date.now()) {
  const current = chatWindows.get(clientKey);
  if (!current || now - current.startedAt >= CHAT_WINDOW_MS) {
    chatWindows.set(clientKey, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  current.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((CHAT_WINDOW_MS - (now - current.startedAt)) / 1000));
  return { allowed: current.count <= CHAT_REQUESTS_PER_WINDOW, retryAfterSeconds };
}

function validatedChatMessages(body) {
  if (!body || typeof body !== 'object' || !Array.isArray(body.messages)) return null;
  if (body.messages.length < 1 || body.messages.length > 40) return null;

  let totalLength = 0;
  const messages = [];
  for (const message of body.messages) {
    if (!message || typeof message !== 'object') return null;
    if (!['system', 'user', 'assistant'].includes(message.role)) return null;
    if (
      typeof message.content !== 'string' ||
      message.content.length < 1 ||
      message.content.length > 24_000
    ) {
      return null;
    }
    totalLength += message.content.length;
    if (totalLength > 150_000) return null;
    messages.push({ role: message.role, content: message.content });
  }
  return messages;
}

app.post(
  '/api/shiftguide/chat',
  requireTrustedOrigin,
  requireShiftGuideSession,
  async (req, res) => {
    if (!DEEPSEEK_API_KEY) {
      return res.status(503).json({ error: 'Assistant externe non configuré.' });
    }

    const rate = allowChatRequest(req.ip || req.socket.remoteAddress || 'unknown');
    if (!rate.allowed) {
      res.setHeader('Retry-After', String(rate.retryAfterSeconds));
      return res.status(429).json({ error: 'Trop de requêtes. Réessaie dans un moment.' });
    }

    const messages = validatedChatMessages(req.body);
    if (!messages) {
      return res.status(400).json({ error: 'Requête de conversation invalide.' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const upstream = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          messages,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      const payload = await upstream.json().catch(() => null);
      if (!upstream.ok || !payload) {
        const status = upstream.status === 429 ? 429 : 502;
        return res.status(status).json({
          error:
            status === 429
              ? 'Quota de l’assistant atteint. Réessaie plus tard.'
              : 'Assistant momentanément indisponible.',
        });
      }

      return res.json(payload);
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'AbortError';
      return res.status(504).json({
        error: timedOut
          ? 'L’assistant a mis trop de temps à répondre.'
          : 'Assistant momentanément indisponible.',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
);

app.use('/api/shiftguide', (_req, res) => {
  res.status(404).json({ error: 'Endpoint introuvable.' });
});

app.use((error, req, res, next) => {
  if (!req.path.startsWith('/api/shiftguide')) return next(error);
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Requête trop volumineuse.' });
  }
  if (error instanceof SyntaxError) {
    return res.status(400).json({ error: 'Corps JSON invalide.' });
  }
  console.error('Erreur API ShiftGuide:', error?.message ?? 'erreur inconnue');
  return res.status(500).json({ error: 'Erreur serveur.' });
});

app.use(express.static(DIST));

app.get('/{*path}', (_req, res) => {
  res.sendFile(join(DIST, 'index.html'));
});

export { app };

if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  console.log('Serving static from:', DIST);
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
