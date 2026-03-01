import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

export default function TorneioPicker() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments')
      .then((res) => setTournaments(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <img src="/logo.png" alt="" className="h-24 w-24 mx-auto mb-6 object-contain" onError={(e) => { e.target.style.display = 'none'; const fallback = e.target.nextElementSibling; if (fallback) fallback.classList.remove('hidden'); }} />
          <span className="hidden h-24 w-24 mx-auto mb-6 rounded-2xl bg-[#9B2D3E] flex items-center justify-center text-white text-3xl font-semibold">TTC</span>
          <h1 className="text-3xl md:text-4xl font-semibold text-neutral-900 tracking-tight mb-2">
            Secos & Molhados
          </h1>
          <p className="text-neutral-500 text-lg">
            Tijuca Tênis Clube — Torneio Recreativo 🎾
          </p>
        </div>
      </div>

      {/* Tournament cards */}
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <div className="grid md:grid-cols-2 gap-5">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              to={`/t/${t.slug}`}
              className="bg-white rounded-2xl border border-neutral-200/80 p-8 hover:shadow-md hover:border-neutral-300/60 transition-shadow duration-200 block"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-neutral-900 tracking-tight">
                  {t.name}
                </h2>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  t.status === 'ACTIVE' ? 'bg-neutral-100 text-neutral-700' : 'bg-neutral-100 text-neutral-500'
                }`}>
                  {t.status === 'ACTIVE' ? 'Ativo' : 'Arquivado'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-neutral-50 rounded-xl p-4 text-center">
                  <p className="text-lg font-semibold text-neutral-900">{t.year}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Ano</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4 text-center">
                  <p className="text-lg font-semibold text-neutral-900">{t.participantCount}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">Participantes</p>
                </div>
                <div className="bg-neutral-50 rounded-xl p-4 text-center">
                  <p className="text-lg font-semibold text-neutral-900">
                    {t.completedRounds}/{t.totalRounds}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5">Etapas</p>
                </div>
              </div>

              <span className="text-sm font-medium text-[#9B2D3E] hover:text-[#8B2942]">
                Acessar torneio →
              </span>
            </Link>
          ))}
        </div>

        {tournaments.length === 0 && (
          <div className="text-center py-16 text-neutral-500">
            Nenhum torneio cadastrado ainda.
          </div>
        )}
      </div>

      {/* Admin link */}
      <div className="max-w-4xl mx-auto px-4 py-10 text-center border-t border-neutral-100">
        <Link
          to="/admin/login"
          className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          Área administrativa →
        </Link>
      </div>
    </div>
  );
}
