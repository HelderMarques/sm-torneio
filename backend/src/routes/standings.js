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

// PUT /:id - atualizar standing de uma participante (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { tournament } = req;
    const {
      pointsRaw,
      pointsDiscard,
      pointsBonus,
      pointsPenalty,
      pointsValid,
      roundsPlayed,
      firstPlaces,
      secondPlaces,
      thirdPlaces,
      fourthPlaces,
      fifthPlaces,
      sixthPlaces,
      seventhPlaces,
      setsWon,
      setsLost,
      gamesWon,
      gamesLost,
    } = req.body;

    const existing = await require('@prisma/client').PrismaClient.prototype.standing?.findFirst
      ? null
      : null; // placeholder to avoid accidental use

    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    const standing = await prisma.standing.findFirst({
      where: { participantId: id, tournamentId: tournament.id },
    });
    if (!standing) {
      await prisma.$disconnect();
      return res.status(404).json({ error: 'Standing não encontrada para esta participante/torneio' });
    }

    const data = {};
    if (pointsRaw !== undefined) data.pointsRaw = Number(pointsRaw);
    if (pointsDiscard !== undefined) data.pointsDiscard = Number(pointsDiscard);
    if (pointsBonus !== undefined) data.pointsBonus = Number(pointsBonus);
    if (pointsPenalty !== undefined) data.pointsPenalty = Number(pointsPenalty);
    if (pointsValid !== undefined) data.pointsValid = Number(pointsValid);
    if (roundsPlayed !== undefined) data.roundsPlayed = Number(roundsPlayed);
    if (firstPlaces !== undefined) data.firstPlaces = Number(firstPlaces);
    if (secondPlaces !== undefined) data.secondPlaces = Number(secondPlaces);
    if (thirdPlaces !== undefined) data.thirdPlaces = Number(thirdPlaces);
    if (fourthPlaces !== undefined) data.fourthPlaces = Number(fourthPlaces);
    if (fifthPlaces !== undefined) data.fifthPlaces = Number(fifthPlaces);
    if (sixthPlaces !== undefined) data.sixthPlaces = Number(sixthPlaces);
    if (seventhPlaces !== undefined) data.seventhPlaces = Number(seventhPlaces);
    if (setsWon !== undefined) data.setsWon = Number(setsWon);
    if (setsLost !== undefined) data.setsLost = Number(setsLost);
    if (gamesWon !== undefined) data.gamesWon = Number(gamesWon);
    if (gamesLost !== undefined) data.gamesLost = Number(gamesLost);

    const updated = await prisma.standing.update({
      where: {
        participantId_tournamentId: {
          participantId: id,
          tournamentId: tournament.id,
        },
      },
      data,
    });

    await prisma.$disconnect();
    res.json(updated);
  } catch (error) {
    console.error('Error updating standing:', error);
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
