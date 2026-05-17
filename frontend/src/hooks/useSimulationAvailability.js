import { useEffect, useState } from 'react';
import { useTournament } from './useTournament';

/**
 * Consulta GET /simulacao/availability para o torneio atual.
 */
export function useSimulationAvailability(group = 'F') {
  const { tApi, slug } = useTournament();
  const [state, setState] = useState({ loading: true, available: false, reason: null, etapa: null });

  useEffect(() => {
    let cancelled = false;
    setState({ loading: true, available: false, reason: null, etapa: null });
    tApi.get(`/simulacao/availability?group=${group}`)
      .then((res) => {
        if (cancelled) return;
        setState({
          loading: false,
          available: !!res.data.available,
          reason: res.data.reason || null,
          etapa: res.data.etapa || null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ loading: false, available: false, reason: 'erro', etapa: null });
      });
    return () => { cancelled = true; };
  }, [slug, group]);

  return state;
}
