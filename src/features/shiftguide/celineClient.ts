import { isCelineResponse } from '../../../shared/celineContract.js';
import type { SharedCelineResponse } from '../../../shared/celineContract.js';
import { getShiftGuideToken, lockShiftGuide } from '../../hooks/useShiftGuideAuth';

export interface CelineApiMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getLatestUserMessage(history: CelineApiMessage[]): CelineApiMessage | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const message = history[index];
    if (message?.role === 'user' && message.content.length > 0) return message;
  }
  return null;
}

export async function requestCelineResponse(
  history: CelineApiMessage[],
  signal: AbortSignal
): Promise<SharedCelineResponse> {
  const token = getShiftGuideToken();
  if (!token) {
    throw new Error('Session ShiftGuide expirée. Recharge la page pour te reconnecter.');
  }

  const latestUserMessage = getLatestUserMessage(history);
  if (!latestUserMessage) {
    throw new Error('Requête IA invalide.');
  }

  const response = await fetch('/api/celine/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages: [latestUserMessage] }),
    signal,
  });

  if (!response.ok) {
    let errorMessage = `Erreur ${response.status}`;
    try {
      const body: unknown = await response.json();
      if (
        body &&
        typeof body === 'object' &&
        'error' in body &&
        typeof body.error === 'string'
      ) {
        errorMessage = body.error;
      }
    } catch {
      // Preserve the HTTP fallback when the error body is not JSON.
    }

    if (response.status === 401) {
      lockShiftGuide();
      throw new Error('Session ShiftGuide expirée. Recharge la page pour te reconnecter.');
    }

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      if (retryAfter && /^\d+$/.test(retryAfter)) {
        throw new Error(`${errorMessage} Délai conseillé : ${retryAfter} s.`);
      }
    }

    throw new Error(errorMessage);
  }

  const payload: unknown = await response.json();
  if (!isCelineResponse(payload)) {
    throw new Error('Réponse IA invalide.');
  }
  return payload;
}
