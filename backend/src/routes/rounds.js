const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');
const { recalculateStandings, getPointsForResult } = require('../services/standingsService');

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

// GET / - list all rounds for this tournament
router.get('/', async (req, res) => {
  try {
    const { group } = req.query;
    const where = { tournamentId: req.tournament.id };
    if (group) where.group = group.toUpperCase();

    const rounds = await prisma.round.findMany({
      where,
      orderBy: { number: 'asc' },
    });
    res.json(rounds);
  } catch (error) {
    console.error('Error fetching rounds:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST / - create round (admin) - calendário
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { number, date, group } = req.body;
    if (number == null || !date || !group) {
      return res.status(400).json({ error: 'Número, data (YYYY-MM-DD) e grupo (F ou M) são obrigatórios' });
    }
    if (!['F', 'M'].includes(group.toUpperCase())) {
      return res.status(400).json({ error: 'Grupo deve ser F ou M' });
    }
    const num = parseInt(number, 10);
    const tournament = await prisma.tournament.findUnique({ where: { id: req.tournament.id } });
    if (!tournament) return res.status(404).json({ error: 'Torneio não encontrado' });
    if (num < 1 || num > tournament.totalRounds) {
      return res.status(400).json({ error: `Número da etapa deve ser entre 1 e ${tournament.totalRounds}` });
    }
    const existing = await prisma.round.findFirst({
      where: { tournamentId: req.tournament.id, number: num, group: group.toUpperCase() },
    });
    if (existing) {
      return res.status(400).json({ error: `Já existe a ${num}ª etapa para o grupo ${group}` });
    }
    const round = await prisma.round.create({
      data: {
        number: num,
        date: String(date).slice(0, 10),
        group: group.toUpperCase(),
        tournamentId: req.tournament.id,
      },
    });
    res.status(201).json(round);
  } catch (error) {
    console.error('Error creating round:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /:id - single round with results
router.get('/:id', async (req, res) => {
  try {
    const round = await prisma.round.findFirst({
      where: { id: req.params.id, tournamentId: req.tournament.id },
      include: {
        results: {
          include: { participant: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    if (!round) {
      return res.status(404).json({ error: 'Etapa não encontrada' });
    }
    res.json(round);
  } catch (error) {
    console.error('Error fetching round:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /:id/results - results for a round
router.get('/:id/results', async (req, res) => {
  try {
    const results = await prisma.roundResult.findMany({
      where: {
        roundId: req.params.id,
        round: { tournamentId: req.tournament.id },
      },
      include: { participant: true },
      orderBy: { position: 'asc' },
    });
    res.json(results);
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /:id/results - register results for a round (admin)
router.post('/:id/results', authMiddleware, async (req, res) => {
  try {
    const roundId = req.params.id;
    const { results } = req.body;

    if (!results || !Array.isArray(results)) {
      return res.status(400).json({ error: 'Resultados são obrigatórios' });
    }

    const round = await prisma.round.findFirst({
      where: { id: roundId, tournamentId: req.tournament.id },
    });
    if (!round) {
      return res.status(404).json({ error: 'Etapa não encontrada' });
    }

    // Delete existing results for this round
    await prisma.roundResult.deleteMany({ where: { roundId } });

    // Create new results
    const created = [];
    for (const r of results) {
      const pointsRaw = getPointsForResult(r);
      const result = await prisma.roundResult.create({
        data: {
          roundId,
          participantId: r.participantId,
          position: r.position || null,
          pointsRaw,
          present: r.present !== false,
          absentReason: r.absentReason || 'NONE',
          uniformPenalty: r.uniformPenalty || 0,
          setsWon: r.setsWon || 0,
          setsLost: r.setsLost || 0,
          gamesWon: r.gamesWon || 0,
          gamesLost: r.gamesLost || 0,
        },
      });
      created.push(result);
    }

    // Mark round as completed
    await prisma.round.update({
      where: { id: roundId },
      data: { status: 'COMPLETED' },
    });

    // Recalculate standings with tournamentId
    await recalculateStandings(round.group, req.tournament.id);

    res.status(201).json(created);
  } catch (error) {
    console.error('Error registering results:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /:id/results/:participantId - update single result (admin)
router.put('/:id/results/:participantId', authMiddleware, async (req, res) => {
  try {
    const { id: roundId, participantId } = req.params;
    const data = {};
    const fields = [
      'position', 'present', 'absentReason', 'uniformPenalty',
      'setsWon', 'setsLost', 'gamesWon', 'gamesLost',
    ];

    for (const field of fields) {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    }

    if (data.position !== undefined || data.present !== undefined || data.absentReason !== undefined) {
      const existing = await prisma.roundResult.findUnique({
        where: { roundId_participantId: { roundId, participantId } },
      });
      const merged = { ...existing, ...data };
      data.pointsRaw = getPointsForResult(merged);
    }

    const result = await prisma.roundResult.update({
      where: { roundId_participantId: { roundId, participantId } },
      data,
    });

    // Recalculate standings with tournamentId
    await recalculateStandings(
      (await prisma.round.findUnique({ where: { id: roundId } })).group,
      req.tournament.id
    );

    res.json(result);
  } catch (error) {
    console.error('Error updating result:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /:id - update round (admin)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.round.findFirst({
      where: { id: req.params.id, tournamentId: req.tournament.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Etapa não encontrada neste torneio' });
    }

    const { status, notes, date } = req.body;
    const data = {};
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if (date !== undefined) data.date = date;

    const round = await prisma.round.update({
      where: { id: req.params.id },
      data,
    });
    res.json(round);
  } catch (error) {
    console.error('Error updating round:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
