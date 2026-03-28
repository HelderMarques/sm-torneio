import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTournament } from '../../hooks/useTournament';
import { useAdminGroup } from '../../hooks/useAdminGroup';
import GroupToggle from '../../components/GroupToggle';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { tournament, slug, tApi } = useTournament();
  const { group, setGroup } = useAdminGroup();
  const [rounds, setRounds] = useState([]);
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    Promise.all([
      tApi.get('/rounds'),
      tApi.get('/participants'),
    ]).then(([rRes, pRes]) => {
      setRounds(rRes.data);
      setParticipants(pRes.data);
    });
  }, [slug]);

  const groupRounds = rounds.filter((r) => r.group === group);
  const completedRounds = groupRounds.filter((r) => r.status === 'COMPLETED').length;
  const groupParticipants = participants.filter((p) => p.group === group).length;

  const isMaster = user?.role === 'MASTER';

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{tournament?.name} — Bem-vindo, {user?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/admin/tournaments" className="text-sm text-neutral-400 hover:text-neutral-700 font-medium">
            ← Trocar torneio
          </Link>
          <Link to={`/t/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">
            Ver site
          </Link>
          <button onClick={logout} className="text-sm text-red-600 hover:text-red-700 font-medium">
            Sair
          </button>
        </div>
      </div>

      {/* Seletor de categoria */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-neutral-500 font-medium">Categoria:</span>
        <GroupToggle group={group} onChange={setGroup} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{groupParticipants}</p>
          <p className="text-xs text-neutral-500 mt-1">Participantes ({group === 'F' ? 'Feminino' : 'Masculino'})</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 text-center">
          <p className="text-2xl font-semibold text-emerald-600">{completedRounds}</p>
          <p className="text-xs text-neutral-500 mt-1">Etapas Realizadas</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 text-center">
          <p className="text-2xl font-semibold text-neutral-600">{(tournament?.totalRounds || 9) - completedRounds}</p>
          <p className="text-xs text-neutral-500 mt-1">Etapas Restantes</p>
        </div>
      </div>

      {/* Actions */}
      <div className={`grid gap-4 mb-8 ${isMaster ? 'md:grid-cols-5' : 'md:grid-cols-4'}`}>
        <Link
          to={`/admin/t/${slug}/classificacao`}
          className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block"
        >
          <h3 className="font-semibold text-neutral-900 mb-1">Editar Classificação</h3>
          <p className="text-sm text-neutral-500">Ajustar pontos, participações e estatísticas de cada atleta.</p>
        </Link>
        <Link
          to={`/admin/t/${slug}/calendario`}
          className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block"
        >
          <h3 className="font-semibold text-neutral-900 mb-1">Calendário</h3>
          <p className="text-sm text-neutral-500">Definir datas e status das etapas (compartilhado entre categorias)</p>
        </Link>
        <Link
          to={`/admin/t/${slug}/etapas`}
          className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block"
        >
          <h3 className="font-semibold text-neutral-900 mb-1">Registrar Resultados</h3>
          <p className="text-sm text-neutral-500">Registrar colocação, sets e games de uma etapa</p>
        </Link>
        <Link
          to={`/admin/t/${slug}/participantes`}
          className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block"
        >
          <h3 className="font-semibold text-neutral-900 mb-1">Gerenciar Participantes</h3>
          <p className="text-sm text-neutral-500">Adicionar, editar ou desativar participantes</p>
        </Link>
        {isMaster && (
          <Link
            to="/admin/usuarios"
            className="bg-white rounded-2xl p-6 border border-[#9B2D3E]/20 hover:shadow-md hover:border-[#9B2D3E]/40 transition-all block"
          >
            <h3 className="font-semibold text-[#9B2D3E] mb-1">Usuários</h3>
            <p className="text-sm text-neutral-500">Convidar e gerenciar administradores do painel</p>
          </Link>
        )}
      </div>

      {/* Feature flags */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden mb-8">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">Funcionalidades</h2>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900 text-sm">Simular etapa</p>
              <p className="text-xs text-neutral-500 mt-0.5">Exibe o botão "Simular etapa" na página inicial</p>
            </div>
            <button
              onClick={async () => {
                const token = localStorage.getItem('sm_token');
                await fetch(`/api/tournaments/${slug}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ simulateEnabled: !tournament?.simulateEnabled }),
                });
                window.location.reload();
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${tournament?.simulateEnabled ? 'bg-[#9B2D3E]' : 'bg-neutral-200'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${tournament?.simulateEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Recent rounds */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">
            Etapas — {group === 'F' ? 'Feminino' : 'Masculino'}
          </h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {groupRounds.map((round) => (
            <div key={round.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50">
              <div>
                <span className="font-medium text-neutral-900">{round.number}ª Etapa</span>
                <span className="text-sm text-neutral-500 ml-2">
                  {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  round.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                  round.status === 'CANCELLED' ? 'bg-red-50 text-red-700' :
                  'bg-neutral-100 text-neutral-600'
                }`}>
                  {round.status === 'COMPLETED' ? 'Realizada' :
                   round.status === 'CANCELLED' ? 'Cancelada' : 'Agendada'}
                </span>
                <Link
                  to={`/admin/t/${slug}/etapa/${round.id}`}
                  className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942]"
                >
                  {round.status === 'COMPLETED' ? 'Editar' : 'Registrar'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
