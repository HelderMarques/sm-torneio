import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import StandingsTable from '../components/StandingsTable';

export default function Classificacao() {
  const { group } = useParams();
  const { tournament, slug, tApi } = useTournament();
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  if (group === 'masculino') {
    return <Navigate to={`/t/${slug}/classificacao/feminino`} replace />;
  }

  const groupKey = 'F';

  useEffect(() => {
    setLoading(true);
    tApi.get(`/standings/${groupKey}`)
      .then((res) => setStandings(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">
          🎾 Classificação Geral
        </h1>
        <p className="text-neutral-500 text-sm mt-1">Temporada {tournament?.year}</p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
          </div>
        ) : (
          <StandingsTable standings={standings} />
        )}
      </div>

      {/* Legend */}
      <div className="mt-6 bg-white rounded-2xl border border-neutral-200/80 p-5 text-xs text-neutral-500">
        <p className="font-medium text-neutral-700 mb-2">Legenda</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <span><b>Pts</b> = Pontos Válidos</span>
          <span><b>Ganhos</b> = Total bruto</span>
          <span><b>Perd.</b> = Penalidades uniforme</span>
          <span><b>Desc.</b> = Descarte (a partir 5ª etapa)</span>
          <span><b>SV/SP</b> = Sets Vencidos/Perdidos</span>
          <span><b>SS</b> = Saldo de Sets</span>
          <span><b>GV/GP</b> = Games Vencidos/Perdidos</span>
          <span><b>SG</b> = Saldo de Games</span>
        </div>
      </div>
    </div>
  );
}
