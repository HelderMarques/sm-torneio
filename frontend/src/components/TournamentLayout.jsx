import { Outlet } from 'react-router-dom';
import { TournamentProvider, useTournament } from '../hooks/useTournament';
import Navbar from './Navbar';
import BottomTabBar from './BottomTabBar';

function TournamentContent() {
  const { loading, error } = useTournament();

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-neutral-50">
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-xl text-neutral-500 mb-4">{error}</p>
          <a href="/" className="text-[#9B2D3E] hover:text-[#8B2942] font-medium">← Voltar para torneios</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 pb-16 md:pb-0">
      <Navbar />
      <Outlet />
      <BottomTabBar />
    </div>
  );
}

export default function TournamentLayout() {
  return (
    <TournamentProvider>
      <TournamentContent />
    </TournamentProvider>
  );
}
