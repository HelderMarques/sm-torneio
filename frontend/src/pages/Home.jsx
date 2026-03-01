import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import StandingsTable from '../components/StandingsTable';

export default function Home() {
  const { tournament, slug, tApi } = useTournament();
  const [standings, setStandings] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [lastRoundPodium, setLastRoundPodium] = useState(null); // { roundNumber, date, 1: [names], 2: [names], 3: [names] }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tApi.get('/standings/F'),
      tApi.get('/rounds?group=F'),
    ])
      .then(([standingsRes, roundsRes]) => {
        setStandings(standingsRes.data);
        const roundsList = roundsRes.data || [];
        setRounds(roundsList);

        const completed = roundsList.filter((r) => r.status === 'COMPLETED');
        const lastCompleted = completed.length ? completed[completed.length - 1] : null;
        if (lastCompleted) {
          tApi.get(`/rounds/${lastCompleted.id}`)
            .then((roundRes) => {
              const round = roundRes.data;
              const results = (round.results || []).filter((r) => r.present && r.position);
              const byPos = { 1: [], 2: [], 3: [] };
              results.forEach((r) => {
                if (r.position >= 1 && r.position <= 3) {
                  const name = r.participant?.name || '';
                  if (name) byPos[r.position].push(name);
                }
              });
              setLastRoundPodium({
                roundNumber: round.number,
                date: round.date,
                positions: byPos,
              });
            })
            .catch(() => setLastRoundPodium(null));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const nextRound = rounds.find((r) => r.status === 'SCHEDULED');

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Próxima etapa — sem repetir título do header */}
      {nextRound && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-neutral-500 text-sm">🎾 Próxima etapa</span>
          <span className="font-medium text-neutral-900">
            {nextRound.number}ª Etapa — {new Date(nextRound.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
          </span>
        </div>
      )}

      {/* Pódio da última etapa (após 1ª rodada) */}
      {lastRoundPodium && (
        <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
            Última etapa — {lastRoundPodium.roundNumber}ª ({new Date(lastRoundPodium.date + 'T12:00:00').toLocaleDateString('pt-BR')})
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {[1, 2, 3].map((pos) => {
              const names = lastRoundPodium.positions[pos] || [];
              const emoji = { 1: '🥇', 2: '🥈', 3: '🥉' }[pos];
              if (names.length === 0) return null;
              return (
                <span key={pos} className="text-neutral-700">
                  <strong className="text-neutral-900">{emoji} {pos}º:</strong> {names.join(' e ')}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Ranking completo em destaque */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mb-8">
        <div className="p-5 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900">🎾 Classificação</h2>
        </div>
        <StandingsTable standings={standings} showDetails={true} />
      </div>

      {/* Calendário e Regulamento com menos destaque */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 border-t border-neutral-100 pt-6">
        <Link to={`/t/${slug}/calendario`} className="hover:text-neutral-700">
          Calendário
        </Link>
        <span className="text-neutral-300">·</span>
        <Link to={`/t/${slug}/regulamento`} className="hover:text-neutral-700">
          Regulamento
        </Link>
      </div>
    </div>
  );
}
