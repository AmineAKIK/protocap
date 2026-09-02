import {
  createCelineProviderCostGuard,
  DEFAULT_CELINE_COST_LIMITS,
} from '../celineCostGuard.mjs';
import { isConfiguredSecret } from '../security.mjs';

export class CelineProviderError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'CelineProviderError';
    this.code = code;
    this.upstreamStatus = Number.isInteger(options.upstreamStatus)
      ? options.upstreamStatus
      : null;
  }
}

function getAbortProviderError(signal, timeoutSignal, cause) {
  if (signal?.aborted) {
    return new CelineProviderError(
      'cancelled',
      'DeepSeek request cancelled because the client disconnected.',
      { cause }
    );
  }
  if (timeoutSignal.aborted) {
    return new CelineProviderError('timeout', 'DeepSeek request timed out.', { cause });
  }
  return null;
}

function integerOrZero(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  return {
    promptTokens: integerOrZero(usage.prompt_tokens),
    completionTokens: integerOrZero(usage.completion_tokens),
    totalTokens: integerOrZero(usage.total_tokens),
    promptCacheHitTokens: integerOrZero(usage.prompt_cache_hit_tokens),
    promptCacheMissTokens: integerOrZero(usage.prompt_cache_miss_tokens),
  };
}

export function createDeepSeekProvider({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 45_000,
  model = 'deepseek-v4-flash',
  maxTokens = 160,
  costLimits = DEFAULT_CELINE_COST_LIMITS,
  costNow = () => Date.now(),
} = {}) {
  if (!isConfiguredSecret(apiKey)) return null;
  const costGuard = createCelineProviderCostGuard({ limits: costLimits, now: costNow });

  return {
    model,
    async complete({ systemPrompt, history, signal = null }) {
      const budget = costGuard.beforeRequest({ systemPrompt, history });
      if (!budget.allowed) {
        const isRateLimit = budget.reason === 'minute_calls' || budget.reason === 'hourly_tokens';
        throw new CelineProviderError(
          isRateLimit ? 'rate_limited' : 'budget_exceeded',
          `Celine provider cost guard blocked request (${budget.reason}).`
        );
      }

      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const requestSignal = signal
        ? AbortSignal.any([signal, timeoutSignal])
        : timeoutSignal;

      let upstream;
      try {
        upstream = await fetchImpl('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }, ...history],
            thinking: { type: 'disabled' },
            temperature: 0.2,
            max_tokens: maxTokens,
            response_format: { type: 'json_object' },
          }),
          signal: requestSignal,
        });
      } catch (error) {
        const abortError = getAbortProviderError(signal, timeoutSignal, error);
        if (abortError) throw abortError;
        throw new CelineProviderError('unavailable', 'DeepSeek request failed.', { cause: error });
      }

      if (!upstream.ok) {
        if (upstream.status === 429) {
          throw new CelineProviderError(
            'rate_limited',
            'DeepSeek rate limited the request.',
            { upstreamStatus: upstream.status }
          );
        }
        throw new CelineProviderError(
          'unavailable',
          `DeepSeek returned ${upstream.status}.`,
          { upstreamStatus: upstream.status }
        );
      }

      let payload;
      try {
        payload = await upstream.json();
      } catch (error) {
        const abortError = getAbortProviderError(signal, timeoutSignal, error);
        if (abortError) throw abortError;
        throw new CelineProviderError('invalid_response', 'DeepSeek returned invalid JSON.', {
          cause: error,
          upstreamStatus: upstream.status,
        });
      }

      const abortError = getAbortProviderError(signal, timeoutSignal);
      if (abortError) throw abortError;

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new CelineProviderError(
          'invalid_response',
          'DeepSeek response content is missing.',
          { upstreamStatus: upstream.status }
        );
      }

      const usage = normalizeUsage(payload?.usage);
      const tokensLastHour = costGuard.recordUsage(usage);
      return {
        content,
        model,
        usage: usage
          ? {
              ...usage,
              systemPromptBytes: budget.input.systemPromptBytes,
              historyMessages: budget.input.historyMessages,
              historyChars: budget.input.historyChars,
              tokensLastHour,
            }
          : null,
        finishReason: typeof payload?.choices?.[0]?.finish_reason === 'string'
          ? payload.choices[0].finish_reason
          : null,
      };
    },
  };
}
