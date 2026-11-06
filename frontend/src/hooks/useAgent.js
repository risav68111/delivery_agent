import { useCallback, useEffect, useState } from 'react';
import { getAgent } from '../api/client.js';

export function useAgent(id) {
  const [state, setState] = useState({ status: 'loading', agent: null, error: null, cache: null });
  const [refreshToken, setRefreshToken] = useState(0);

  const refetch = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    if (!id) return undefined;

    const controller = new AbortController();
    setState((current) => ({ ...current, status: 'loading', error: null }));

    getAgent(id, { signal: controller.signal })
      .then((result) => {
        setState({ status: 'success', agent: result.data, error: null, cache: result.cache });
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setState({
          status: error.status === 404 ? 'not-found' : 'error',
          agent: null,
          error,
          cache: null,
        });
      });

    return () => controller.abort();
  }, [id, refreshToken]);

  return { ...state, refetch };
}
