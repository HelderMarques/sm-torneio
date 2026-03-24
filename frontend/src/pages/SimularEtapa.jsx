import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Jogou' },
  { value: 'SORTEIO', label: 'Sorteada' },
  { value: 'SORTEIO_VOLUNTARIA', label: 'Voluntária' },
  { value: 'FALTA', label: 'Faltou' },
];

const GROUPS = [
  { key: 'F', label: 'Feminino' },
  { key: 'M', label: 'Masculino' },
];

export default function SimularEtapa() {
  const { slug, tournament, tApi } = useTournament();
  const [group, setGroup] = useState('F');
  const [participants, setParticipants] = useState([]);
  const [standings, setStandings] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selection, setSelection] = useState({});
  const [simulation, setSimulation] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    setLoading(true);
    setSelection({});
    setSimulation(null);
    Promise.all([
      tApi.get(`/participants?group=${group}`),
      tApi.get(`/standings/${group}`),
      tApi.get(`/rounds?group=${group}`),
    ])
      .then(([pRes, sRes, rRes]) => {
        setParticipants(pRes.data || []);
        setStandings(sRes.data || []);
        setRounds(rRes.data || []);
      })
      .catch((err) => {
        console.error(err);
        setMessage('Erro ao carregar dados para simulação.');
      })
      .finally(() => setLoading(false));
  }, [slug, group]);

  const nextRound = useMemo(
    () => rounds.find((r) => r.status === 'SCHEDULED') || null,
    [rounds],
  );

  const handleChangePosition = (participantId, position) => {
    setSelection((prev) => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] || {}),
        position: position ? Number(position) : null,
      },
    }));
  };

  const handleChangeStatus = (participantId, status) => {
    setSelection((prev) => ({
      ...prev,
      [participantId]: {
        position: status === 'PRESENT' ? (prev[participantId]?.position || null) : null,
        status,
      },
    }));
  };

  const handleSimulate = async () => {
    const results = participants.map((p) => {
      const sel = selection[p.id] || { status: 'PRESENT', position: null };
      const status = sel.status || 'PRESENT';

      if (status === 'PRESENT') {
        if (!sel.position) return null;
        return {
          participantId: p.id,
          present: true,
          absentReason: 'NONE',
          position: sel.position,
        };
      }

      // Ausentes conforme regulamento
      let absentReason = 'FALTA';
      if (status === 'SORTEIO') absentReason = 'SORTEIO';
      else if (status === 'SORTEIO_VOLUNTARIA') absentReason = 'SORTEIO_VOLUNTARIA';

      return {
        participantId: p.id,
        present: false,
        absentReason,
        position: null,
      };
    }).filter(Boolean);

    if (results.length === 0) {
      setMessage('Defina pelo menos uma posição ou situação na etapa para simular.');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setSimulating(true);
    try {
      const res = await tApi.post('/standings/simulate', {
        group,
        results,
      });
      setSimulation(res.data);
    } catch (err) {
      console.error(err);
      setMessage('Erro ao simular classificação.');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  const currentById = new Map(standings.map((s) => [s.participantId, s]));
  const usedCounts = Object.values(selection).reduce((acc, v) => {
    if (v.position && (v.status || 'PRESENT') === 'PRESENT') {
      acc[v.position] = (acc[v.position] || 0) + 1;
    }
    return acc;
  }, {});

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Simular etapa</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {tournament?.name} — esta simulação não altera a pontuação real.
          </p>
        </div>
        <Link
          to={`/t/${slug}`}
          className="text-sm text-neutral-500 hover:text-neutral-900 font-medium"
        >
          ← Voltar para o torneio
        </Link>
      </div>

      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit mb-6">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              group === g.key
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {nextRound && (
        <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200/80 text-sm text-neutral-700">
          <span className="font-medium text-neutral-900">Próxima etapa:&nbsp;</span>
          {nextRound.number}ª —{' '}
          {new Date(nextRound.date + 'T12:00:00').toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
          })}
        </div>
      )}

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm ${message.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-8">
        <h2 className="font-semibold text-neutral-900 mb-3">1. Defina a posição na etapa</h2>
        <p className="text-sm text-neutral-500 mb-4">
          Para representar as duplas, atribua a mesma posição na etapa para as duas atletas que formam a dupla.
          Cada posição da etapa (1º a 7º) pode ser usada no máximo por duas atletas.
        </p>

        {/* Versão mobile: cards em coluna, sem scroll horizontal */}
        <div className="space-y-3 md:hidden">
          {participants.map((p) => {
            const current = currentById.get(p.id);
            const sel = selection[p.id]?.position || '';
            const status = selection[p.id]?.status || 'PRESENT';
            const isPresent = status === 'PRESENT';

            return (
              <div
                key={p.id}
                className="border border-neutral-200 rounded-xl px-4 py-3 bg-white"
              >
                <div className="flex items-baseline justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">
                      {p.name}
                    </p>
                    <p className="text-xs text-neutral-500">
                      Posição atual:{' '}
                      <span className="font-medium text-neutral-700">
                        {current ? `${current.position}º` : '—'}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-neutral-500 mb-1">
                      Situação na etapa
                    </p>
                    <select
                      value={status}
                      onChange={(e) => handleChangeStatus(p.id, e.target.value)}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-500 mb-1">
                      Posição na etapa
                    </p>
                    <select
                      value={isPresent ? sel : ''}
                      onChange={(e) => handleChangePosition(p.id, e.target.value || null)}
                      disabled={!isPresent}
                      className="w-full border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] disabled:bg-neutral-50 disabled:text-neutral-400"
                    >
                      <option value="">(sem resultado)</option>
                      {[1, 2, 3, 4, 5, 6, 7].map((pos) => {
                        const used = usedCounts[pos] || 0;
                        const isCurrent = sel === pos;
                        const disabled = !isPresent || (!isCurrent && used >= 2);
                        return (
                          <option key={pos} value={pos} disabled={disabled}>
                            {pos}º lugar {disabled && isPresent ? '(já usado por 2 atletas)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Versão desktop: tabela completa com controles em linha */}
        <div className="hidden md:block max-h-[360px] overflow-auto border border-neutral-100 rounded-xl">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Atleta
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Posição atual
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Situação na etapa
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  Posição na etapa (simulada)
                </th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const current = currentById.get(p.id);
                const sel = selection[p.id]?.position || '';
                const status = selection[p.id]?.status || 'PRESENT';
                const isPresent = status === 'PRESENT';

                return (
                  <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50/40">
                    <td className="px-4 py-2 text-neutral-900">{p.name}</td>
                    <td className="px-4 py-2 text-neutral-600">
                      {current ? `${current.position}º` : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {STATUS_OPTIONS.map((opt) => {
                          const active = status === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleChangeStatus(p.id, opt.value)}
                              className={
                                'px-2.5 py-1 rounded-full text-xs font-medium border ' +
                                (active
                                  ? 'bg-[#9B2D3E] text-white border-[#9B2D3E]'
                                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400')
                              }
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={isPresent ? sel : ''}
                        onChange={(e) => handleChangePosition(p.id, e.target.value || null)}
                        disabled={!isPresent}
                        className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] disabled:bg-neutral-50 disabled:text-neutral-400"
                      >
                        <option value="">(sem resultado)</option>
                        {[1, 2, 3, 4, 5, 6, 7].map((pos) => {
                          const used = usedCounts[pos] || 0;
                          const isCurrent = sel === pos;
                          const disabled = !isPresent || (!isCurrent && used >= 2);
                          return (
                            <option key={pos} value={pos} disabled={disabled}>
                              {pos}º lugar {disabled && isPresent ? '(já usado por 2 atletas)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={handleSimulate}
          disabled={simulating}
          className="mt-4 bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
        >
          {simulating ? 'Calculando...' : 'Calcular simulação'}
        </button>
      </div>

      {simulation && (
        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
          <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
            <h2 className="font-semibold text-neutral-900">2. Resultado da simulação</h2>
            <p className="text-xs text-neutral-500 mt-1">
              Verde: subiu posições. Vermelho: caiu posições. Esta tabela não altera o ranking oficial.
            </p>
          </div>
          <div className="max-h-[420px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide text-left">Pos</th>
                  <th className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide text-left">Atleta</th>
                  <th className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide text-left">Pos. atual</th>
                  <th className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide text-left">Variação</th>
                  <th className="px-3 py-2 text-xs font-medium text-neutral-500 uppercase tracking-wide text-left">Pts simulados</th>
                </tr>
              </thead>
              <tbody>
                {simulation.map((s) => {
                  const delta = s.positionDelta || 0;
                  const deltaLabel =
                    delta === 0 ? '—' :
                    delta > 0 ? `↑ ${Math.abs(delta)}` :
                    `↓ ${Math.abs(delta)}`;
                  const deltaClass =
                    delta === 0 ? 'text-neutral-500' :
                    delta > 0 ? 'text-emerald-600' :
                    'text-red-600';
                  return (
                    <tr key={s.participantId} className="border-b border-neutral-100 hover:bg-neutral-50/40">
                      <td className="px-3 py-2 text-neutral-900">{s.position}º</td>
                      <td className="px-3 py-2 text-neutral-900">{s.name}</td>
                      <td className="px-3 py-2 text-neutral-600">
                        {s.oldPosition ? `${s.oldPosition}º` : '—'}
                      </td>
                      <td className={`px-3 py-2 font-medium ${deltaClass}`}>{deltaLabel}</td>
                      <td className="px-3 py-2 text-neutral-700">{s.pointsValid}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

