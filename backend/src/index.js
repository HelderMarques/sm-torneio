require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const tournamentRoutes = require('./routes/tournaments');
const participantRoutes = require('./routes/participants');
const roundRoutes = require('./routes/rounds');
const standingsRoutes = require('./routes/standings');
const tournamentMiddleware = require('./middleware/tournament');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth (not tournament-scoped)
app.use('/api/auth', authRoutes);

// Tournament-scoped routes (mais específicas primeiro para não capturar GET/DELETE etc.)
app.use('/api/tournaments/:tournamentSlug/participants', tournamentMiddleware, participantRoutes);
app.use('/api/tournaments/:tournamentSlug/rounds', tournamentMiddleware, roundRoutes);
app.use('/api/tournaments/:tournamentSlug/standings', tournamentMiddleware, standingsRoutes);

// Tournament listing (rotas gerais por último)
app.use('/api/tournaments', tournamentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Em produção, servir o frontend (build do Vite) e fallback SPA para o React Router
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

app.listen(PORT, () => {
  console.log(`SM Torneio API running on port ${PORT}`);
});
