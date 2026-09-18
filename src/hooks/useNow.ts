import { useEffect, useState } from 'react';

export const NOW_REFRESH_INTERVAL_MS = 1000;

export function useNow(intervalMs = NOW_REFRESH_INTERVAL_MS) {
  const delay = Number.isFinite(intervalMs) && intervalMs > 0 ? intervalMs : NOW_REFRESH_INTERVAL_MS;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    const id = window.setInterval(refresh, delay);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [delay]);

  return now;
}
