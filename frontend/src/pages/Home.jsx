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
              // Group by position, then by pairId; track courtLabel
              const byPos = { 1: [], 2: [], 3: [] };
              results.forEach((r) => {
                if (r.position >= 1 && r.position <= 3) {
                  const name = r.participant?.name || '';
                  if (!name) return;
                  if (r.pairId) {
                    const existing = byPos[r.position].find((p) => p.pairId === r.pairId);
                    if (existing) {
                      existing.names.push(name);
                    } else {
                      byPos[r.position].push({ pairId: r.pairId, names: [name], courtLabel: r.courtLabel || null });
                    }
                  } else {
                    byPos[r.position].push({ pairId: null, names: [name], courtLabel: r.courtLabel || null });
                  }
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
          <Link
            to={`/t/${slug}/simular`}
            className="text-xs font-medium text-[#9B2D3E] hover:text-[#8B2942] bg-[#9B2D3E]/5 px-3 py-1.5 rounded-full"
          >
            Simular etapa →
          </Link>
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
              const pairs = lastRoundPodium.positions[pos] || [];
              const emoji = { 1: '🥇', 2: '🥈', 3: '🥉' }[pos];
              if (pairs.length === 0) return null;
              const hasCourts = pairs.some((p) => p.courtLabel);
              return (
                <span key={pos} className="text-neutral-700">
                  <strong className="text-neutral-900">{emoji} {pos}º:</strong>{' '}
                  {hasCourts
                    ? pairs.map((p) => (
                        <span key={p.pairId || p.names[0]}>
                          <span className="text-neutral-400 text-xs">{p.courtLabel}: </span>
                          {p.names.join(' e ')}
                        </span>
                      )).reduce((acc, el, i) => i === 0 ? [el] : [...acc, <span key={`sep-${i}`} className="text-neutral-300 mx-1">|</span>, el], [])
                    : pairs.map((p) => p.names.join(' e ')).join(' · ')
                  }
                </span>
              );
            })}
          </div>
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
