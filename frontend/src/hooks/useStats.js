import { useEffect, useState } from 'react';
import { getStats } from '../api/client.js';

export function useStats(refreshToken = 0) {
  const [state, setState] = useState({ stats: null, loading: true, error: null });

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true }));

    getStats({ signal: controller.signal })
      .then((result) => {
        setState({ stats: result.data, loading: false, error: null });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({ stats: null, loading: false, error });
      });

    return () => controller.abort();
  }, [refreshToken]);

  return state;
}
