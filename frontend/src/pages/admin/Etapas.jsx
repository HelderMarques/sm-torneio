import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../../hooks/useTournament';
import { useAdminGroup } from '../../hooks/useAdminGroup';
import GroupToggle from '../../components/GroupToggle';

export default function Etapas() {
  const { slug, tApi } = useTournament();
  const { group, setGroup } = useAdminGroup();
  const [rounds, setRounds] = useState([]);

  useEffect(() => {
    tApi.get(`/rounds?group=${group}`).then((res) => setRounds(res.data));
  }, [slug, group]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight">Registrar Resultados</h1>
        <Link to={`/admin/t/${slug}`} className="text-sm text-neutral-500 hover:text-neutral-900 font-medium">← Dashboard</Link>
      </div>
      <div className="mb-6">
        <GroupToggle group={group} onChange={setGroup} />
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200/80 divide-y divide-neutral-100 overflow-hidden">
        {rounds.map((round) => (
          <div key={round.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
            <div>
              <p className="font-medium text-neutral-900">{round.number}ª Etapa</p>
              <p className="text-sm text-neutral-500">
                {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                  weekday: 'long', day: '2-digit', month: 'long',
                })}
              </p>
            </div>
            <div className="flex items-center gap-3">
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
                className="bg-[#9B2D3E] hover:bg-[#8B2942] text-white px-4 py-2 rounded-xl text-sm font-medium"
              >
                {round.status === 'COMPLETED' ? 'Editar' : 'Registrar'}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
