import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function EtapaPublic() {
  const { id } = useParams();
  const { slug, tApi } = useTournament();
  const [round, setRound] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tApi.get(`/rounds/${id}`),
      tApi.get(`/rounds/${id}/matches`),
    ])
      .then(([roundRes, matchesRes]) => {
        setRound(roundRes.data);
        setMatches(matchesRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  if (loading) return <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"/></div>;
  if (!round) return <div className="text-center py-20 text-neutral-500">Etapa não encontrada</div>;

  // Build courts data from results
  const presentResults = (round.results || []).filter(r => r.present && r.position);

  // Group by court, then by pairId
  const courtsMap = {};
  for (const r of presentResults) {
    const court = r.courtLabel || '—';
    if (!courtsMap[court]) courtsMap[court] = {};
    if (r.pairId) {
      if (!courtsMap[court][r.pairId]) {
        courtsMap[court][r.pairId] = {
          pairId: r.pairId,
          position: r.position,
          names: [],
          points: r.pointsRaw,
        };
      }
      const pair = courtsMap[court][r.pairId];
      if (r.participant?.name) {
        if (pair.names.length === 0) {
          // First player - take stats from them
          pair.setsWon = r.setsWon || 0;
          pair.setsLost = r.setsLost || 0;
          pair.gamesWon = r.gamesWon || 0;
          pair.gamesLost = r.gamesLost || 0;
          pair.points = r.pointsRaw;
        }
        pair.names.push(r.participant.name);
      }
    }
  }

  // Also handle absent participants
  const absentResults = (round.results || []).filter(r => !r.present);

  const courts = Object.entries(courtsMap).map(([courtLabel, pairsObj]) => ({
    courtLabel,
    pairs: Object.values(pairsObj).sort((a, b) => (a.position || 99) - (b.position || 99)),
  }));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Link to={`/t/${slug}/calendario`} className="text-sm text-neutral-500 hover:text-[#9B2D3E] mb-6 inline-block font-medium">
        ← Calendário
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
          {round.number}ª Etapa — {round.group === 'F' ? 'Feminino' : 'Masculino'}
        </h1>
        <p className="text-neutral-500 mt-1">
          {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Courts */}
      <div className="space-y-8">
        {courts.map(({ courtLabel, pairs }) => {
          const courtMatches = matches.filter(m => m.courtLabel === courtLabel);
          const top3 = pairs.filter(p => p.position <= 3);

          return (
            <div key={courtLabel} className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
              {/* Court header */}
              <div className="px-5 py-4 bg-neutral-50 border-b border-neutral-100">
                <h2 className="font-bold text-neutral-800 uppercase tracking-wide text-sm">{courtLabel}</h2>
              </div>

              {/* Podium */}
              {top3.length > 0 && (
                <div className="px-5 py-4 border-b border-neutral-100">
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                    {top3.map(p => (
                      <span key={p.pairId} className="flex items-center gap-1.5">
                        <span>{MEDAL[p.position] || `${p.position}º`}</span>
                        <span className="font-semibold text-neutral-900">{p.names.join(' / ')}</span>
                        <span className="text-neutral-400 text-xs">{p.points} pts</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full pairs table */}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">Pos.</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-400 uppercase tracking-wide">Dupla</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-neutral-400 uppercase tracking-wide">Pts</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-neutral-400 uppercase tracking-wide">Sets</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-neutral-400 uppercase tracking-wide">Games</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {pairs.map(p => (
                      <tr key={p.pairId} className={p.position <= 3 ? 'bg-amber-50/20' : ''}>
                        <td className="px-4 py-3 font-semibold text-neutral-700">
                          {MEDAL[p.position] || `${p.position}º`}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-medium text-neutral-900">{p.names.join(' / ')}</span>
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-neutral-800">{p.points}</td>
                        <td className="px-4 py-3 text-center text-neutral-600">{p.setsWon}–{p.setsLost}</td>
                        <td className="px-4 py-3 text-center text-neutral-600">{p.gamesWon}–{p.gamesLost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Game results */}
              {courtMatches.length > 0 && (
                <div className="px-5 py-4 border-t border-neutral-100">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">Jogos</p>
                  <div className="space-y-1.5">
                    {courtMatches.map((m, i) => {
                      const aWon = m.scoreA > m.scoreB;
                      return (
                        <div key={m.id || i} className="flex items-center gap-2 text-sm">
                          <span className={`font-medium ${aWon ? 'text-neutral-900' : 'text-neutral-500'}`}>
                            {m.pairANames.join(' / ')}
                          </span>
                          <span className={`font-bold tabular-nums ${aWon ? 'text-emerald-600' : 'text-red-500'}`}>{m.scoreA}</span>
                          <span className="text-neutral-300 text-xs">×</span>
                          <span className={`font-bold tabular-nums ${!aWon ? 'text-emerald-600' : 'text-red-500'}`}>{m.scoreB}</span>
                          <span className={`font-medium ${!aWon ? 'text-neutral-900' : 'text-neutral-500'}`}>
                            {m.pairBNames.join(' / ')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Absent participants */}
      {absentResults.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-500">Ausências</h3>
          </div>
          <div className="divide-y divide-neutral-50">
            {absentResults.map(r => (
              <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                <Link to={`/t/${slug}/participante/${r.participantId}`} className="text-sm font-medium text-neutral-700 hover:text-[#9B2D3E]">
                  {r.participant?.name || r.participantId}
                </Link>
                <span className="text-xs text-neutral-400">
                  {r.absentReason === 'SORTEIO' ? 'Sorteado' : r.absentReason === 'SORTEIO_VOLUNTARIA' ? 'Voluntário' : 'Faltou'}
                  {' · '}{r.pointsRaw} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
