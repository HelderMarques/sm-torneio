const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/tournaments - list all tournaments
router.get('/', async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { year: 'desc' },
    });

    // Enrich with counts
    const enriched = await Promise.all(
      tournaments.map(async (t) => {
        const participantCount = await prisma.participant.count({
          where: { tournamentId: t.id },
        });
        const completedRounds = await prisma.round.count({
          where: { tournamentId: t.id, status: 'COMPLETED' },
        });
        return {
          ...t,
          participantCount,
          completedRounds,
        };
      })
    );

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/tournaments/:slug - single tournament by slug
router.get('/:slug', async (req, res) => {
  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug: req.params.slug },
    });
    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' });
    }

    const participantCount = await prisma.participant.count({
      where: { tournamentId: tournament.id },
    });
    const completedRounds = await prisma.round.count({
      where: { tournamentId: tournament.id, status: 'COMPLETED' },
    });

    res.json({ ...tournament, participantCount, completedRounds });
  } catch (error) {
    console.error('Error fetching tournament:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/tournaments - create tournament (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, slug, year, totalRounds, status } = req.body;
    if (!name || !slug || !year) {
      return res.status(400).json({ error: 'Nome, slug e ano são obrigatórios' });
    }

    const data = {
      name: name.trim(),
      slug: slug.trim(),
      year: Number(year),
      totalRounds: totalRounds ? Number(totalRounds) : 9,
      status: status || 'ACTIVE',
    };

    const existing = await prisma.tournament.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return res.status(409).json({ error: 'Já existe um torneio com este slug' });
    }

    const tournament = await prisma.tournament.create({ data });
    res.status(201).json(tournament);
  } catch (error) {
    console.error('Error creating tournament:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/tournaments/:slug - update tournament (admin only)
router.put('/:slug', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.tournament.findUnique({
      where: { slug: req.params.slug },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Torneio não encontrado' });
    }

    const { name, year, totalRounds, status, simulateEnabled } = req.body;
    const data = {};
    if (name !== undefined) data.name = name.trim();
    if (year !== undefined) data.year = Number(year);
    if (totalRounds !== undefined) data.totalRounds = Number(totalRounds);
    if (status !== undefined) data.status = status;
    if (simulateEnabled !== undefined) data.simulateEnabled = Boolean(simulateEnabled);

    const updated = await prisma.tournament.update({
      where: { slug: req.params.slug },
      data,
    });
    res.json(updated);
  } catch (error) {
    console.error('Error updating tournament:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
