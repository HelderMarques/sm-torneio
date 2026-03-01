import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';

const statusOptions = [
  { value: 'SCHEDULED', label: 'Agendada' },
  { value: 'COMPLETED', label: 'Realizada' },
  { value: 'CANCELLED', label: 'Cancelada' },
];

export default function Calendario() {
  const { slug, tournament, tApi } = useTournament();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ number: 1, date: '', group: 'F' });
  const [savingId, setSavingId] = useState(null);
  const [editState, setEditState] = useState({}); // roundId -> { date, status }

  const load = () => {
    tApi.get('/rounds?group=F')
      .then((res) => setRounds(res.data))
      .catch(() => setMessage('Erro ao carregar etapas'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [slug]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.date) {
      setMessage('Escolha a data da etapa.');
      return;
    }
    const num = availableNumbers.includes(form.number) ? form.number : (availableNumbers[0] ?? form.number);
    try {
      await tApi.post('/rounds', {
        number: parseInt(num, 10),
        date: form.date,
        group: form.group,
      });
      setMessage('Etapa adicionada.');
      setShowForm(false);
      setForm({ number: 1, date: '', group: 'F' });
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const getEdit = (round) => ({
    date: editState[round.id]?.date ?? round.date,
    status: editState[round.id]?.status ?? round.status,
  });

  const setEdit = (roundId, field, value) => {
    setEditState((prev) => ({
      ...prev,
      [roundId]: { ...prev[roundId], [field]: value },
    }));
  };

  const handleSaveRound = async (round) => {
    const { date, status } = getEdit(round);
    if (date === round.date && status === round.status) return;
    setSavingId(round.id);
    try {
      await tApi.put(`/rounds/${round.id}`, { date, status });
      setMessage('Etapa atualizada.');
      setEditState((prev) => {
        const next = { ...prev };
        delete next[round.id];
        return next;
      });
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingId(null);
    }
  };

  const totalRounds = tournament?.totalRounds ?? 9;
  const usedNumbers = rounds.map((r) => r.number);
  const availableNumbers = Array.from({ length: totalRounds }, (_, i) => i + 1).filter((n) => !usedNumbers.includes(n));

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
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Calendário do Torneio</h1>
        <Link to={`/admin/t/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">← Dashboard</Link>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm ${message.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Nova etapa</h2>
        {showForm ? (
          <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Número da etapa</label>
              <select
                value={availableNumbers.includes(form.number) ? form.number : (availableNumbers[0] ?? '')}
                onChange={(e) => setForm({ ...form, number: parseInt(e.target.value, 10) })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
              >
                {availableNumbers.length === 0 ? (
                  <option value="">Todas criadas</option>
                ) : (
                  availableNumbers.map((n) => (
                    <option key={n} value={n}>{n}ª</option>
                  ))
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Data</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={availableNumbers.length === 0 || !form.date} className="bg-[#9B2D3E] hover:bg-[#8B2942] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium">
                Adicionar
              </button>
              <button type="button" onClick={() => { setShowForm(false); setForm({ number: 1, date: '', group: 'F' }); }} className="text-neutral-500 text-sm font-medium hover:text-neutral-700">
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
        {availableNumbers.length === 0 && rounds.length > 0 && (
          <p className="text-sm text-neutral-500 mt-2">Todas as {totalRounds} etapas já foram criadas.</p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">Etapas — Grupo Feminino</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {rounds.length === 0 ? (
            <div className="p-8 text-center text-neutral-500 text-sm">Nenhuma etapa no calendário. Adicione a primeira acima.</div>
          ) : (
            rounds.map((round) => {
              const { date, status } = getEdit(round);
              const changed = date !== round.date || status !== round.status;
              return (
                <div key={round.id} className="p-4 flex flex-wrap items-center gap-4 hover:bg-neutral-50/50">
                  <span className="bg-[#9B2D3E] text-white w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold">
                    {round.number}
                  </span>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setEdit(round.id, 'date', e.target.value)}
                      className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                    />
                    <select
                      value={status}
                      onChange={(e) => setEdit(round.id, 'status', e.target.value)}
                      className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                    >
                      {statusOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {changed && (
                      <button
                        type="button"
                        onClick={() => handleSaveRound(round)}
                        disabled={savingId === round.id}
                        className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942] disabled:opacity-50"
                      >
                        {savingId === round.id ? 'Salvando...' : 'Salvar'}
                      </button>
                    )}
                  </div>
                  <Link
                    to={`/admin/t/${slug}/etapa/${round.id}`}
                    className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium shrink-0"
                  >
                    {round.status === 'COMPLETED' ? 'Editar resultados' : 'Registrar'}
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
