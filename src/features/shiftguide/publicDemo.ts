import { useEffect, useState } from 'react';

export interface PublicDemoAvailability {
  available: boolean;
  selfServe: boolean;
  entryUrl: string | null;
}

const unavailable: PublicDemoAvailability = {
  available: false,
  selfServe: false,
  entryUrl: null,
};

export async function fetchPublicDemoAvailability(): Promise<PublicDemoAvailability> {
  try {
    const response = await fetch('/api/public-demo', { method: 'GET' });
    if (!response.ok) return unavailable;
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') return unavailable;
    const record = payload as Record<string, unknown>;
    const available = record.available === true;
    const selfServe = record.selfServe === true;
    const entryUrl = typeof record.entryUrl === 'string' && record.entryUrl.length > 0
      ? record.entryUrl
      : null;
    return {
      available,
      selfServe,
      entryUrl: available ? entryUrl : null,
    };
  } catch {
    return unavailable;
  }
}

export function usePublicDemoAvailability() {
  const [state, setState] = useState<PublicDemoAvailability>(unavailable);

  useEffect(() => {
    let active = true;
    void fetchPublicDemoAvailability().then((result) => {
      if (active) setState(result);
    });
    return () => { active = false; };
  }, []);

  return state;
}
