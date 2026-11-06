import { useCallback, useEffect, useRef, useState } from 'react';
import { listAgents } from '../api/client.js';

/**
 * Fetches the agent list for the given filters. Aborts stale requests so fast
 * filter changes can never render an older response on top of a newer one.
 */
export function useAgentsQuery(filters) {
  const [state, setState] = useState({
    status: 'loading',
    items: [],
    meta: null,
    error: null,
    cache: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const sequence = useRef(0);

  const refetch = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = (sequence.current += 1);

    setState((current) => ({
      ...current,
      status: current.meta ? 'refreshing' : 'loading',
      error: null,
    }));

    listAgents(filters, { signal: controller.signal })
      .then((result) => {
        if (requestId !== sequence.current) return;
        setState({
          status: 'success',
          items: result.data ?? [],
          meta: result.meta,
          error: null,
          cache: result.cache,
        });
      })
      .catch((error) => {
        if (error.name === 'AbortError' || requestId !== sequence.current) return;
        setState({ status: 'error', items: [], meta: null, error, cache: null });
      });

    return () => controller.abort();
  }, [filters, refreshToken]);

  return { ...state, refetch };
}
