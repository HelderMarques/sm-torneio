import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

/* ─── helpers ───────────────────────────────────────────────── */
function initials(name) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

function posBadgeCls(pos, present) {
  if (!present) return 'bg-neutral-100 text-neutral-400';
  if (pos === 1) return 'bg-amber-100 text-amber-700';
  if (pos === 2) return 'bg-neutral-200 text-neutral-600';
  if (pos === 3) return 'bg-orange-100 text-orange-700';
  return 'bg-neutral-100 text-neutral-500';
}

/* ─── Skeleton ───────────────────────────────────────────────── */
function Skeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-pulse">
      <div className="h-4 w-24 bg-neutral-200 rounded mb-6" />
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-5">
        <div className="flex items-center gap-4 mb-5">
          <div className="w-20 h-20 rounded-2xl bg-neutral-200" />
          <div className="space-y-2">
            <div className="h-6 w-40 bg-neutral-200 rounded" />
            <div className="h-4 w-28 bg-neutral-100 rounded" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-neutral-100 rounded-xl" />)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-24 bg-neutral-100 rounded-xl" />)}
      </div>
    </div>
  );
}

/* ─── Ranking Evolution Chart (SVG) ─────────────────────────── */
function RankingChart({ history }) {
  const points = [...history]
    .filter((r) => r.present && r.position != null)
    .sort((a, b) => a.round.number - b.round.number);

  if (points.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-neutral-400">
        <span className="text-3xl">📊</span>
        <p className="text-sm">Sem dados de evolução ainda</p>
      </div>
    );
  }

  const W = 500, H = 110, pX = 28, pY = 20;
  const iW = W - pX * 2;
  const iH = H - pY * 2 - 16; // bottom 16px for round labels
  const maxPos = 7;
  const n = points.length;

  const cx = (i) => (n === 1 ? W / 2 : pX + (i / (n - 1)) * iW);
  const cy = (pos) => pY + ((pos - 1) / (maxPos - 1)) * iH;

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${cx(i)},${cy(p.position)}`).join(' ');
  const areaPath = n > 1
    ? `${linePath} L${cx(n - 1)},${pY + iH} L${cx(0)},${pY + iH}Z`
    : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: '100px' }}>
      {/* Grid lines */}
      {[1, 3, 5, 7].map((pos) => (
        <g key={pos}>
          <line x1={pX} y1={cy(pos)} x2={W - pX} y2={cy(pos)} stroke="#f3f4f6" strokeWidth="1" />
          <text x={pX - 4} y={cy(pos) + 3} textAnchor="end" fontSize="8" fill="#d1d5db">{pos}º</text>
        </g>
      ))}
      {/* Area */}
      {areaPath && <path d={areaPath} fill="rgba(155,45,62,0.07)" />}
      {/* Line */}
      {n > 1 && (
        <path d={linePath} stroke="#9B2D3E" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {/* Dots + labels */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={cx(i)} cy={cy(p.position)} r="6" fill="white" stroke="#9B2D3E" strokeWidth="2.5" />
          <text x={cx(i)} y={cy(p.position) + 3.5} textAnchor="middle" fontSize="7.5" fill="#9B2D3E" fontWeight="700">
            {p.position}
          </text>
          <text x={cx(i)} y={H - 2} textAnchor="middle" fontSize="8.5" fill="#9ca3af">
            {p.round.number}ª
          </text>
        </g>
      ))}
    </svg>
  );
}

/* ─── Comparison Bar ─────────────────────────────────────────── */
function CompareBar({ label, athleteVal, avgVal, displayAthlete, displayAvg, max }) {
  const safe = (v) => Math.max(0, v);
  const athletePct = Math.min(Math.round((safe(athleteVal) / Math.max(safe(max), 1)) * 100), 100);
  const avgPct = Math.min(Math.round((safe(avgVal) / Math.max(safe(max), 1)) * 100), 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="font-medium text-neutral-600">{label}</span>
        <div className="flex gap-4">
          <span className="text-[#9B2D3E] font-semibold">{displayAthlete}</span>
          <span className="text-neutral-400">média {displayAvg}</span>
        </div>
      </div>
      <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-neutral-200 rounded-full transition-all" style={{ width: `${avgPct}%` }} />
        <div className="absolute inset-y-0 left-0 bg-[#9B2D3E] rounded-full opacity-80 transition-all" style={{ width: `${athletePct}%` }} />
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function Participante() {
  const { id } = useParams();
  const { tournament, slug, tApi } = useTournament();
  const [participant, setParticipant] = useState(null);
  const [history, setHistory] = useState([]);
  const [standings, setStandings] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    tApi
      .get(`/participants/${id}`)
      .then((pRes) => {
        const p = pRes.data;
        setParticipant(p);
        return Promise.all([
          tApi.get(`/participants/${id}/history`),
          tApi.get(`/standings/${p.group}`),
          tApi.get(`/participants/${id}/matches`),
        ]);
      })
      .then(([hRes, sRes, mRes]) => {
        setHistory(hRes.data || []);
        setStandings(sRes.data || []);
        setMatchHistory(mRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  if (loading) return <Skeleton />;
  if (!participant) {
    return <div className="text-center py-20 text-neutral-500">Participante não encontrado</div>;
  }

  /* ── derived data ───────────────────────────────────────────── */
  const myStanding = standings.find((s) => s.participantId === id);
  const currentPosition = myStanding?.position ?? null;
  const pointsValid = myStanding?.pointsValid ?? 0;

  const sortedHistory = [...history].sort((a, b) => a.round.number - b.round.number);
  const presentHistory = sortedHistory.filter((r) => r.present);
  const completedHistory = presentHistory.filter((r) => r.position != null);

  const totalSetsWon = presentHistory.reduce((s, r) => s + (r.setsWon || 0), 0);
  const totalSetsLost = presentHistory.reduce((s, r) => s + (r.setsLost || 0), 0);
  const totalGamesWon = presentHistory.reduce((s, r) => s + (r.gamesWon || 0), 0);
  const totalGamesLost = presentHistory.reduce((s, r) => s + (r.gamesLost || 0), 0);
  const saldoSets = totalSetsWon - totalSetsLost;
  const saldoGames = totalGamesWon - totalGamesLost;
  const totalJogos = totalSetsWon + totalSetsLost;
  const aproveitamento = totalJogos > 0 ? Math.round((totalSetsWon / totalJogos) * 100) : 0;
  const aprovGames = (totalGamesWon + totalGamesLost) > 0
    ? Math.round((totalGamesWon / (totalGamesWon + totalGamesLost)) * 100)
    : 0;

  const avgPointsPerRound = presentHistory.length > 0
    ? (pointsValid / presentHistory.length).toFixed(1)
    : '—';

  const positions = completedHistory.map((r) => r.position);
  const bestPos = positions.length > 0 ? Math.min(...positions) : null;
  const worstPos = positions.length > 0 ? Math.max(...positions) : null;

  const firstPlaces = myStanding?.firstPlaces ?? 0;
  const secondPlaces = myStanding?.secondPlaces ?? 0;
  const thirdPlaces = myStanding?.thirdPlaces ?? 0;
  const podiumCount = firstPlaces + secondPlaces + thirdPlaces;

  // Max streak of top-2 finishes
  let maxStreak = 0, curStreak = 0;
  for (const r of completedHistory) {
    if (r.position <= 2) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
    else curStreak = 0;
  }

  /* ── tournament averages ────────────────────────────────────── */
  const avgTournamentPoints = standings.length > 0
    ? standings.reduce((s, x) => s + (x.pointsValid || 0), 0) / standings.length
    : 0;
  const avgTournamentAprov = standings.length > 0
    ? Math.round(standings.reduce((s, x) => {
        const j = (x.setsWon || 0) + (x.setsLost || 0);
        return s + (j > 0 ? (x.setsWon / j) * 100 : 0);
      }, 0) / standings.length)
    : 0;
  const avgTournamentSaldo = standings.length > 0
    ? standings.reduce((s, x) => s + ((x.setsWon || 0) - (x.setsLost || 0)), 0) / standings.length
    : 0;
  const maxPoints = standings.length > 0 ? Math.max(...standings.map((s) => s.pointsValid || 0), 1) : 1;
  const maxSaldo = standings.length > 0
    ? Math.max(...standings.map((s) => Math.abs((s.setsWon || 0) - (s.setsLost || 0))), 1)
    : 1;

  /* ── insights ────────────────────────────────────────────────── */
  const insights = [];
  if (currentPosition != null && currentPosition <= 3)
    insights.push({ icon: MEDAL[currentPosition] || '🏆', text: `Top ${currentPosition} do ranking atual` });
  if (saldoSets > 0)
    insights.push({ icon: '📈', text: `Saldo positivo de sets (+${saldoSets})` });
  if (aproveitamento > avgTournamentAprov && totalJogos > 0)
    insights.push({ icon: '⚡', text: `Aproveitamento acima da média do torneio (${aproveitamento}% vs ${avgTournamentAprov}%)` });
  if (firstPlaces > 0)
    insights.push({ icon: '🥇', text: `Campeão em ${firstPlaces} etapa${firstPlaces > 1 ? 's' : ''}` });
  if (podiumCount > 0 && firstPlaces === 0)
    insights.push({ icon: '🏅', text: `${podiumCount} pódio${podiumCount > 1 ? 's' : ''} nesta temporada` });
  if (maxStreak >= 2)
    insights.push({ icon: '🔥', text: `Sequência de ${maxStreak} etapas no top 2` });
  if (presentHistory.length === history.length && history.length > 0 && history.length >= 3)
    insights.push({ icon: '✅', text: 'Presença em todas as etapas disputadas' });
  if (insights.length === 0 && presentHistory.length > 0)
    insights.push({ icon: '🎾', text: 'Temporada em andamento — continue jogando!' });

  /* ── achievements ────────────────────────────────────────────── */
  const achievements = [
    { earned: firstPlaces > 0, icon: '🥇', label: 'Campeão', desc: `${firstPlaces}×` },
    { earned: secondPlaces > 0, icon: '🥈', label: 'Vice', desc: `${secondPlaces}×` },
    { earned: podiumCount > 0, icon: '🏅', label: 'Pódio', desc: `${podiumCount}×` },
    {
      earned: presentHistory.length === history.length && history.length > 0,
      icon: '📅',
      label: '100% Presença',
      desc: `${history.length} etapa${history.length !== 1 ? 's' : ''}`,
    },
    { earned: saldoSets > 0, icon: '📈', label: 'Saldo+', desc: `+${saldoSets} sets` },
    { earned: maxStreak >= 2, icon: '🔥', label: 'Sequência', desc: `${maxStreak} seguidos` },
  ];

  /* ── narrative ───────────────────────────────────────────────── */
  const firstName = participant.name.split(' ')[0];
  const groupLabel = participant.group === 'F' ? 'feminino' : 'masculino';
  let narrative = '';
  if (presentHistory.length === 0) {
    narrative = `${firstName} ainda não disputou nenhuma etapa nesta temporada. Acompanhe a evolução ao longo do campeonato.`;
  } else {
    const posAdj = currentPosition != null
      ? currentPosition <= 3
        ? `entre os líderes do grupo ${groupLabel}, na ${currentPosition}ª posição`
        : `na ${currentPosition}ª posição do grupo ${groupLabel}`
      : `no grupo ${groupLabel}`;
    const setsAdj = saldoSets > 0
      ? `saldo positivo de sets (+${saldoSets})`
      : saldoSets < 0
      ? `saldo negativo de sets (${saldoSets})`
      : 'equilíbrio no saldo de sets';
    const aprovAdj = aproveitamento >= 60
      ? 'bom aproveitamento'
      : aproveitamento >= 40
      ? 'aproveitamento razoável'
      : 'aproveitamento a desenvolver';
    const podiumStr = podiumCount > 0
      ? ` Já somou ${podiumCount} pódio${podiumCount > 1 ? 's' : ''} na temporada.`
      : '';
    narrative = `${firstName} está ${posAdj}. Com ${setsAdj} e ${aprovAdj} de ${aproveitamento}% nos jogos, vem construindo sua campanha ao longo de ${presentHistory.length} etapa${presentHistory.length > 1 ? 's' : ''} disputada${presentHistory.length > 1 ? 's' : ''}.${podiumStr}`;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link
        to={`/t/${slug}`}
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-[#9B2D3E] mb-6 font-medium transition-colors"
      >
        ← Voltar
      </Link>

      {/* ── 1. HEADER ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#9B2D3E] to-[#C04060]" />

        <div className="flex items-start gap-4 mt-2">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-br from-[#9B2D3E] to-[#C04060] flex items-center justify-center text-white text-xl md:text-2xl font-bold shadow-md select-none">
              {initials(participant.name)}
            </div>
            {currentPosition != null && currentPosition <= 3 && (
              <span className="absolute -bottom-1.5 -right-1.5 text-xl leading-none">
                {MEDAL[currentPosition]}
              </span>
            )}
          </div>

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold text-neutral-900 tracking-tight">
                {participant.name}
              </h1>
              {currentPosition != null && currentPosition <= 3 && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#9B2D3E]/10 text-[#9B2D3E]">
                  Top {currentPosition}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 mt-0.5">
              Grupo {participant.group === 'F' ? 'Feminino' : 'Masculino'} · {tournament?.name}
            </p>
            {currentPosition != null && (
              <p className="text-sm font-semibold text-neutral-700 mt-1.5">
                {currentPosition}º no ranking · {pointsValid} pts
              </p>
            )}
          </div>
        </div>

        {/* Top KPIs */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          {[
            { label: 'Pontos', value: pointsValid, highlight: false },
            { label: 'Etapas', value: presentHistory.length, highlight: false },
            {
              label: 'Posição',
              value: currentPosition != null ? `${currentPosition}º` : '—',
              highlight: currentPosition != null && currentPosition <= 3,
            },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-neutral-50 rounded-xl p-3 md:p-4 text-center">
              <p className={`text-xl md:text-2xl font-bold ${highlight ? 'text-[#9B2D3E]' : 'text-neutral-900'}`}>
                {value}
              </p>
              <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. KPI CARDS ──────────────────────────────────────── */}
      <section className="mb-5">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 px-1">
          Desempenho
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Jogos', value: totalJogos, sub: 'sets disputados', color: 'text-neutral-900' },
            { label: 'Vitórias', value: totalSetsWon, sub: 'sets vencidos', color: 'text-emerald-600' },
            { label: 'Derrotas', value: totalSetsLost, sub: 'sets perdidos', color: 'text-red-500' },
            {
              label: 'Aproveit.',
              value: `${aproveitamento}%`,
              sub: 'taxa de vitória',
              color: aproveitamento >= 50 ? 'text-emerald-600' : 'text-neutral-700',
            },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-neutral-200/80 p-4">
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs font-semibold text-neutral-700 mt-0.5">{label}</p>
              <p className="text-xs text-neutral-400">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mt-3">
          {[
            {
              label: 'Sets V / P',
              main: `${totalSetsWon} / ${totalSetsLost}`,
              saldo: saldoSets,
            },
            {
              label: 'Games V / P',
              main: `${totalGamesWon} / ${totalGamesLost}`,
              saldo: saldoGames,
            },
            {
              label: 'Média pts/etapa',
              main: avgPointsPerRound,
              saldo: null,
            },
          ].map(({ label, main, saldo }) => (
            <div key={label} className="bg-white rounded-xl border border-neutral-200/80 p-4">
              <p className="text-base font-bold text-neutral-900">{main}</p>
              {saldo !== null && (
                <p className={`text-xs font-semibold ${saldo > 0 ? 'text-emerald-600' : saldo < 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                  {saldo > 0 ? `+${saldo}` : saldo}
                </p>
              )}
              <p className="text-xs text-neutral-400 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. INSIGHTS ───────────────────────────────────────── */}
      {insights.length > 0 && (
        <section className="mb-5">
          <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 px-1">
            Destaques
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((ins, i) => (
              <div
                key={i}
                className="flex items-center gap-3 bg-white rounded-xl border border-neutral-200/80 px-4 py-3"
              >
                <span className="text-xl shrink-0">{ins.icon}</span>
                <span className="text-sm text-neutral-700">{ins.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 4. EVOLUÇÃO NO RANKING ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 mb-5 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Evolução no Ranking</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Posição por etapa · 1º = melhor resultado</p>
        </div>
        <div className="px-4 py-4">
          <RankingChart history={sortedHistory} />
        </div>
      </div>

      {/* ── 5. HISTÓRICO DE ETAPAS ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 mb-5 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Histórico por Etapa</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Mais recente primeiro</p>
        </div>
        {sortedHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-neutral-400">
            <span className="text-3xl">📋</span>
            <p className="text-sm">Nenhuma etapa registrada ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {[...sortedHistory].reverse().map((r) => (
              <div
                key={r.id}
                className={`flex items-center gap-3 px-5 py-4 transition-colors hover:bg-neutral-50/60 ${
                  r.present && r.position === 1
                    ? 'bg-amber-50/40'
                    : r.present && r.position === 2
                    ? 'bg-neutral-50/40'
                    : ''
                }`}
              >
                {/* Round + date */}
                <div className="shrink-0 w-10 text-center">
                  <p className="text-xs font-semibold text-neutral-600">{r.round.number}ª</p>
                  <p className="text-xs text-neutral-300 leading-none mt-0.5">
                    {new Date(r.round.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </p>
                </div>

                {/* Position badge */}
                <div
                  className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${posBadgeCls(r.position, r.present)}`}
                >
                  {r.present && r.position ? `${r.position}º` : '—'}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  {r.present && r.position ? (
                    <>
                      <p className="text-sm font-semibold text-neutral-800 truncate">
                        {MEDAL[r.position] ? `${MEDAL[r.position]} ` : ''}
                        {r.position}º lugar
                        {r.courtLabel && (
                          <span className="ml-1.5 text-xs font-normal text-neutral-400">
                            · {r.courtLabel}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Sets {r.setsWon}–{r.setsLost} · Games {r.gamesWon}–{r.gamesLost}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-neutral-400">
                      {r.absentReason === 'SORTEIO'
                        ? 'Sorteada'
                        : r.absentReason === 'SORTEIO_VOLUNTARIA'
                        ? 'Ausência voluntária'
                        : 'Faltou'}
                    </p>
                  )}
                </div>

                {/* Points */}
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold text-neutral-900">{r.pointsRaw} pts</p>
                  {r.uniformPenalty < 0 && (
                    <p className="text-xs text-red-500 mt-0.5">−20 unif.</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. HISTÓRICO DE JOGOS ─────────────────────────────── */}
      {matchHistory.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200/80 mb-5 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
            <h2 className="font-semibold text-neutral-900">Histórico de Jogos</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Jogos individuais · mais recente primeiro</p>
          </div>
          <div className="divide-y divide-neutral-100">
            {matchHistory.map((m) => (
              <div
                key={m.id}
                className={`flex items-center gap-3 px-5 py-3.5 transition-colors ${
                  m.won ? 'bg-emerald-50/40 hover:bg-emerald-50/60' : 'bg-red-50/30 hover:bg-red-50/50'
                }`}
              >
                {/* Win/Loss badge */}
                <div
                  className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    m.won ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  }`}
                >
                  {m.won ? 'V' : 'D'}
                </div>

                {/* Opponent + partner */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-800 truncate">
                    vs. {m.opponentNames.join(' / ')}
                  </p>
                  {m.partnerName && (
                    <p className="text-xs text-neutral-400 truncate">
                      Parceiro: {m.partnerName}
                    </p>
                  )}
                </div>

                {/* Score */}
                <div className="shrink-0 text-center">
                  <p className={`text-sm font-bold tabular-nums ${m.won ? 'text-emerald-700' : 'text-red-600'}`}>
                    {m.myScore} × {m.opponentScore}
                  </p>
                </div>

                {/* Etapa + court */}
                <div className="shrink-0 text-right hidden sm:block">
                  <p className="text-xs font-semibold text-neutral-500">{m.roundNumber}ª etapa</p>
                  {m.courtLabel && (
                    <p className="text-xs text-neutral-300 mt-0.5">{m.courtLabel}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 7. ESTATÍSTICAS DETALHADAS ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 mb-5 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Estatísticas Detalhadas</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y divide-neutral-100">
          {[
            { label: 'Melhor colocação', value: bestPos != null ? `${bestPos}º` : '—' },
            { label: 'Pior colocação', value: worstPos != null ? `${worstPos}º` : '—' },
            { label: 'Pódios na temporada', value: podiumCount || '—' },
            { label: 'Melhor sequência top 2', value: maxStreak >= 2 ? `${maxStreak} seguidos` : '—' },
            { label: 'Aproveit. em sets', value: totalJogos > 0 ? `${aproveitamento}%` : '—' },
            { label: 'Aproveit. em games', value: (totalGamesWon + totalGamesLost) > 0 ? `${aprovGames}%` : '—' },
          ].map(({ label, value }) => (
            <div key={label} className="p-4 text-center">
              <p className="text-lg font-bold text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 7. COMPARAÇÃO COM O TORNEIO ───────────────────────── */}
      {standings.length > 1 && (
        <div className="bg-white rounded-2xl border border-neutral-200/80 mb-5 overflow-hidden">
          <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
            <h2 className="font-semibold text-neutral-900">vs. Média do Torneio</h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              {participant.name.split(' ')[0]} em destaque · média do grupo
            </p>
          </div>
          <div className="p-5 space-y-5">
            <CompareBar
              label="Pontuação"
              athleteVal={pointsValid}
              avgVal={avgTournamentPoints}
              displayAthlete={`${pointsValid} pts`}
              displayAvg={`${Math.round(avgTournamentPoints)} pts`}
              max={maxPoints}
            />
            <CompareBar
              label="Aproveitamento"
              athleteVal={aproveitamento}
              avgVal={avgTournamentAprov}
              displayAthlete={`${aproveitamento}%`}
              displayAvg={`${avgTournamentAprov}%`}
              max={100}
            />
            <CompareBar
              label="Saldo de Sets"
              athleteVal={saldoSets}
              avgVal={avgTournamentSaldo}
              displayAthlete={saldoSets > 0 ? `+${saldoSets}` : String(saldoSets)}
              displayAvg={avgTournamentSaldo > 0 ? `+${avgTournamentSaldo.toFixed(1)}` : avgTournamentSaldo.toFixed(1)}
              max={maxSaldo}
            />
          </div>
        </div>
      )}

      {/* ── 9. CONQUISTAS ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 mb-5 overflow-hidden">
        <div className="px-5 pt-5 pb-3 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Conquistas</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Desbloqueadas ao longo da temporada</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-y divide-neutral-100">
          {achievements.map(({ earned, icon, label, desc }) => (
            <div
              key={label}
              className={`p-4 text-center transition-opacity ${earned ? '' : 'opacity-25'}`}
            >
              <div className={`text-2xl mb-1 ${earned ? '' : 'grayscale'}`}>{icon}</div>
              <p className="text-xs font-semibold text-neutral-700">{label}</p>
              {earned && <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* ── 10. RESUMO NARRATIVO ──────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#9B2D3E]/5 to-transparent border border-[#9B2D3E]/10 rounded-2xl p-6">
        <p className="text-xs font-semibold text-[#9B2D3E] uppercase tracking-wider mb-2">
          Resumo da Temporada
        </p>
        <p className="text-sm text-neutral-600 leading-relaxed">{narrative}</p>
      </div>
    </div>
  );
}
