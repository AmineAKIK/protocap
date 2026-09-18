import { useEffect, useState } from 'react';

export interface PublicDemoAvailability {
  available: boolean;
  selfServe: boolean;
  url: string | null;
}

const unavailable: PublicDemoAvailability = {
  available: false,
  selfServe: false,
  url: null,
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
    const url = typeof record.url === 'string' && record.url.length > 0 ? record.url : null;
    return {
      available,
      selfServe,
      url: available ? url : null,
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
