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

/** Torneio de duplas: 2 vagas por colocação (1º a 7º) */
const SLOTS_PER_POSITION = 2;

export default function EtapaDetail() {
  const { id } = useParams();
  const { slug, tApi } = useTournament();
  const [round, setRound] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [results, setResults] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

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
        }
      }

      for (const p of groupParticipants) {
        if (!existingResults[p.id]) {
          existingResults[p.id] = {
            present: true,
            absentReason: 'NONE',
            position: null,
            setsWon: 0,
            setsLost: 0,
            gamesWon: 0,
            gamesLost: 0,
            uniformPenalty: 0,
          };
        }
      }
      setResults(existingResults);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [id, slug]);

  const updateResult = (participantId, field, value) => {
    setResults((prev) => ({
      ...prev,
      [participantId]: { ...prev[participantId], [field]: value },
    }));
  };

  // Conta quantas participantes presentes estão em cada colocação (para duplas: máx 2 por posição)
  const countByPosition = () => {
    const count = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    participants.forEach((p) => {
      const r = results[p.id] || {};
      if (r.present && r.position && count[r.position] !== undefined) {
        count[r.position]++;
      }
    });
    return count;
  };

  // Para uma participante, quais colocações ainda aparecem no select (2 vagas por posição)
  const getAvailablePositionsFor = (participantId, currentPosition) => {
    const count = countByPosition();
    return POSITIONS.filter((pos) => {
      const used = count[pos.value] || 0;
      const isCurrent = currentPosition === pos.value;
      return isCurrent || used < SLOTS_PER_POSITION;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
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

      <p className="text-neutral-500 text-sm mb-4">
        Torneio de duplas: cada colocação (1º a 7º) tem 2 vagas. As opções já preenchidas somem do seletor.
      </p>

      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
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
                      <option value="SORTEIO">Sorteada (80pts)</option>
                      <option value="SORTEIO_VOLUNTARIA">Voluntária (60pts)</option>
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
                        {getAvailablePositionsFor(p.id, r.position || null).map((pos) => (
                          <option key={pos.value} value={pos.value}>{pos.label}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.present ? (
                      <input
                        type="number" min="0" max="20"
                        value={r.setsWon || 0}
                        onChange={(e) => updateResult(p.id, 'setsWon', Number(e.target.value))}
                        className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                      />
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.present ? (
                      <input
                        type="number" min="0" max="20"
                        value={r.setsLost || 0}
                        onChange={(e) => updateResult(p.id, 'setsLost', Number(e.target.value))}
                        className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                      />
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.present ? (
                      <input
                        type="number" min="0" max="100"
                        value={r.gamesWon || 0}
                        onChange={(e) => updateResult(p.id, 'gamesWon', Number(e.target.value))}
                        className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                      />
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.present ? (
                      <input
                        type="number" min="0" max="100"
                        value={r.gamesLost || 0}
                        onChange={(e) => updateResult(p.id, 'gamesLost', Number(e.target.value))}
                        className="border border-neutral-200 rounded-lg w-14 text-center px-1 py-1.5 text-xs focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                      />
                    ) : '—'}
                  </td>
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
  );
}
