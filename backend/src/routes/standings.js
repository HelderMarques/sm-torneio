const express = require('express');
const authMiddleware = require('../middleware/auth');
const { recalculateStandings, getStandings, simulateStandings } = require('../services/standingsService');

const router = express.Router({ mergeParams: true });

// GET /:group - public standings
router.get('/:group', async (req, res) => {
  try {
    const group = req.params.group.toUpperCase();
    if (!['F', 'M'].includes(group)) {
      return res.status(400).json({ error: 'Grupo deve ser F ou M' });
    }
    const standings = await getStandings(group, req.tournament.id);
    res.json(standings);
  } catch (error) {
    console.error('Error fetching standings:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /recalculate - recalculate all (admin)
router.post('/recalculate', authMiddleware, async (req, res) => {
  try {
    const femaleStandings = await recalculateStandings('F', req.tournament.id);
    const maleStandings = await recalculateStandings('M', req.tournament.id);
    res.json({
      message: 'Classificação recalculada com sucesso',
      F: femaleStandings.length,
      M: maleStandings.length,
    });
  } catch (error) {
    console.error('Error recalculating:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /simulate - simular nova etapa (não persiste)
router.post('/simulate', async (req, res) => {
  try {
    const { group, results } = req.body;
    const upperGroup = (group || '').toUpperCase();
    if (!['F', 'M'].includes(upperGroup)) {
      return res.status(400).json({ error: 'Grupo deve ser F ou M' });
    }
    if (!Array.isArray(results)) {
      return res.status(400).json({ error: 'Campo \"results\" deve ser um array' });
    }

    const simulation = await simulateStandings(upperGroup, req.tournament.id, results);
    res.json(simulation);
  } catch (error) {
    console.error('Error simulating standings:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /:group/export - export CSV (admin)
router.get('/:group/export', authMiddleware, async (req, res) => {
  try {
    const group = req.params.group.toUpperCase();
    const standings = await getStandings(group, req.tournament.id);

    const headers = [
      'Pos', 'Nome', 'Pts Válidos', 'Pts Ganhos', 'Penalidades', 'Descarte',
      'Bonificação', 'Participações', '1º', '2º', '3º', '4º', '5º', '6º', '7º',
      'Sets V', 'Sets P', 'Saldo Sets', 'Games V', 'Games P', 'Saldo Games',
    ];

    const rows = standings.map((s) => [
      s.position, s.name, s.pointsValid, s.pointsRaw, s.pointsPenalty, s.pointsDiscard,
      s.pointsBonus, s.roundsPlayed, s.firstPlaces, s.secondPlaces, s.thirdPlaces,
      s.fourthPlaces, s.fifthPlaces, s.sixthPlaces, s.seventhPlaces,
      s.setsWon, s.setsLost, s.saldoSets, s.gamesWon, s.gamesLost, s.saldoGames,
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=classificacao_${group}_${req.tournament.slug}.csv`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
