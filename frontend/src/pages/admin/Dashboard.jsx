import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTournament } from '../../hooks/useTournament';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { tournament, slug, tApi } = useTournament();
  const [rounds, setRounds] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [recalculating, setRecalculating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      tApi.get('/rounds'),
      tApi.get('/participants'),
    ]).then(([rRes, pRes]) => {
      setRounds(rRes.data);
      setParticipants(pRes.data);
    });
  }, [slug]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      const res = await tApi.post('/standings/recalculate');
      setMessage(`Classificação recalculada: ${res.data.F} participantes`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Erro ao recalcular');
    } finally {
      setRecalculating(false);
    }
  };

  const femaleRounds = rounds.filter((r) => r.group === 'F');
  const completedFem = femaleRounds.filter((r) => r.status === 'COMPLETED').length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Painel Administrativo</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{tournament?.name} — Bem-vindo, {user?.name}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            to="/admin/tournaments"
            className="text-sm text-neutral-400 hover:text-neutral-700 font-medium"
          >
            ← Trocar torneio
          </Link>
          <Link
            to={`/t/${slug}`}
            className="text-sm text-neutral-500 hover:text-neutral-900 font-medium"
          >
            Ver site
          </Link>
          <button onClick={logout} className="text-sm text-red-600 hover:text-red-700 font-medium">
            Sair
          </button>
        </div>
      </div>

      {message && (
        <div className="bg-emerald-50 text-emerald-800 p-4 rounded-xl mb-6 text-sm">
          {message}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 text-center">
          <p className="text-2xl font-semibold text-neutral-900">{participants.filter((p) => p.group === 'F').length}</p>
          <p className="text-xs text-neutral-500 mt-1">Participantes</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 text-center">
          <p className="text-2xl font-semibold text-emerald-600">{completedFem}</p>
          <p className="text-xs text-neutral-500 mt-1">Etapas Realizadas</p>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-neutral-200/80 text-center">
          <p className="text-2xl font-semibold text-neutral-600">{(tournament?.totalRounds || 9) - completedFem}</p>
          <p className="text-xs text-neutral-500 mt-1">Etapas Restantes</p>
        </div>
      </div>

      {/* Actions (escopo: torneio atual) */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <Link
          to={`/admin/t/${slug}/calendario`}
          className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block"
        >
          <h3 className="font-semibold text-neutral-900 mb-1">Calendário</h3>
          <p className="text-sm text-neutral-500">Definir datas das etapas e alterar status (agendada/realizada/cancelada)</p>
        </Link>
        <Link to={`/admin/t/${slug}/etapas`} className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block">
          <h3 className="font-semibold text-neutral-900 mb-1">Registrar Resultados</h3>
          <p className="text-sm text-neutral-500">Registrar colocação, sets e games de uma etapa</p>
        </Link>
        <Link to={`/admin/t/${slug}/participantes`} className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all block">
          <h3 className="font-semibold text-neutral-900 mb-1">Gerenciar Participantes</h3>
          <p className="text-sm text-neutral-500">Adicionar, editar ou desativar participantes</p>
        </Link>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="bg-white rounded-2xl p-6 border border-neutral-200/80 hover:shadow-md hover:border-neutral-300/60 transition-all text-left disabled:opacity-50"
        >
          <h3 className="font-semibold text-neutral-900 mb-1">
            {recalculating ? 'Recalculando...' : 'Recalcular Classificação'}
          </h3>
          <p className="text-sm text-neutral-500">Forçar recálculo completo de standings</p>
        </button>
      </div>

      {/* Recent rounds */}
      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
          <h2 className="font-semibold text-neutral-900">Etapas</h2>
        </div>
        <div className="divide-y divide-neutral-100">
          {femaleRounds.map((round) => (
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
