import { Buffer } from 'node:buffer';
import { takeRateLimit } from './runtimeUtils.mjs';

export const DEFAULT_CELINE_COST_LIMITS = Object.freeze({
  providerCallsPerMinute: 8,
  providerTokensPerHour: 100_000,
  systemPromptMaxBytes: 32 * 1024,
  historyMaxChars: 12_000,
});

function nonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function measureCelineProviderInput(systemPrompt, history) {
  const safeHistory = Array.isArray(history) ? history : [];
  return {
    systemPromptBytes: Buffer.byteLength(typeof systemPrompt === 'string' ? systemPrompt : '', 'utf8'),
    historyMessages: safeHistory.length,
    historyChars: safeHistory.reduce(
      (total, message) => total + (typeof message?.content === 'string' ? message.content.length : 0),
      0
    ),
  };
}

export function createCelineProviderCostGuard({
  limits = DEFAULT_CELINE_COST_LIMITS,
  now = () => Date.now(),
} = {}) {
  const providerRequests = new Map();
  let tokenEvents = [];

  function pruneTokenEvents(timestamp) {
    const cutoff = timestamp - 60 * 60 * 1000;
    tokenEvents = tokenEvents.filter((event) => event.timestamp > cutoff);
  }

  function tokensInLastHour(timestamp) {
    pruneTokenEvents(timestamp);
    return tokenEvents.reduce((total, event) => total + event.totalTokens, 0);
  }

  return {
    beforeRequest({ systemPrompt, history }) {
      const timestamp = now();
      const input = measureCelineProviderInput(systemPrompt, history);

      if (input.systemPromptBytes > limits.systemPromptMaxBytes) {
        return { allowed: false, reason: 'system_prompt_bytes', retryAfterSeconds: 0, input };
      }
      if (input.historyChars > limits.historyMaxChars) {
        return { allowed: false, reason: 'history_chars', retryAfterSeconds: 0, input };
      }

      const tokensLastHour = tokensInLastHour(timestamp);
      if (tokensLastHour >= limits.providerTokensPerHour) {
        return {
          allowed: false,
          reason: 'hourly_tokens',
          retryAfterSeconds: 0,
          input,
          tokensLastHour,
        };
      }

      const callLimit = takeRateLimit(
        providerRequests,
        'provider',
        limits.providerCallsPerMinute,
        60_000,
        timestamp
      );
      if (!callLimit.allowed) {
        return {
          allowed: false,
          reason: 'minute_calls',
          retryAfterSeconds: callLimit.retryAfterSeconds,
          input,
          tokensLastHour,
        };
      }

      return {
        allowed: true,
        reason: null,
        retryAfterSeconds: 0,
        input,
        tokensLastHour,
      };
    },

    recordUsage(usage) {
      const totalTokens = nonNegativeInteger(usage?.totalTokens);
      if (totalTokens > 0) tokenEvents.push({ timestamp: now(), totalTokens });
      return tokensInLastHour(now());
    },
  };
}
