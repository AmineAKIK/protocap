import { randomUUID } from 'node:crypto';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const KNOWN_API_PATHS = new Set([
  '/api/health',
  '/api/ready',
  '/api/shiftguide/unlock',
  '/api/shiftguide/session',
  '/api/celine/chat',
]);

function normalizeRequestId(value) {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : null;
}

function observableApiPath(req) {
  const routePath = typeof req.route?.path === 'string' ? req.route.path : null;
  return routePath && KNOWN_API_PATHS.has(routePath) ? routePath : '/api/*';
}

export function createRequestId(headerValue) {
  return normalizeRequestId(headerValue) ?? randomUUID();
}

export function createStructuredLogger(base = console) {
  function write(level, event, fields = {}) {
    const payload = {
      ts: new Date().toISOString(),
      level,
      event,
      ...fields,
    };
    const line = JSON.stringify(payload);
    const sink = typeof base[level] === 'function'
      ? base[level].bind(base)
      : typeof base.log === 'function'
        ? base.log.bind(base)
        : null;
    sink?.(line);
  }

  return {
    info(event, fields) {
      write('info', event, fields);
    },
    warn(event, fields) {
      write('warn', event, fields);
    },
    error(event, fields) {
      write('error', event, fields);
    },
  };
}

export function attachRequestObservability(app, { logger, now = () => Date.now() }) {
  app.use('/api', (req, res, next) => {
    const requestId = createRequestId(req.get('x-request-id'));
    const startedAt = now();
    let logged = false;
    req.requestId = requestId;
    res.set('X-Request-Id', requestId);

    const logRequest = (outcome) => {
      if (logged) return;
      logged = true;
      logger.info('http_request', {
        requestId,
        method: req.method,
        path: observableApiPath(req),
        status: outcome === 'completed' ? res.statusCode : null,
        outcome,
        durationMs: Math.max(0, now() - startedAt),
      });
    };

    res.once('finish', () => logRequest('completed'));
    res.once('close', () => {
      if (!res.writableFinished) logRequest('client_disconnected');
    });

    next();
  });
}
