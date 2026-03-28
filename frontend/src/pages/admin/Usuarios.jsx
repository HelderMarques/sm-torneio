import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../api/client';

const STATUS_LABEL = { ACTIVE: 'Ativo', PENDING: 'Pendente', INACTIVE: 'Inativo' };
const STATUS_CLS = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  INACTIVE: 'bg-neutral-100 text-neutral-400',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function Usuarios() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (user?.role !== 'MASTER') return <Navigate to="/admin" replace />;

  const load = () => {
    setLoading(true);
    api.get('/admin/users')
      .then((r) => setUsers(r.data))
      .catch(() => setError('Erro ao carregar usuários.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setError(''); setMessage('');
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await api.post('/admin/users', { email: inviteEmail, name: inviteName || undefined });
      setMessage(`Convite enviado para ${inviteEmail}`);
      setInviteEmail(''); setInviteName('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao enviar convite.');
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (id) => {
    setError(''); setMessage('');
    try {
      await api.post(`/admin/users/${id}/resend-invite`);
      setMessage('Convite reenviado.');
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao reenviar convite.');
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setError(''); setMessage('');
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status: newStatus });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao alterar status.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Usuários</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Gerenciar administradores do painel</p>
        </div>
        <Link to="/admin/tournaments" className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">
          ← Painel
        </Link>
      </div>

      {/* Feedback */}
      {message && (
        <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl">
          {message}
        </div>
      )}
      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Convite */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 mb-6">
        <h2 className="font-semibold text-neutral-900 mb-4">Convidar novo administrador</h2>
        <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Nome (opcional)"
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50"
          />
          <input
            type="email"
            placeholder="E-mail *"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            required
            className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#9B2D3E]/50"
          />
          <button
            type="submit"
            disabled={inviting}
            className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-6 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 shrink-0"
          >
            {inviting ? 'Enviando…' : 'Convidar'}
          </button>
        </form>
        <p className="text-xs text-neutral-400 mt-2">
          O convidado receberá um link por e-mail válido por 72 horas para definir sua senha.
        </p>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">Administradores</h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-200 border-t-neutral-500" />
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {users.map((u) => (
              <div key={u.id} className="p-4 flex items-center gap-4">
                {/* Avatar */}
                <div className="shrink-0 w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-semibold text-neutral-500">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-neutral-900 text-sm truncate">{u.name}</p>
                    {u.role === 'MASTER' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#9B2D3E]/10 text-[#9B2D3E] font-semibold">
                        Master
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_CLS[u.status]}`}>
                      {STATUS_LABEL[u.status]}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5 truncate">{u.email}</p>
                  <p className="text-xs text-neutral-300 mt-0.5">
                    Cadastrado: {fmtDate(u.createdAt)}
                    {u.lastLoginAt && ` · Último acesso: ${fmtDate(u.lastLoginAt)}`}
                  </p>
                </div>

                {/* Actions */}
                {u.role !== 'MASTER' && (
                  <div className="shrink-0 flex items-center gap-2">
                    {u.status === 'PENDING' && (
                      <button
                        onClick={() => resendInvite(u.id)}
                        className="text-xs text-neutral-500 hover:text-[#9B2D3E] font-medium px-3 py-1.5 border border-neutral-200 rounded-lg"
                      >
                        Reenviar convite
                      </button>
                    )}
                    {u.status !== 'PENDING' && (
                      <button
                        onClick={() => toggleStatus(u)}
                        className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                          u.status === 'ACTIVE'
                            ? 'text-red-600 border-red-100 hover:bg-red-50'
                            : 'text-emerald-600 border-emerald-100 hover:bg-emerald-50'
                        }`}
                      >
                        {u.status === 'ACTIVE' ? 'Desativar' : 'Reativar'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
