const express = require('express');
const { PrismaClient } = require('@prisma/client');

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

module.exports = router;
