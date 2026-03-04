import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/client';
import { useAuth } from '../../hooks/useAuth';

export default function Torneios() {
  const { user, logout } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [newTournament, setNewTournament] = useState({
    name: '',
    slug: '',
    year: new Date().getFullYear(),
    totalRounds: 9,
  });
  const [savingSlug, setSavingSlug] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/tournaments')
      .then((res) => setTournaments(res.data || []))
      .catch(() => setMessage('Erro ao carregar torneios.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTournament.name || !newTournament.slug || !newTournament.year) {
      setMessage('Preencha nome, slug e ano.');
      return;
    }
    setCreating(true);
    try {
      await api.post('/tournaments', {
        ...newTournament,
        year: Number(newTournament.year),
        totalRounds: Number(newTournament.totalRounds) || 9,
      });
      setNewTournament({
        name: '',
        slug: '',
        year: new Date().getFullYear(),
        totalRounds: 9,
      });
      setMessage('Torneio criado com sucesso.');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (slug, updates) => {
    setSavingSlug(slug);
    try {
      await api.put(`/tournaments/${slug}`, updates);
      setMessage('Torneio atualizado.');
      load();
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setSavingSlug(null);
    }
  };

  if (loading && tournaments.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Gerenciar Torneios</h1>
            <p className="text-sm text-neutral-500 mt-0.5">
              Admin global — criar e editar torneios. As ações aqui afetam o site inteiro.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/t/2026" className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">
              Ver site
            </Link>
            <button
              onClick={logout}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sair
            </button>
          </div>
        </div>

        {message && (
          <div className={`p-3 rounded-xl mb-4 text-sm ${message.startsWith('Erro') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-8">
          <h2 className="font-semibold text-neutral-900 mb-3">Novo torneio</h2>
          <form onSubmit={handleCreate} className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Nome</label>
              <input
                value={newTournament.name}
                onChange={(e) => setNewTournament({ ...newTournament, name: e.target.value })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                placeholder="Secos & Molhados 2027"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Slug</label>
              <input
                value={newTournament.slug}
                onChange={(e) => setNewTournament({ ...newTournament, slug: e.target.value })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
                placeholder="2027"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Ano</label>
              <input
                type="number"
                value={newTournament.year}
                onChange={(e) => setNewTournament({ ...newTournament, year: e.target.value })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm w-24 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Total de etapas</label>
              <input
                type="number"
                value={newTournament.totalRounds}
                onChange={(e) => setNewTournament({ ...newTournament, totalRounds: e.target.value })}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm w-28 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Criando...' : 'Criar'}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
          <div className="p-5 border-b border-neutral-100 bg-neutral-50/60 flex items-center justify-between">
            <h2 className="font-semibold text-neutral-900">Torneios</h2>
            <span className="text-xs text-neutral-500">{tournaments.length} torneios</span>
          </div>
          <div className="divide-y divide-neutral-100">
            {tournaments.map((t) => (
              <TorneioRow
                key={t.id}
                tournament={t}
                saving={savingSlug === t.slug}
                onSave={handleUpdate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TorneioRow({ tournament, saving, onSave }) {
  const [local, setLocal] = useState({
    name: tournament.name,
    year: tournament.year,
    totalRounds: tournament.totalRounds,
    status: tournament.status,
  });

  const hasChanges =
    local.name !== tournament.name ||
    Number(local.year) !== tournament.year ||
    Number(local.totalRounds) !== tournament.totalRounds ||
    local.status !== tournament.status;

  const handleSave = () => {
    if (!hasChanges) return;
    onSave(tournament.slug, {
      name: local.name,
      year: Number(local.year),
      totalRounds: Number(local.totalRounds),
      status: local.status,
    });
  };

  return (
    <div className="p-4 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[180px]">
        <div className="flex items-center gap-2">
          <input
            value={local.name}
            onChange={(e) => setLocal({ ...local, name: e.target.value })}
            className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm w-full focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
          />
          <span className="text-[11px] text-neutral-400 px-2 py-1 rounded-full border border-neutral-200 bg-neutral-50">
            slug: {tournament.slug}
          </span>
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-500 mb-1">Ano</label>
        <input
          type="number"
          value={local.year}
          onChange={(e) => setLocal({ ...local, year: e.target.value })}
          className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-500 mb-1">Etapas</label>
        <input
          type="number"
          value={local.totalRounds}
          onChange={(e) => setLocal({ ...local, totalRounds: e.target.value })}
          className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm w-24 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
        />
      </div>
      <div>
        <label className="block text-[11px] font-medium text-neutral-500 mb-1">Status</label>
        <select
          value={local.status}
          onChange={(e) => setLocal({ ...local, status: e.target.value })}
          className="border border-neutral-200 rounded-lg px-3 py-1.5 text-sm w-28 focus:ring-2 focus:ring-[#9B2D3E]/30 focus:border-[#9B2D3E]"
        >
          <option value="ACTIVE">Ativo</option>
          <option value="ARCHIVED">Arquivado</option>
        </select>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Link
          to={`/admin/t/${tournament.slug}`}
          className="text-xs font-medium text-[#9B2D3E] hover:text-[#8B2942]"
        >
          Abrir painel →
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || saving}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-neutral-200 hover:border-[#9B2D3E] disabled:opacity-50"
        >
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

