import { useEffect, useState } from 'react';
import { useTournament } from './useTournament';

/** GET /chances?group=F do torneio atual. { data, loading, error }.
 *  `enabled=false` não busca (usado para pular o Masculino por enquanto). */
export function useChances(group = 'F', enabled = true) {
  const { tApi, slug } = useTournament();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    tApi.get(`/chances?group=${group}`)
      .then((res) => { if (!cancelled) setState({ data: res.data, loading: false, error: null }); })
      .catch((err) => { if (!cancelled) setState({ data: null, loading: false, error: err }); });
    return () => { cancelled = true; };
  }, [slug, group, enabled]);

  return state;
}
