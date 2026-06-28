import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import { useAproveitamento } from '../hooks/useAproveitamento';

const DIMENSIONS = [
  { key: 'partidas', label: 'Partidas %', short: 'Partidas' },
  { key: 'sets', label: 'Sets %', short: 'Sets' },
  { key: 'games', label: 'Games %', short: 'Games' },
];

function fmtRate(entry) {
  if (!entry || entry.rate === null || entry.rate === undefined) return '—';
  return `${Math.round(entry.rate * 100)}%`;
}

export default function AproveitamentoTable({ group }) {
  const { slug } = useTournament();
  const { data, loading, error } = useAproveitamento(group);
  const [sortKey, setSortKey] = useState('partidas');

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-center py-10 text-neutral-500 text-sm">
        Erro ao carregar aproveitamento.
      </div>
    );
  }
  if (!data || !data[sortKey] || data[sortKey].length === 0) {
    return (
      <div className="text-center py-10 text-neutral-500 text-sm">
        Nenhum resultado registrado ainda.
      </div>
    );
  }

  // Indexa cada dimensão por participantId para montar uma linha por atleta.
  const byDim = {};
  for (const dim of DIMENSIONS) {
    byDim[dim.key] = new Map((data[dim.key] || []).map((e) => [e.participantId, e]));
  }

  // A ordem das linhas segue a dimensão ativa (já ordenada + posicionada no backend).
  const rows = (data[sortKey] || []).map((entry) => ({
    participantId: entry.participantId,
    name: entry.name,
    position: entry.position,
    partidas: byDim.partidas.get(entry.participantId),
    sets: byDim.sets.get(entry.participantId),
    games: byDim.games.get(entry.participantId),
  }));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-separate border-spacing-0">
        <thead>
          <tr className="bg-neutral-50">
            <th className="sticky left-0 z-20 w-14 bg-neutral-50 px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">#</th>
            <th className="sticky left-14 z-20 bg-neutral-50 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-r border-neutral-200">Atleta</th>
            {DIMENSIONS.map((dim) => {
              const active = sortKey === dim.key;
              return (
                <th
                  key={dim.key}
                  onClick={() => setSortKey(dim.key)}
                  className={`px-4 py-3 text-center text-xs font-medium uppercase tracking-wider border-b border-neutral-200 cursor-pointer select-none transition-colors ${
                    active ? 'text-[#9B2D3E] bg-red-50/60' : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                  title={`Ordenar por ${dim.short}`}
                >
                  {dim.short} {active ? '▼' : ''}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
            return (
              <tr key={row.participantId} className={rowBg}>
                <td className={`sticky left-0 z-10 w-14 px-2 py-3 text-center text-neutral-500 font-medium border-b border-neutral-100 ${rowBg}`}>
                  {row.position}
                </td>
                <td className={`sticky left-14 z-10 px-4 py-3 font-medium border-b border-r border-neutral-100 border-r-neutral-200 ${rowBg}`}>
                  <Link
                    to={`/t/${slug}/participante/${row.participantId}`}
                    className="text-neutral-900 hover:text-[#9B2D3E]"
                  >
                    {row.name}
                  </Link>
                </td>
                {DIMENSIONS.map((dim) => {
                  const entry = row[dim.key];
                  const active = sortKey === dim.key;
                  const tip = entry && entry.rate !== null ? `${entry.won}/${entry.played}` : 'sem dados';
                  return (
                    <td
                      key={dim.key}
                      title={tip}
                      className={`px-4 py-3 text-center border-b border-neutral-100 ${
                        active ? 'font-semibold text-neutral-900 bg-red-50/40' : 'text-neutral-600'
                      }`}
                    >
                      {fmtRate(entry)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-xs text-neutral-400 flex flex-wrap gap-x-4 gap-y-1">
        <span><strong className="text-neutral-500">Partidas %</strong> Vitórias de partidas / partidas jogadas</span>
        <span><strong className="text-neutral-500">Sets %</strong> Sets vencidos / sets jogados</span>
        <span><strong className="text-neutral-500">Games %</strong> Games vencidos / games jogados</span>
        <span><strong className="text-neutral-500">—</strong> Sem dados suficientes</span>
      </div>
    </div>
  );
}
