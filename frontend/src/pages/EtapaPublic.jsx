import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

export default function EtapaPublic() {
  const { id } = useParams();
  const { slug, tApi } = useTournament();
  const [round, setRound] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tApi.get(`/rounds/${id}`)
      .then((res) => setRound(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }

  if (!round) {
    return <div className="text-center py-20 text-neutral-500">Etapa não encontrada</div>;
  }

  const posEmoji = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const sortedResults = [...(round.results || [])].sort((a, b) => {
    if (a.present && !b.present) return -1;
    if (!a.present && b.present) return 1;
    if (a.present && b.present) return (a.position || 99) - (b.position || 99);
    return 0;
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link to={`/t/${slug}/calendario`} className="text-sm text-neutral-500 hover:text-[#9B2D3E] mb-6 inline-block font-medium">
        ← Voltar ao calendário
      </Link>

      <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight mb-1">
        {round.number}ª Etapa — {round.group === 'F' ? 'Feminino' : 'Masculino'}
      </h1>
      <p className="text-neutral-500 mb-8">
        {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
      </p>

      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-neutral-200">
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Pos.</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Nome</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Pontos</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Sets</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Games</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                <td className="px-4 py-3 text-center font-semibold">
                  {r.present && r.position ? (posEmoji[r.position] ? `${posEmoji[r.position]} ${r.position}º` : `${r.position}º`) : '-'}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/t/${slug}/participante/${r.participantId}`} className="text-neutral-900 hover:text-[#9B2D3E] font-medium">
                    {r.participant?.name || r.participantId}
                  </Link>
                </td>
                <td className="px-4 py-3 text-center font-semibold text-neutral-900">{r.pointsRaw}</td>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
