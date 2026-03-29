import { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTournament } from '../../hooks/useTournament';
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

export default function Dashboard() {
  const { user } = useAuth();
  const { tournament, slug } = useTournament();
  const isMaster = user?.role === 'MASTER';

  // ── Feature flags ──────────────────────────────────────────
  const [toggling, setToggling] = useState(false);

  const toggle = async (field, currentValue) => {
    setToggling(true);
    const token = localStorage.getItem('sm_token');
    await fetch(`/api/tournaments/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [field]: !currentValue }),
    });
    window.location.reload();
  };

  const toggleSimulate = () => toggle('simulateEnabled', tournament?.simulateEnabled);

  // ── User management (master only) ─────────────────────────
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [resendingId, setResendingId] = useState(null);
  const [userMsg, setUserMsg] = useState('');
  const [userErr, setUserErr] = useState('');

  const flash = (setFn, msg, ms = 5000) => {
    setFn(msg);
    setTimeout(() => setFn(''), ms);
  };

  const loadUsers = () => {
    if (!isMaster) return;
    setUsersLoading(true);
    api.get('/admin/users')
      .then((r) => setUsers(r.data))
      .catch(() => flash(setUserErr, 'Erro ao carregar usuários.'))
      .finally(() => setUsersLoading(false));
  };

  useEffect(() => { loadUsers(); }, [isMaster]);

  const handleInvite = async (e) => {
    e.preventDefault();
    setUserErr(''); setUserMsg('');
    setInviting(true);
    try {
      await api.post('/admin/users', { email: inviteEmail, name: inviteName || undefined });
      flash(setUserMsg, `Convite registrado para ${inviteEmail}. O email será enviado em instantes.`);
      setInviteEmail(''); setInviteName('');
      loadUsers();
    } catch (err) {
      flash(setUserErr, err.response?.data?.error || 'Erro ao enviar convite.');
    } finally {
      setInviting(false);
    }
  };

  const resendInvite = async (id, email) => {
    setUserErr(''); setUserMsg('');
    setResendingId(id);
    try {
      await api.post(`/admin/users/${id}/resend-invite`);
      flash(setUserMsg, `Convite reenviado para ${email}.`);
    } catch (err) {
      flash(setUserErr, err.response?.data?.error || 'Erro ao reenviar convite.');
    } finally {
      setResendingId(null);
    }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Excluir "${u.name}" (${u.email})? Esta ação não pode ser desfeita.`)) return;
    setUserErr(''); setUserMsg('');
    try {
      await api.delete(`/admin/users/${u.id}`);
      flash(setUserMsg, `Usuário ${u.name} excluído.`);
      loadUsers();
    } catch (err) {
      flash(setUserErr, err.response?.data?.error || 'Erro ao excluir usuário.');
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setUserErr(''); setUserMsg('');
    try {
      await api.patch(`/admin/users/${u.id}/status`, { status: newStatus });
      loadUsers();
    } catch (err) {
      setUserErr(err.response?.data?.error || 'Erro ao alterar status.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Configurações</h1>
        <p className="text-sm text-neutral-500 mt-0.5">{tournament?.name}</p>
      </div>

      {/* ── Funcionalidades ───────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
          Funcionalidades
        </h2>
        <div className="bg-white rounded-2xl border border-neutral-200/80 divide-y divide-neutral-100">
          {[
            {
              field: 'simulateEnabled',
              label: 'Simular etapa',
              desc: 'Exibe o botão "Simular etapa" na página pública do torneio',
              value: tournament?.simulateEnabled,
              onToggle: toggleSimulate,
            },
            {
              field: 'testResultEnabled',
              label: 'Teste Resultado Etapa',
              desc: 'Botão de geração automática de duplas e resultados na tela de entrada de etapa (apenas admin)',
              value: tournament?.testResultEnabled,
              onToggle: () => toggle('testResultEnabled', tournament?.testResultEnabled),
            },
          ].map(({ field, label, desc, value, onToggle }) => (
            <div key={field} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-neutral-900 text-sm">{label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={onToggle}
                disabled={toggling}
                aria-label={`Toggle ${label}`}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
                  value ? 'bg-[#9B2D3E]' : 'bg-neutral-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    value ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Gestão de usuários (master only) ─────────────────── */}
      {isMaster && (
        <section>
          <h2 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
            Gestão de Usuários
          </h2>

          {/* Feedback */}
          {userMsg && (
            <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl">
              {userMsg}
            </div>
          )}
          {userErr && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl">
              {userErr}
            </div>
          )}

          {/* Invite form */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 mb-4">
            <p className="font-medium text-neutral-900 text-sm mb-3">Convidar novo administrador</p>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2.5">
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
                className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-5 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 shrink-0"
              >
                {inviting ? 'Enviando…' : 'Convidar'}
              </button>
            </form>
            <p className="text-xs text-neutral-400 mt-2">
              O convidado receberá um link válido por 72 horas para definir sua senha.
            </p>
          </div>

          {/* Users list */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-neutral-100 bg-neutral-50/50">
              <p className="font-semibold text-neutral-900 text-sm">Administradores</p>
            </div>
            {usersLoading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-neutral-200 border-t-neutral-500" />
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {users.map((u) => (
                  <div key={u.id} className="px-5 py-3.5 flex items-center gap-3">
                    {/* Avatar */}
                    <div className="shrink-0 w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-500">
                      {u.name?.[0]?.toUpperCase() || '?'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-medium text-neutral-900 text-sm truncate">{u.name}</p>
                        {u.role === 'MASTER' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#9B2D3E]/10 text-[#9B2D3E] font-semibold">
                            Master
                          </span>
                        )}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_CLS[u.status]}`}>
                          {STATUS_LABEL[u.status]}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-400 truncate">{u.email}</p>
                      {u.lastLoginAt && (
                        <p className="text-[10px] text-neutral-300 mt-0.5">
                          Último acesso: {fmtDate(u.lastLoginAt)}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    {u.role !== 'MASTER' && (
                      <div className="shrink-0 flex items-center gap-2">
                        {u.status === 'PENDING' && (
                          <button
                            onClick={() => resendInvite(u.id, u.email)}
                            disabled={resendingId === u.id}
                            className="text-xs text-neutral-500 hover:text-[#9B2D3E] font-medium px-3 py-1.5 border border-neutral-200 rounded-lg disabled:opacity-50"
                          >
                            {resendingId === u.id ? 'Enviando…' : 'Reenviar convite'}
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
                        <button
                          onClick={() => deleteUser(u)}
                          className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1.5"
                          title="Excluir usuário"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
