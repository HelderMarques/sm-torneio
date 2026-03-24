import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import StandingsTable from '../components/StandingsTable';

const GROUPS = [
  { key: 'F', label: 'Feminino' },
  { key: 'M', label: 'Masculino' },
];

export default function Home() {
  const { tournament, slug, tApi } = useTournament();
  const [group, setGroup] = useState('F');
  const [standings, setStandings] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [lastRoundPodium, setLastRoundPodium] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setLastRoundPodium(null);
    Promise.all([
      tApi.get(`/standings/${group}`),
      tApi.get(`/rounds?group=${group}`),
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
              // Build courts map: { courtLabel -> { position -> [pairEntry] } }
              const courtsMap = {};
              results.forEach((r) => {
                const court = r.courtLabel || '—';
                if (!courtsMap[court]) courtsMap[court] = {};
                const pos = r.position;
                if (!courtsMap[court][pos]) courtsMap[court][pos] = [];
                const name = r.participant?.name || '';
                if (!name) return;
                if (r.pairId) {
                  const existing = courtsMap[court][pos].find((p) => p.pairId === r.pairId);
                  if (existing) existing.names.push(name);
                  else courtsMap[court][pos].push({ pairId: r.pairId, names: [name] });
                } else {
                  courtsMap[court][pos].push({ pairId: null, names: [name] });
                }
              });
              // Convert to sorted array of courts
              const courts = Object.entries(courtsMap).map(([courtLabel, positions]) => ({
                courtLabel,
                positions,
              }));
              setLastRoundPodium({
                roundNumber: round.number,
                date: round.date,
                courts,
              });
            })
            .catch(() => setLastRoundPodium(null));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug, group]);

  const today = new Date().toISOString().slice(0, 10);
  const nextRound = rounds.find((r) => r.status === 'SCHEDULED' && r.date >= today);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Próxima etapa — sem repetir título do header */}
      {nextRound && (
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500 text-sm">🎾 Próxima etapa</span>
            <span className="font-medium text-neutral-900">
              {nextRound.number}ª Etapa —{' '}
              {new Date(nextRound.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
              })}
            </span>
          </div>
          {tournament?.simulateEnabled && (
            <Link
              to={`/t/${slug}/simular`}
              className="text-xs font-medium text-[#9B2D3E] hover:text-[#8B2942] bg-[#9B2D3E]/5 px-3 py-1.5 rounded-full"
            >
              Simular etapa →
            </Link>
          )}
        </div>
      )}

      {/* Pódio da última etapa — 1 box se quadra única, 1 box por quadra se múltiplas */}
      {lastRoundPodium && (
        <div className="mb-6 flex flex-col gap-3">
          {lastRoundPodium.courts.map(({ courtLabel, positions }) => {
            const multiCourt = lastRoundPodium.courts.length > 1;
            const dateStr = new Date(lastRoundPodium.date + 'T12:00:00').toLocaleDateString('pt-BR');
            return (
              <div key={courtLabel} className="p-4 bg-neutral-50 rounded-xl border border-neutral-200/80">
                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                  {multiCourt
                    ? `Última etapa | ${courtLabel} — ${lastRoundPodium.roundNumber}ª (${dateStr})`
                    : `Última etapa — ${lastRoundPodium.roundNumber}ª (${dateStr})`}
                </p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                  {[1, 2, 3].map((pos) => {
                    const pairs = positions[pos] || [];
                    const emoji = { 1: '🥇', 2: '🥈', 3: '🥉' }[pos];
                    if (pairs.length === 0) return null;
                    return (
                      <span key={pos} className="text-neutral-700">
                        <strong className="text-neutral-900">{emoji} {pos}º:</strong>{' '}
                        {pairs.map((p) => p.names.join(' e ')).join(' · ')}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranking completo em destaque */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mb-8">
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-lg font-semibold text-neutral-900">🎾 Classificação</h2>
          <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setGroup(g.key)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  group === g.key
                    ? 'bg-white text-neutral-900 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500" />
          </div>
        ) : (
          <StandingsTable standings={standings} showDetails={true} />
        )}
      </div>

      {/* Links de apoio */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-neutral-500 border-t border-neutral-100 pt-6">
        <Link to={`/t/${slug}/calendario`} className="hover:text-neutral-700">
          Calendário
        </Link>
        <span className="text-neutral-300">·</span>
        <Link to={`/t/${slug}/regulamento`} className="hover:text-neutral-700">
          Regulamento
        </Link>
        <span className="text-neutral-300 hidden sm:inline">·</span>
        <a
          href="/api/docs"
          target="_blank"
          rel="noreferrer"
          className="hover:text-neutral-700"
        >
          API docs
        </a>
      </div>
    </div>
  );
}
