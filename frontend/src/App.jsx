import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import TournamentLayout from './components/TournamentLayout';
import AdminLayout from './components/AdminLayout';
import TorneioPicker from './pages/TorneioPicker';
import Home from './pages/Home';
import Classificacao from './pages/Classificacao';
import Calendario from './pages/Calendario';
import Participante from './pages/Participante';
import Regulamento from './pages/Regulamento';
import EtapaPublic from './pages/EtapaPublic';
import SimularEtapa from './pages/SimularEtapa';
import Login from './pages/admin/Login';
import Dashboard from './pages/admin/Dashboard';
import Etapas from './pages/admin/Etapas';
import EtapaDetail from './pages/admin/EtapaDetail';
import Participantes from './pages/admin/Participantes';
import CalendarioAdmin from './pages/admin/Calendario';
import TorneiosAdmin from './pages/admin/Torneios';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-neutral-50">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-neutral-200 border-t-neutral-500"></div>
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" />;
  return children;
}

function AppContent() {
  return (
    <Routes>
      {/* Landing: escolha de torneio (2025 arquivado, 2026 ativo) */}
      <Route path="/" element={<TorneioPicker />} />

      {/* Rotas por torneio */}
      <Route path="/t/:slug" element={<TournamentLayout />}>
        <Route index element={<Home />} />
        <Route path="classificacao/:group" element={<Classificacao />} />
        <Route path="calendario" element={<Calendario />} />
        <Route path="simular" element={<SimularEtapa />} />
        <Route path="participante/:id" element={<Participante />} />
        <Route path="regulamento" element={<Regulamento />} />
        <Route path="etapa/:id" element={<EtapaPublic />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={<Navigate to="/admin/tournaments" replace />} />
      <Route path="/admin/login" element={<Login />} />

      {/* Admin global (não depende de slug) */}
      <Route
        path="/admin/tournaments"
        element={
          <ProtectedRoute>
            <TorneiosAdmin />
          </ProtectedRoute>
        }
      />

      {/* Admin tournament-scoped routes */}
      <Route path="/admin/t/:slug" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="calendario" element={<CalendarioAdmin />} />
        <Route path="etapas" element={<Etapas />} />
        <Route path="etapa/:id" element={<EtapaDetail />} />
        <Route path="participantes" element={<Participantes />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
