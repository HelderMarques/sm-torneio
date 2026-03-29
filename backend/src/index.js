require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const seedMasterUser = require('./seed');

const authRoutes = require('./routes/auth');
const adminUserRoutes = require('./routes/adminUsers');
const tournamentRoutes = require('./routes/tournaments');
const participantRoutes = require('./routes/participants');
const roundRoutes = require('./routes/rounds');
const standingsRoutes = require('./routes/standings');
const settingsRoutes = require('./routes/settings');
const tournamentMiddleware = require('./middleware/tournament');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Auth (not tournament-scoped)
app.use('/api/auth', authRoutes);

// Admin user management (master only)
app.use('/api/admin/users', adminUserRoutes);

// Tournament-scoped routes (mais específicas primeiro para não capturar GET/DELETE etc.)
app.use('/api/tournaments/:tournamentSlug/participants', tournamentMiddleware, participantRoutes);
app.use('/api/tournaments/:tournamentSlug/rounds', tournamentMiddleware, roundRoutes);
app.use('/api/tournaments/:tournamentSlug/standings', tournamentMiddleware, standingsRoutes);

// Global settings (not tournament-scoped)
app.use('/api/settings', settingsRoutes);

// Tournament listing (rotas gerais por último)
app.use('/api/tournaments', tournamentRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API docs (OpenAPI 3) em JSON
app.get('/api/openapi.json', (req, res) => {
  const specPath = path.join(__dirname, '../openapi.json');
  res.sendFile(specPath);
});

// API docs interativas (Swagger UI a partir do openapi.json)
app.get('/api/docs', (req, res) => {
  const docsHtmlPath = path.join(__dirname, '../docs/index.html');
  res.sendFile(docsHtmlPath);
});

// Em produção, servir o frontend (build do Vite) e fallback SPA para o React Router
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    // Catch-all SPA: usar RegExp para evitar path-to-regexp (não aceita '*' nem '/(.*)')
    app.get(/^\/(?!api\/).*$/, (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
}

app.listen(PORT, async () => {
  console.log(`SM Torneio API running on port ${PORT}`);
  await seedMasterUser();
});
