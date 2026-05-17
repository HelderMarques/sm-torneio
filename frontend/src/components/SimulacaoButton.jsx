import { Link } from 'react-router-dom';
import { useSimulationAvailability } from '../hooks/useSimulationAvailability';
import { useTournament } from '../hooks/useTournament';

export default function SimulacaoButton({ group = 'F' }) {
  const { slug } = useTournament();
  const { loading, available } = useSimulationAvailability(group);

  if (loading || !available) return null;

  return (
    <Link
      to={`/t/${slug}/simular`}
      className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-rose-700 transition-colors"
    >
      🎯 Simular Etapa
    </Link>
  );
}
