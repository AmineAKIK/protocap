import { getShiftGuideToken } from './hooks/useShiftGuideAuth';

const DEEPSEEK_CHAT_URL = 'https://api.deepseek.com/chat/completions';
const nativeFetch = window.fetch.bind(window);

function errorResponse(message: string, status = 503): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function installDeepSeekProxy(): void {
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (typeof input !== 'string' || input !== DEEPSEEK_CHAT_URL) {
      return nativeFetch(input, init);
    }

    const token = getShiftGuideToken();
    if (!token) {
      return errorResponse('Session ShiftGuide expirée. Recharge la page pour te reconnecter.');
    }

    const response = await nativeFetch('/api/celine/chat', {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok) return response;

    let message = `Erreur ${response.status}`;
    try {
      const payload = await response.clone().json();
      if (typeof payload?.error === 'string') message = payload.error;
    } catch {
      // Keep the generic status message.
    }

    // CelinePage historically interprets HTTP 401 as an invalid DeepSeek key.
    // Normalize an expired ShiftGuide session to a generic service error so the
    // user sees the server-provided session message instead.
    const status = response.status === 401 ? 503 : response.status;
    return errorResponse(message, status);
  };
}
