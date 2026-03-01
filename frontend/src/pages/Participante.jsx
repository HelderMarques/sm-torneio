import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

const pointsLabel = {
  100: '1º', 80: '2º/Sorteada', 70: '3º', 60: '4º/Voluntária', 50: '5º', 40: '6º', 30: '7º', 0: 'Ausente',
};

export default function Participante() {
  const { id } = useParams();
  const { tournament, slug, tApi } = useTournament();
  const [participant, setParticipant] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tApi.get(`/participants/${id}`),
      tApi.get(`/participants/${id}/history`),
    ]).then(([pRes, hRes]) => {
      setParticipant(pRes.data);
      setHistory(hRes.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }

  if (!participant) {
    return <div className="text-center py-20 text-neutral-500">Participante não encontrado</div>;
  }

  const totalPoints = history.reduce((sum, r) => sum + r.pointsRaw, 0);
  const roundsPlayed = history.filter((r) => r.present).length;
  const posEmoji = { 1: '🥇', 2: '🥈', 3: '🥉' };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to={`/t/${slug}/classificacao/feminino`} className="text-sm text-neutral-500 hover:text-[#9B2D3E] mb-6 inline-block font-medium">
        ← Voltar para classificação
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-8 mb-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-[#9B2D3E] flex items-center justify-center text-white text-2xl font-semibold">
            {participant.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">{participant.name}</h1>
            <p className="text-neutral-500 mt-0.5">
              Grupo {participant.group === 'F' ? 'Feminino' : 'Masculino'} • Temporada {tournament?.year}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="bg-neutral-50 rounded-xl p-5 text-center">
            <p className="text-2xl font-semibold text-neutral-900">{totalPoints}</p>
            <p className="text-xs text-neutral-500 mt-1">Pontos Totais</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-5 text-center">
            <p className="text-2xl font-semibold text-neutral-900">{roundsPlayed}</p>
            <p className="text-xs text-neutral-500 mt-1">Etapas Jogadas</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-5 text-center">
            <p className="text-2xl font-semibold text-[#9B2D3E]">
              {history.filter((r) => r.position === 1).length}
            </p>
            <p className="text-xs text-neutral-500 mt-1">1ºs Lugares</p>
          </div>
        </div>
      </div>

      {/* Round History */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">Histórico por Etapa</h2>
        </div>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Etapa</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Data</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Posição</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Pontos</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Sets (V-P)</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Games (V-P)</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-3 font-medium text-neutral-900">{r.round.number}ª Etapa</td>
                <td className="px-4 py-3 text-center text-neutral-500">
                  {new Date(r.round.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-center">{r.present && r.position ? (posEmoji[r.position] ? `${posEmoji[r.position]} ${r.position}º` : `${r.position}º`) : '-'}</td>
                <td className="px-4 py-3 text-center font-semibold text-neutral-900">
                  {r.pointsRaw}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.present ? `${r.setsWon}-${r.setsLost}` : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.present ? `${r.gamesWon}-${r.gamesLost}` : '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  {r.present ? (
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg text-xs font-medium">Presente</span>
                  ) : r.absentReason === 'SORTEIO' ? (
                    <span className="bg-amber-50 text-amber-800 px-2 py-1 rounded-lg text-xs font-medium">Sorteada</span>
                  ) : r.absentReason === 'SORTEIO_VOLUNTARIA' ? (
                    <span className="bg-neutral-100 text-neutral-700 px-2 py-1 rounded-lg text-xs font-medium">Voluntária</span>
                  ) : (
                    <span className="bg-red-50 text-red-700 px-2 py-1 rounded-lg text-xs font-medium">Faltou</span>
                  )}
                  {r.uniformPenalty < 0 && (
                    <span className="ml-1 bg-amber-50 text-amber-800 px-2 py-1 rounded-lg text-xs font-medium">-20 uniforme</span>
                  )}
                </td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-neutral-400">
                  Nenhum resultado registrado ainda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
