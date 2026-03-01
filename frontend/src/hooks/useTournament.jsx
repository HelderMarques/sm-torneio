import { createContext, useContext, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/client';

const TournamentContext = createContext(null);

export function TournamentProvider({ children }) {
  const { slug } = useParams();
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    api.get(`/tournaments/${slug}`)
      .then((res) => setTournament(res.data))
      .catch(() => setError('Torneio não encontrado'))
      .finally(() => setLoading(false));
  }, [slug]);

  // Helper to build tournament-scoped API paths
  const tApi = {
    get: (path, config) => api.get(`/tournaments/${slug}${path}`, config),
    post: (path, data, config) => api.post(`/tournaments/${slug}${path}`, data, config),
    put: (path, data, config) => api.put(`/tournaments/${slug}${path}`, data, config),
    delete: (path, config) => api.delete(`/tournaments/${slug}${path}`, config),
  };

  return (
    <TournamentContext.Provider value={{ tournament, slug, loading, error, tApi }}>
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const context = useContext(TournamentContext);
  if (!context) throw new Error('useTournament must be used within TournamentProvider');
  return context;
}
