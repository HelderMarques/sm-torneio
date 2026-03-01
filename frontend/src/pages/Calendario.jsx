import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTournament } from '../hooks/useTournament';

const statusMap = {
  SCHEDULED: { label: 'Agendada', color: 'bg-neutral-100 text-neutral-700' },
  COMPLETED: { label: 'Realizada', color: 'bg-emerald-50 text-emerald-700' },
  CANCELLED: { label: 'Cancelada', color: 'bg-red-50 text-red-700' },
};

export default function Calendario() {
  const { tournament, slug, tApi } = useTournament();
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tApi.get('/rounds?group=F')
      .then((res) => setRounds(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-semibold text-neutral-900 tracking-tight mb-2">
        Calendário — Temporada {tournament?.year}
      </h1>
      <p className="text-neutral-500 text-sm mb-8">{tournament?.totalRounds} etapas</p>

      <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
        <div className="divide-y divide-neutral-100">
          {rounds.map((round) => {
            const status = statusMap[round.status];
            return (
              <div key={round.id} className="p-4 flex items-center justify-between hover:bg-neutral-50/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="bg-[#9B2D3E] text-white w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold">
                    {round.number}
                  </span>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {round.number}ª Etapa
                    </p>
                    <p className="text-sm text-neutral-500">
                      {new Date(round.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                        weekday: 'long', day: '2-digit', month: 'long',
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                  {round.status === 'COMPLETED' && (
                    <Link to={`/t/${slug}/etapa/${round.id}`} className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942]">
                      Ver →
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
