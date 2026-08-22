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
  model = 'deepseek-chat',
} = {}) {
  if (!apiKey) return null;

  return {
    async complete({ systemPrompt, history }) {
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
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        if (error instanceof Error && error.name === 'TimeoutError') {
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
