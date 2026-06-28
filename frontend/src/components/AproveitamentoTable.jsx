import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';
import { useAproveitamento } from '../hooks/useAproveitamento';

const DIMENSIONS = [
  { key: 'partidas', label: 'Partidas' },
  { key: 'sets', label: 'Sets' },
  { key: 'games', label: 'Games' },
];

function fmtRate(entry) {
  if (!entry || entry.rate === null || entry.rate === undefined) return '—';
  return `${Math.round(entry.rate * 100)}%`;
}

/** Badge de variação: oficial − aproveitamento (positivo = sobe no aproveitamento). */
function VarBadge({ delta }) {
  if (delta === null || delta === undefined) return <span className="text-neutral-300">—</span>;
  if (delta === 0) return <span className="text-neutral-400">=</span>;
  const up = delta > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${up ? 'text-emerald-600' : 'text-red-500'}`}>
      {up ? '▲' : '▼'} {Math.abs(delta)}
    </span>
  );
}

export default function AproveitamentoTable({ group }) {
  const { slug, tApi } = useTournament();
  const { data, loading, error } = useAproveitamento(group);
  const [dim, setDim] = useState('partidas');
  const [officialPos, setOfficialPos] = useState(null); // Map participantId -> posição oficial

  useEffect(() => {
    let cancelled = false;
    setOfficialPos(null);
    tApi.get(`/standings/${group}`)
      .then((res) => {
        if (cancelled) return;
        setOfficialPos(new Map((res.data || []).map((s) => [s.participantId, s.position])));
      })
      .catch(() => { if (!cancelled) setOfficialPos(new Map()); });
    return () => { cancelled = true; };
  }, [slug, group]);

  const dimLabel = DIMENSIONS.find((d) => d.key === dim)?.label || '';

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

  const ranking = (data && data[dim]) || [];

  return (
    <div>
      <div className="px-5 py-3 border-b border-neutral-100 flex items-center gap-2">
        <label htmlFor="aprov-dim" className="text-sm text-neutral-500">Métrica</label>
        <select
          id="aprov-dim"
          value={dim}
          onChange={(e) => setDim(e.target.value)}
          className="text-sm font-medium text-neutral-900 bg-white border border-neutral-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#9B2D3E]/30 cursor-pointer"
        >
          {DIMENSIONS.map((d) => (
            <option key={d.key} value={d.key}>{d.label}</option>
          ))}
        </select>
      </div>

      {ranking.length === 0 ? (
        <div className="text-center py-10 text-neutral-500 text-sm">
          Nenhum resultado registrado ainda.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr className="bg-neutral-50">
                <th className="sticky left-0 z-20 w-14 bg-neutral-50 px-2 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200">#</th>
                <th className="sticky left-14 z-20 bg-neutral-50 px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-r border-neutral-200">Atleta</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-[#9B2D3E] uppercase tracking-wider border-b border-neutral-200 bg-red-50/60">{dimLabel} %</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200" title="Colocação oficial (pontuação)">Of.</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider border-b border-neutral-200" title="Variação de posições vs. ranking oficial">Var.</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, idx) => {
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-neutral-50';
                const official = officialPos ? officialPos.get(entry.participantId) : null;
                const delta = official != null ? official - entry.position : null;
                const tip = entry.rate !== null ? `${entry.won}/${entry.played}` : 'sem dados';
                return (
                  <tr key={entry.participantId} className={rowBg}>
                    <td className={`sticky left-0 z-10 w-14 px-2 py-3 text-center text-neutral-500 font-medium border-b border-neutral-100 ${rowBg}`}>
                      {entry.position}
                    </td>
                    <td className={`sticky left-14 z-10 px-4 py-3 font-medium border-b border-r border-neutral-100 border-r-neutral-200 ${rowBg}`}>
                      <Link to={`/t/${slug}/participante/${entry.participantId}`} className="text-neutral-900 hover:text-[#9B2D3E]">
                        {entry.name}
                      </Link>
                    </td>
                    <td title={tip} className="px-4 py-3 text-center font-semibold text-neutral-900 border-b border-neutral-100 bg-red-50/40">
                      {fmtRate(entry)}
                    </td>
                    <td className="px-4 py-3 text-center text-neutral-500 border-b border-neutral-100">
                      {official != null ? `${official}º` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center border-b border-neutral-100">
                      <VarBadge delta={delta} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 text-xs text-neutral-400 flex flex-wrap gap-x-4 gap-y-1">
            <span><strong className="text-neutral-500">#</strong> Posição no ranking de aproveitamento</span>
            <span><strong className="text-neutral-500">{dimLabel} %</strong> Vitórias / total ({dim === 'partidas' ? 'partidas' : dim})</span>
            <span><strong className="text-neutral-500">Of.</strong> Colocação oficial (pontuação)</span>
            <span><strong className="text-emerald-600">▲</strong> Sobe / <strong className="text-red-500">▼</strong> Desce vs. oficial</span>
            <span><strong className="text-neutral-500">—</strong> Sem dados suficientes</span>
          </div>
        </div>
      )}
    </div>
  );
}
