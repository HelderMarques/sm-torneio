import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom'; // mantido para o link ← Dashboard
import { useTournament } from '../../hooks/useTournament';

const statusOptions = [
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'COMPLETED', label: 'Realizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export default function Calendario() {
  const { slug, tournament, tApi } = useTournament();
  // roundsF and roundsM are kept separate to allow individual PUT calls
  const [roundsF, setRoundsF] = useState([]);
  const [roundsM, setRoundsM] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState('');
  const [savingNum, setSavingNum] = useState(null);
  const [editState, setEditState] = useState({}); // roundNumber -> { date, status }

  const load = () => {
    setLoading(true);
    Promise.all([tApi.get('/rounds?group=F'), tApi.get('/rounds?group=M')])
      .then(([fRes, mRes]) => {
        setRoundsF(fRes.data);
        setRoundsM(mRes.data);
      })
      .catch(() => setMessage('Erro ao carregar etapas'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug]);

  // Merge both groups into a single list keyed by round number
  const mergedNumbers = [...new Set([...roundsF, ...roundsM].map((r) => r.number))].sort((a, b) => a - b);
  const byNumber = (num, group) =>
    (group === 'F' ? roundsF : roundsM).find((r) => r.number === num);

  const totalRounds = tournament?.totalRounds ?? 9;
  const usedNumbers = mergedNumbers;
  const availableNumbers = Array.from({ length: totalRounds }, (_, i) => i + 1).filter(
    (n) => !usedNumbers.includes(n)
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formDate) { setMessage('Escolha a data da etapa.'); return; }
    const num = availableNumbers[0];
    if (!num) return;
    try {
      // Create for both groups simultaneously
      await Promise.all([
        tApi.post('/rounds', { number: num, date: formDate, group: 'F' }),
        tApi.post('/rounds', { number: num, date: formDate, group: 'M' }),
      ]);
      setMessage('Etapa adicionada para Feminino e Masculino.');
      setShowForm(false);
      setFormDate('');
      load();
      setTimeout(() => setMessage(''), 4000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const getEdit = (num) => {
    // Use the F round as the source of truth for date/status display
    const ref = byNumber(num, 'F') || byNumber(num, 'M');
    return {
      date: editState[num]?.date ?? ref?.date ?? '',
      status: editState[num]?.status ?? ref?.status ?? 'SCHEDULED',
    };
  };

  const setEdit = (num, field, value) => {
    setEditState((prev) => ({ ...prev, [num]: { ...getEdit(num), [field]: value } }));
  };

  const handleSave = async (num) => {
    const { date, status } = getEdit(num);
    const rf = byNumber(num, 'F');
    const rm = byNumber(num, 'M');
    if (!rf && !rm) return;
    setSavingNum(num);
    try {
      const updates = [];
      if (rf) updates.push(tApi.put(`/rounds/${rf.id}`, { date, status }));
      if (rm) updates.push(tApi.put(`/rounds/${rm.id}`, { date, status }));
      await Promise.all(updates);
      setMessage('Etapa atualizada.');
      setEditState((prev) => { const next = { ...prev }; delete next[num]; return next; });
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingNum(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Calendário do Torneio</h1>
          <p className="text-xs text-neutral-400 mt-0.5">Datas e status compartilhados entre Feminino e Masculino</p>
        </div>
        <Link to={`/admin/t/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">← Dashboard</Link>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm ${message.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
          {message}
        </div>
      )}

      {/* Nova etapa */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-1">Nova etapa</h2>
        <p className="text-xs text-neutral-400 mb-4">Cria a etapa {availableNumbers[0] ? `${availableNumbers[0]}ª` : ''} para Feminino e Masculino ao mesmo tempo.</p>
        {showForm ? (
          <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Número</label>
              <div className="border border-neutral-200 rounded-xl px-4 py-2 text-sm bg-neutral-50 text-neutral-600">
                {availableNumbers[0] ?? '—'}ª
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Data</label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={availableNumbers.length === 0 || !formDate}
                className="bg-[#9B2D3E] hover:bg-[#8B2942] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                Adicionar
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setFormDate(''); }}
                className="text-neutral-500 text-sm font-medium hover:text-neutral-700"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            disabled={availableNumbers.length === 0}
            className="bg-[#9B2D3E] hover:bg-[#8B2942] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            + Nova etapa
          </button>
        )}
        {availableNumbers.length === 0 && mergedNumbers.length > 0 && (
          <p className="text-sm text-neutral-500 mt-2">Todas as {totalRounds} etapas já foram criadas.</p>
        )}
      </div>

      {/* Lista unificada */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">Etapas</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {mergedNumbers.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-sm">Nenhuma etapa no calendário. Adicione a primeira acima.</div>
          ) : (
            mergedNumbers.map((num) => {
              const { date, status } = getEdit(num);
              const rf = byNumber(num, 'F');
              const rm = byNumber(num, 'M');
              const ref = rf || rm;
              const changed = date !== ref?.date || status !== ref?.status;
              return (
                <div key={num} className="p-4 flex flex-wrap items-center gap-4 hover:bg-neutral-50/50">
                  <span className="bg-[#9B2D3E] text-white w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0">
                    {num}
                  </span>
                  <div className="flex items-center gap-3 flex-1 min-w-0 flex-wrap">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setEdit(num, 'date', e.target.value)}
                      className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                    />
                    <select
                      value={status}
                      onChange={(e) => setEdit(num, 'status', e.target.value)}
                      className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                    >
                      {statusOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {changed && (
                      <button
                        type="button"
                        onClick={() => handleSave(num)}
                        disabled={savingNum === num}
                        className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942] disabled:opacity-50"
                      >
                        {savingNum === num ? 'Salvando...' : 'Salvar'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
