import { Outlet } from 'react-router-dom';
import { TournamentProvider, useTournament } from '../hooks/useTournament';

function AdminContent() {
  const { loading, error } = useTournament();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center">
        <p className="text-xl text-neutral-500 mb-4">{error}</p>
        <a href="/" className="text-[#9B2D3E] hover:text-[#8B2942] font-medium">Voltar</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Outlet />
    </div>
  );
}

export default function AdminLayout() {
  return (
    <TournamentProvider>
      <AdminContent />
    </TournamentProvider>
  );
}
