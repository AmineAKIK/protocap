export class CelineProviderError extends Error {
  constructor(code, message, options = {}) {
    super(message, options);
    this.name = 'CelineProviderError';
    this.code = code;
  }
}

export function createDeepSeekProvider({
  apiKey,
  fetchImpl = fetch,
  timeoutMs = 45_000,
  model = 'deepseek-v4-flash',
  maxTokens = 4_000,
} = {}) {
  if (!apiKey) return null;

  return {
    async complete({ systemPrompt, history, signal = null }) {
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
        if (signal?.aborted) {
          throw new CelineProviderError('cancelled', 'DeepSeek request cancelled because the client disconnected.', { cause: error });
        }
        if (timeoutSignal.aborted) {
          throw new CelineProviderError('timeout', 'DeepSeek request timed out.', { cause: error });
        }
        throw new CelineProviderError('unavailable', 'DeepSeek request failed.', { cause: error });
      }

      if (!upstream.ok) {
        if (upstream.status === 429) {
          throw new CelineProviderError('rate_limited', 'DeepSeek rate limited the request.');
        }
        throw new CelineProviderError('unavailable', `DeepSeek returned ${upstream.status}.`);
      }

      let payload;
      try {
        payload = await upstream.json();
      } catch (error) {
        throw new CelineProviderError('invalid_response', 'DeepSeek returned invalid JSON.', { cause: error });
      }

      const content = payload?.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw new CelineProviderError('invalid_response', 'DeepSeek response content is missing.');
      }

      return content;
    },
  };
}
