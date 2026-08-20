export function parseJsonEnvValue(name, raw, fallback = null) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must contain valid JSON.`, { cause: error });
  }
}

export function takeRateLimit(store, key, maxRequests, windowMs, now = Date.now()) {
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function normalizeChatHistory(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) return null;

  const history = messages[0]?.role === 'system' ? messages.slice(1) : messages;
  if (history.length === 0) return null;

  const valid = history.every((message) => {
    if (!message || typeof message !== 'object') return false;
    if (!['user', 'assistant'].includes(message.role)) return false;
    return typeof message.content === 'string' && message.content.length > 0 && message.content.length <= 20_000;
  });

  return valid ? history : null;
}

export function revokeSession(sessions, chatRequests, token) {
  if (!token) return false;
  const existed = sessions.delete(token);
  chatRequests.delete(token);
  return existed;
}

export function hasValidSession(sessions, chatRequests, token, now = Date.now()) {
  if (!token) return false;

  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    revokeSession(sessions, chatRequests, token);
    return false;
  }

  return true;
}

export function cleanupExpiredState({ sessions, unlockAttempts, chatRequests }, now = Date.now()) {
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) {
      revokeSession(sessions, chatRequests, token);
    }
  }

  for (const [key, entry] of unlockAttempts) {
    if (entry.resetAt <= now) unlockAttempts.delete(key);
  }

  for (const [key, entry] of chatRequests) {
    if (entry.resetAt <= now && !sessions.has(key)) chatRequests.delete(key);
  }
}
