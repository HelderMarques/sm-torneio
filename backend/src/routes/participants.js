const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

// GET / - list all participants for this tournament
router.get('/', async (req, res) => {
  try {
    const { group } = req.query;
    const where = { tournamentId: req.tournament.id };
    if (group) where.group = group.toUpperCase();

    const participants = await prisma.participant.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /:id - single participant
router.get('/:id', async (req, res) => {
  try {
    const participant = await prisma.participant.findFirst({
      where: { id: req.params.id, tournamentId: req.tournament.id },
    });
    if (!participant) {
      return res.status(404).json({ error: 'Participante não encontrado' });
    }
    res.json(participant);
  } catch (error) {
    console.error('Error fetching participant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /:id/history - full round history
router.get('/:id/history', async (req, res) => {
  try {
    const results = await prisma.roundResult.findMany({
      where: {
        participantId: req.params.id,
        round: { tournamentId: req.tournament.id },
      },
      include: { round: true },
      orderBy: { round: { number: 'asc' } },
    });
    res.json(results);
  } catch (error) {
    console.error('Error fetching history:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /bulk - create multiple participants (admin only); body: { names: "Nome1, Nome2, Nome3", group: "F" }
router.post('/bulk', authMiddleware, async (req, res) => {
  try {
    const { names, group } = req.body;
    if (!names || typeof names !== 'string' || !group) {
      return res.status(400).json({ error: 'Envie "names" (vários nomes separados por vírgula) e "group" (F ou M)' });
    }
    if (!['F', 'M'].includes(group.toUpperCase())) {
      return res.status(400).json({ error: 'Grupo deve ser F ou M' });
    }
    const nameList = names
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (nameList.length === 0) {
      return res.status(400).json({ error: 'Nenhum nome válido' });
    }
    const created = [];
    for (const name of nameList) {
      const participant = await prisma.participant.create({
        data: {
          name,
          group: group.toUpperCase(),
          tournamentId: req.tournament.id,
        },
      });
      created.push(participant);
    }
    res.status(201).json({ created: created.length, participants: created });
  } catch (error) {
    console.error('Error creating participants (bulk):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST / - create participant (admin only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, group, birthYear } = req.body;
    if (!name || !group) {
      return res.status(400).json({ error: 'Nome e grupo são obrigatórios' });
    }
    if (!['F', 'M'].includes(group.toUpperCase())) {
      return res.status(400).json({ error: 'Grupo deve ser F ou M' });
    }
    const participant = await prisma.participant.create({
      data: {
        name,
        group: group.toUpperCase(),
        birthYear: birthYear || null,
        tournamentId: req.tournament.id,
      },
    });
    res.status(201).json(participant);
  } catch (error) {
    console.error('Error creating participant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /:id - update participant (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.participant.findFirst({
      where: { id: req.params.id, tournamentId: req.tournament.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Participante não encontrado neste torneio' });
    }

    const { name, group, active, birthYear } = req.body;
    const data = {};
    if (name !== undefined) data.name = name;
    if (group !== undefined) data.group = group.toUpperCase();
    if (active !== undefined) data.active = active;
    if (birthYear !== undefined) data.birthYear = birthYear;

    const participant = await prisma.participant.update({
      where: { id: req.params.id },
      data,
    });
    res.json(participant);
  } catch (error) {
    console.error('Error updating participant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /:id - remove participant (admin only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const existing = await prisma.participant.findFirst({
      where: { id: req.params.id, tournamentId: req.tournament.id },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Participante não encontrado neste torneio' });
    }
    await prisma.participant.delete({
      where: { id: req.params.id },
    });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting participant:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
