import { useAproveitamento } from '../hooks/useAproveitamento';

const DIMENSIONS = [
  { key: 'partidas', label: 'Partidas', icon: '🎾' },
  { key: 'sets', label: 'Sets', icon: '🏆' },
  { key: 'games', label: 'Games', icon: '🎯' },
];

const WINDOW = 5;

function pct(rate) {
  return `${Math.round(rate * 100)}%`;
}

/**
 * Janela de 5 linhas centrada na atleta (2 acima + ela + 2 abaixo),
 * deslizando nas bordas para sempre mostrar 5 quando houver ≥5 atletas.
 */
function windowAround(ranking, idx) {
  const total = ranking.length;
  if (total <= WINDOW) return ranking;
  let start = Math.max(0, idx - 2);
  let end = Math.min(total, start + WINDOW);
  if (end - start < WINDOW) start = Math.max(0, end - WINDOW);
  return ranking.slice(start, end);
}

function MiniCard({ dim, ranking, participantId }) {
  const idx = ranking.findIndex((e) => e.participantId === participantId);
  const me = idx >= 0 ? ranking[idx] : null;

  if (!me || me.rate === null) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200/80 p-4">
        <p className="text-xs font-semibold text-neutral-700 mb-2">
          {dim.icon} {dim.label}
        </p>
        <p className="text-sm text-neutral-400 py-6 text-center">Sem dados</p>
      </div>
    );
  }

  const rows = windowAround(ranking, idx);

  return (
    <div className="bg-white rounded-xl border border-neutral-200/80 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold text-neutral-700">
          {dim.icon} {dim.label}
        </p>
        <p className="text-xs text-neutral-400">{me.position}º lugar</p>
      </div>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-bold text-[#9B2D3E]">{pct(me.rate)}</span>
        <span className="text-xs text-neutral-400">({me.won} de {me.played})</span>
      </div>
      <div className="divide-y divide-neutral-100">
        {rows.map((e) => {
          const isMe = e.participantId === participantId;
          return (
            <div
              key={e.participantId}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded-md ${
                isMe ? 'bg-rose-50 font-semibold text-[#9B2D3E]' : 'text-neutral-600'
              }`}
            >
              <span className="w-6 shrink-0 text-xs text-neutral-400 text-center">{e.position}º</span>
              <span className="flex-1 min-w-0 truncate">{e.name}</span>
              <span className="shrink-0 tabular-nums">{e.rate === null ? '—' : pct(e.rate)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AproveitamentoMini({ participantId, group }) {
  const { data, loading, error } = useAproveitamento(group);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {DIMENSIONS.map((d) => (
          <div key={d.key} className="bg-white rounded-xl border border-neutral-200/80 p-4 animate-pulse">
            <div className="h-3 w-20 bg-neutral-200 rounded mb-3" />
            <div className="h-6 w-16 bg-neutral-200 rounded mb-3" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-4 bg-neutral-100 rounded" />)}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (error || !data) {
    return (
      <p className="text-sm text-neutral-400">Erro ao carregar aproveitamento.</p>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {DIMENSIONS.map((dim) => (
        <MiniCard key={dim.key} dim={dim} ranking={data[dim.key] || []} participantId={participantId} />
      ))}
    </div>
  );
}
