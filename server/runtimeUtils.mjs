export function parseJsonEnvValue(name, raw, fallback = null) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`${name} must contain valid JSON.`, { cause: error });
  }
}

export function takeRateLimit(store, key, maxRequests, windowMs, now = Date.now()) {
  const cutoff = now - windowMs;
  const current = store.get(key);
  const timestamps = current?.timestamps?.filter((timestamp) => timestamp > cutoff) ?? [];

  if (timestamps.length >= maxRequests) {
    const retryAt = timestamps[0] + windowMs;
    store.set(key, { timestamps, resetAt: retryAt });
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now) / 1000)),
    };
  }

  timestamps.push(now);
  store.set(key, {
    timestamps,
    resetAt: timestamps[0] + windowMs,
  });
  return { allowed: true, retryAfterSeconds: 0 };
}

export function revokeSession(
  sessions,
  chatRequests,
  token,
  celineContexts = null,
  celineOperationalStates = null
) {
  if (!token) return false;
  const existed = sessions.delete(token);
  chatRequests.delete(token);
  celineContexts?.delete(token);
  celineOperationalStates?.delete(token);
  return existed;
}

export function hasValidSession(
  sessions,
  chatRequests,
  token,
  now = Date.now(),
  celineContexts = null,
  celineOperationalStates = null
) {
  if (!token) return false;

  const expiresAt = sessions.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= now) {
    revokeSession(
      sessions,
      chatRequests,
      token,
      celineContexts,
      celineOperationalStates
    );
    return false;
  }

  return true;
}

export function cleanupExpiredState(
  { sessions, unlockAttempts, chatRequests, celineContexts, celineOperationalStates },
  now = Date.now()
) {
  for (const [token, expiresAt] of sessions) {
    if (expiresAt <= now) {
      revokeSession(
        sessions,
        chatRequests,
        token,
        celineContexts,
        celineOperationalStates
      );
    }
  }

  for (const [key, entry] of unlockAttempts) {
    if (entry.resetAt <= now) unlockAttempts.delete(key);
  }

  for (const [key, entry] of chatRequests) {
    if (entry.resetAt <= now && !sessions.has(key)) chatRequests.delete(key);
  }
}
