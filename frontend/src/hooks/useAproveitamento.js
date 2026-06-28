import { useEffect, useState } from 'react';
import { useTournament } from './useTournament';

/**
 * Consulta GET /aproveitamento?group=F do torneio atual.
 * Retorna { data: { partidas, sets, games } | null, loading, error }.
 */
export function useAproveitamento(group = 'F') {
  const { tApi, slug } = useTournament();
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    tApi.get(`/aproveitamento?group=${group}`)
      .then((res) => {
        if (cancelled) return;
        setState({ data: res.data, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err });
      });
    return () => { cancelled = true; };
  }, [slug, group]);

  return state;
}
