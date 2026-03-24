import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';

const POSITIONS = [
  { value: 1, label: '1º — 100 pts' },
  { value: 2, label: '2º — 80 pts' },
  { value: 3, label: '3º — 70 pts' },
  { value: 4, label: '4º — 60 pts' },
  { value: 5, label: '5º — 50 pts' },
  { value: 6, label: '6º — 40 pts' },
  { value: 7, label: '7º — 30 pts' },
];

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export default function EtapaDetail() {
  const { id } = useParams();
  const { slug, tApi } = useTournament();
  const [round, setRound] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [results, setResults] = useState({});
  const [pairs, setPairs] = useState({}); // { participantId: partnerId }
  const [courtLabels, setCourtLabels] = useState({}); // { participantId: courtLabel }
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState([]); // { tempId, courtLabel, pairAId, pairBId, scoreA, scoreB, gameOrder }
  const [matchSaving, setMatchSaving] = useState(false);
  const [matchMessage, setMatchMessage] = useState('');
  const [pairRegistry, setPairRegistry] = useState({});

  useEffect(() => {
    Promise.all([
      tApi.get(`/rounds/${id}`),
      tApi.get('/participants'),
    ]).then(([roundRes, partRes]) => {
      const roundData = roundRes.data;
      setRound(roundData);

      const groupParticipants = partRes.data.filter(
        (p) => p.group === roundData.group && p.active
      );
      setParticipants(groupParticipants);

      const existingResults = {};
      const pairMap = {}; // pairId -> [participantId, ...]

      if (roundData.results) {
        for (const r of roundData.results) {
          existingResults[r.participantId] = {
            present: r.present,
            absentReason: r.absentReason,
            position: r.position,
            setsWon: r.setsWon,
            setsLost: r.setsLost,
            gamesWon: r.gamesWon,
            gamesLost: r.gamesLost,
            uniformPenalty: r.uniformPenalty,
          };
          if (r.pairId) {
            if (!pairMap[r.pairId]) pairMap[r.pairId] = [];
            pairMap[r.pairId].push(r.participantId);
          }
        }
      }

      for (const p of groupParticipants) {
        if (!existingResults[p.id]) {
          existingResults[p.id] = {
            present: true,
            absentReason: 'NONE',
            position: null,
            setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
            uniformPenalty: 0,
          };
        }
      }
      setResults(existingResults);

      // Build participantId -> partnerId map
      const pairsMap = {};
      for (const ids of Object.values(pairMap)) {
        if (ids.length === 2) {
          pairsMap[ids[0]] = ids[1];
          pairsMap[ids[1]] = ids[0];
        }
      }
      setPairs(pairsMap);

      // Build participantId -> courtLabel map
      const courtMap = {};
      if (roundData.results) {
        for (const r of roundData.results) {
          if (r.courtLabel) courtMap[r.participantId] = r.courtLabel;
        }
      }
      setCourtLabels(courtMap);

      // Build pair registry from saved results for match entry
      const pairReg = {};
      for (const r of roundData.results || []) {
        if (r.pairId) {
          if (!pairReg[r.pairId]) pairReg[r.pairId] = { pairId: r.pairId, courtLabel: r.courtLabel || '—', names: [] };
          if (r.participant?.name) pairReg[r.pairId].names.push(r.participant.name);
        }
      }
      setPairRegistry(pairReg);

      // Load existing match results
      if (roundData.matchResults?.length) {
        setMatches(roundData.matchResults.map((m, i) => ({ ...m, tempId: m.id || String(i) })));
      }
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  const updateResult = (participantId, field, value) => {
    setResults((prev) => ({
      ...prev,
      [participantId]: { ...prev[participantId], [field]: value },
    }));
  };

  const setCourtLabel = (participantId, label) => {
    const partnerId = pairs[participantId];
    setCourtLabels((prev) => {
      const next = { ...prev, [participantId]: label || null };
      if (partnerId) next[partnerId] = label || null;
      return next;
    });
  };

  const setPartner = (participantId, partnerId) => {
    setPairs((prev) => {
      const next = { ...prev };
      // Clear old partner of this participant
      const oldPartner = next[participantId];
      if (oldPartner) delete next[oldPartner];
      // Clear old partner of new partner
      if (partnerId) {
        const oldOfNew = next[partnerId];
        if (oldOfNew) delete next[oldOfNew];
        next[participantId] = partnerId;
        next[partnerId] = participantId;
      } else {
        delete next[participantId];
      }
      return next;
    });
  };

  const handleSaveMatches = async () => {
    setMatchSaving(true);
    setMatchMessage('');
    try {
      const payload = matches
        .filter(m => m.pairAId && m.pairBId)
        .map((m, i) => ({
          courtLabel: m.courtLabel,
          pairAId: m.pairAId,
          pairBId: m.pairBId,
          scoreA: Number(m.scoreA) || 0,
          scoreB: Number(m.scoreB) || 0,
          gameOrder: i + 1,
        }));
      await tApi.post(`/rounds/${id}/matches`, { matches: payload });
      setMatchMessage('Jogos salvos com sucesso!');
      setTimeout(() => setMatchMessage(''), 3000);
    } catch (err) {
      setMatchMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setMatchSaving(false);
    }
  };

  const addMatchRow = (courtLabel, pairsInCourt) => {
    setMatches(prev => [...prev, {
      tempId: Date.now().toString(),
      courtLabel,
      pairAId: pairsInCourt[0]?.pairId || '',
      pairBId: pairsInCourt[1]?.pairId || '',
      scoreA: 0,
      scoreB: 0,
      gameOrder: prev.filter(m => m.courtLabel === courtLabel).length + 1,
    }]);
  };

  const removeMatchRow = (tempId) => {
    setMatches(prev => prev.filter(m => m.tempId !== tempId));
  };

  const updateMatch = (tempId, field, value) => {
    setMatches(prev => prev.map(m => m.tempId === tempId ? { ...m, [field]: value } : m));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      // Build shared pairIds for each pair
      const pairIds = {};
      const processed = new Set();
      for (const [pid, partnerId] of Object.entries(pairs)) {
        if (!processed.has(pid)) {
          const sharedId = generateUUID();
          pairIds[pid] = sharedId;
          pairIds[partnerId] = sharedId;
          processed.add(pid);
          processed.add(partnerId);
        }
      }

      const payload = participants.map((p) => {
        const r = results[p.id];
        return {
          participantId: p.id,
          present: r.present,
          absentReason: r.absentReason,
          position: r.present ? r.position : null,
          setsWon: r.present ? (r.setsWon || 0) : 0,
          setsLost: r.present ? (r.setsLost || 0) : 0,
          gamesWon: r.present ? (r.gamesWon || 0) : 0,
          gamesLost: r.present ? (r.gamesLost || 0) : 0,
          uniformPenalty: r.uniformPenalty || 0,
          pairId: pairIds[p.id] || null,
          courtLabel: courtLabels[p.id] || null,
        };
      });

      await tApi.post(`/rounds/${id}/results`, { results: payload });
      setMessage('Resultados salvos com sucesso! Classificação recalculada.');
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setMessage('Erro ao salvar resultados: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

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

  const presentParticipants = participants.filter((p) => results[p.id]?.present);

  const pairsByCourt = {};
  for (const p of Object.values(pairRegistry)) {
    const court = p.courtLabel;
    if (!pairsByCourt[court]) pairsByCourt[court] = [];
    pairsByCourt[court].push({ pairId: p.pairId, label: p.names.join(' / ') });
  }
  const hasPairs = Object.keys(pairsByCourt).length > 0;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to={`/admin/t/${slug}/etapas`} className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">← Voltar</Link>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight mt-1">
            {round.number}ª Etapa — {round.group === 'F' ? 'Feminino' : 'Masculino'}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-6 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors"
        >
          {saving ? 'Salvando...' : 'Salvar Resultados'}
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm ${message.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
          {message}
        </div>
      )}

      {/* Tabela de resultados */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Resultados</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Defina a presença, colocação e estatísticas de cada participante.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200">
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">Participante</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Presença</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Colocação</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Sets V</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Sets P</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Games V</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Games P</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-500 uppercase tracking-wider">Uniforme</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const r = results[p.id] || {};
                return (
                  <tr key={p.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
                    <td className="px-4 py-3 font-medium text-neutral-900">{p.name}</td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={r.present ? 'PRESENT' : r.absentReason}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'PRESENT') {
                            updateResult(p.id, 'present', true);
                            updateResult(p.id, 'absentReason', 'NONE');
                          } else {
                            updateResult(p.id, 'present', false);
                            updateResult(p.id, 'absentReason', val);
                          }
                        }}
                        className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                      >
                        <option value="PRESENT">Presente</option>
                        <option value="FALTA">Faltou</option>
                        <option value="SORTEIO">Sorteado (80pts)</option>
                        <option value="SORTEIO_VOLUNTARIA">Voluntário (60pts)</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {r.present ? (
                        <select
                          value={r.position || ''}
                          onChange={(e) => updateResult(p.id, 'position', Number(e.target.value) || null)}
                          className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                        >
                          <option value="">—</option>
                          {POSITIONS.map((pos) => (
                            <option key={pos.value} value={pos.value}>{pos.label}</option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    {['setsWon', 'setsLost', 'gamesWon', 'gamesLost'].map((field) => (
                      <td key={field} className="px-4 py-3 text-center">
                        {r.present ? (
                          <input
                            type="number" min="0" max="100"
                            value={r[field] || 0}
                            onChange={(e) => updateResult(p.id, field, Number(e.target.value))}
                            className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                          />
                        ) : '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <label className="flex items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          checked={r.uniformPenalty < 0}
                          onChange={(e) => updateResult(p.id, 'uniformPenalty', e.target.checked ? -20 : 0)}
                          className="rounded border-neutral-300 text-[#9B2D3E] focus:ring-[#9B2D3E]"
                        />
                        <span className="text-xs text-red-600 font-medium">-20</span>
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Definição de duplas */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100">
          <h2 className="font-semibold text-neutral-900">Duplas</h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Associe cada participante ao seu parceiro de dupla. Afecta o pódio da última etapa.
          </p>
        </div>
        <div className="divide-y divide-neutral-100">
          {presentParticipants.length === 0 && (
            <p className="px-5 py-8 text-sm text-neutral-500 text-center">Nenhum participante presente.</p>
          )}
          {presentParticipants.map((p) => {
            const partnerId = pairs[p.id] || '';
            const partner = participants.find((x) => x.id === partnerId);
            const court = courtLabels[p.id] || '';
            return (
              <div key={p.id} className="px-5 py-3 flex items-center gap-4 flex-wrap">
                <span className="w-36 font-medium text-neutral-900 text-sm truncate">{p.name}</span>
                <span className="text-neutral-400 text-xs">+</span>
                <select
                  value={partnerId}
                  onChange={(e) => setPartner(p.id, e.target.value || null)}
                  className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] w-44"
                >
                  <option value="">— sem parceiro —</option>
                  {presentParticipants
                    .filter((x) => x.id !== p.id)
                    .map((x) => (
                      <option key={x.id} value={x.id}>{x.name}</option>
                    ))}
                </select>
                <input
                  type="text"
                  placeholder="Quadra (ex: Quadra 5)"
                  value={court}
                  onChange={(e) => setCourtLabel(p.id, e.target.value)}
                  className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] w-44"
                />
                {partner && (
                  <span className="text-xs text-emerald-600 font-medium">
                    ✓ {p.name} + {partner.name}{court ? ` — ${court}` : ''}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Jogos section */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-neutral-900">Jogos</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Resultados de cada jogo entre duplas. Salve as duplas primeiro para habilitar.</p>
          </div>
          {hasPairs && (
            <button
              onClick={handleSaveMatches}
              disabled={matchSaving}
              className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {matchSaving ? 'Salvando...' : 'Salvar jogos'}
            </button>
          )}
        </div>

        {matchMessage && (
          <div className={`mx-5 mt-4 p-3 rounded-xl text-sm ${matchMessage.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
            {matchMessage}
          </div>
        )}

        {!hasPairs ? (
          <p className="px-5 py-8 text-sm text-neutral-400 text-center">Defina as duplas e salve os resultados para registrar os jogos.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {Object.entries(pairsByCourt).map(([court, pairsInCourt]) => {
              const courtMatches = matches.filter(m => m.courtLabel === court);
              return (
                <div key={court} className="px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-neutral-600 uppercase tracking-wide">{court}</p>
                    <button
                      onClick={() => addMatchRow(court, pairsInCourt)}
                      className="text-xs text-[#9B2D3E] hover:text-[#8B2942] font-medium"
                    >
                      + Adicionar jogo
                    </button>
                  </div>
                  {courtMatches.length === 0 && (
                    <p className="text-xs text-neutral-400 py-2">Nenhum jogo registrado. Clique em "+ Adicionar jogo".</p>
                  )}
                  <div className="space-y-2">
                    {courtMatches.map((m) => (
                      <div key={m.tempId} className="flex items-center gap-2 flex-wrap">
                        <select
                          value={m.pairAId}
                          onChange={e => updateMatch(m.tempId, 'pairAId', e.target.value)}
                          className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 w-44"
                        >
                          {pairsInCourt.map(p => <option key={p.pairId} value={p.pairId}>{p.label}</option>)}
                        </select>
                        <input
                          type="number" min="0" max="99"
                          value={m.scoreA}
                          onChange={e => updateMatch(m.tempId, 'scoreA', Number(e.target.value))}
                          className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-[#9B2D3E]/30"
                        />
                        <span className="text-neutral-400 text-sm font-medium">×</span>
                        <input
                          type="number" min="0" max="99"
                          value={m.scoreB}
                          onChange={e => updateMatch(m.tempId, 'scoreB', Number(e.target.value))}
                          className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-[#9B2D3E]/30"
                        />
                        <select
                          value={m.pairBId}
                          onChange={e => updateMatch(m.tempId, 'pairBId', e.target.value)}
                          className="border border-neutral-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 w-44"
                        >
                          {pairsInCourt.map(p => <option key={p.pairId} value={p.pairId}>{p.label}</option>)}
                        </select>
                        <button
                          onClick={() => removeMatchRow(m.tempId)}
                          className="text-red-400 hover:text-red-600 text-xs font-medium"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
