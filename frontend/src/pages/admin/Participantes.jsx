import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';

export default function Participantes() {
  const { slug, tApi } = useTournament();
  const [participants, setParticipants] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', group: 'F' });
  const [bulkNames, setBulkNames] = useState('');
  const [message, setMessage] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const load = () => {
    tApi.get('/participants?group=F').then((res) => setParticipants(res.data));
  };

  useEffect(load, [slug]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        await tApi.put(`/participants/${editId}`, form);
        setMessage('Participante atualizado');
      } else {
        await tApi.post('/participants', form);
        setMessage('Participante adicionado');
      }
      setShowForm(false);
      setEditId(null);
      setForm({ name: '', group: 'F' });
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    const trimmed = bulkNames.trim();
    if (!trimmed) {
      setMessage('Digite pelo menos um nome (separados por vírgula).');
      setTimeout(() => setMessage(''), 3000);
      return;
    }
    setBulkLoading(true);
    try {
      const res = await tApi.post('/participants/bulk', { names: trimmed, group: 'F' });
      setMessage(`${res.data.created} participante(s) adicionado(s).`);
      setBulkNames('');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setBulkLoading(false);
    }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({ name: p.name, group: p.group });
    setShowForm(true);
  };

  const handleDelete = async (p) => {
    if (!window.confirm(`Excluir "${p.name}"? Os resultados desta participante nas etapas também serão removidos.`)) return;
    setDeletingId(p.id);
    try {
      await tApi.delete(`/participants/${p.id}`);
      setMessage('Participante excluída');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleActive = async (p) => {
    await tApi.put(`/participants/${p.id}`, { active: !p.active });
    load();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Gerenciar Participantes</h1>
        <div className="flex gap-3">
          <Link to={`/admin/t/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">← Dashboard</Link>
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', group: 'F' }); }}
            className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            + Novo
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm ${message.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>{message}</div>
      )}

      {showForm && (
        <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-6">
          <h3 className="font-semibold text-neutral-900 mb-4">{editId ? 'Editar' : 'Novo'} Participante</h3>
          <form onSubmit={handleSubmit} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Nome</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                required
              />
            </div>
            <button type="submit" className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium">
              {editId ? 'Salvar' : 'Adicionar'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); }} className="text-neutral-500 text-sm font-medium hover:text-neutral-700">
              Cancelar
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-2">Adicionar vários participantes</h3>
        <p className="text-sm text-neutral-500 mb-3">Digite os nomes separados por vírgula (ou por linha).</p>
        <form onSubmit={handleBulkSubmit} className="flex flex-col gap-3">
          <textarea
            value={bulkNames}
            onChange={(e) => setBulkNames(e.target.value)}
            placeholder="Ex: Ana Silva, Maria Santos, João Oliveira"
            rows={3}
            className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E] resize-y"
          />
          <button
            type="submit"
            disabled={bulkLoading || !bulkNames.trim()}
            className="self-start bg-[#9B2D3E] hover:bg-[#8B2942] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium"
          >
            {bulkLoading ? 'Adicionando...' : 'Adicionar todos'}
          </button>
        </form>
      </div>

      <p className="text-neutral-500 text-sm mb-6">{participants.length} participantes</p>

      <div className="bg-white rounded-2xl border border-neutral-200/80 divide-y divide-neutral-100 overflow-hidden">
        {participants.map((p) => (
          <div key={p.id} className={`p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors ${!p.active ? 'opacity-60' : ''}`}>
            <div>
              <span className="font-medium text-neutral-900">{p.name}</span>
              {!p.active && <span className="ml-2 text-xs text-red-600 font-medium">(Inativo)</span>}
            </div>
            <div className="flex gap-3 items-center">
              <button onClick={() => startEdit(p)} className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942]">
                Editar
              </button>
              <button onClick={() => toggleActive(p)} className={`text-sm font-medium ${p.active ? 'text-red-600 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-700'}`}>
                {p.active ? 'Desativar' : 'Ativar'}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(p)}
                disabled={deletingId === p.id}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
              >
                {deletingId === p.id ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
