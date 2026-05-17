const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { nowInTimezone, isWithinWindow } = require('../utils/timeWindow');

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

const WINDOW_START = 7;
const WINDOW_END = 19;
const TIMEZONE = 'America/Sao_Paulo';

/**
 * GET /availability?group=F
 * Retorna { available, reason, etapa }.
 */
router.get('/availability', async (req, res) => {
  try {
    const group = (req.query.group || 'F').toUpperCase();
    if (!['F', 'M'].includes(group)) {
      return res.status(400).json({ error: 'group deve ser F ou M' });
    }

    const tournament = req.tournament;
    if (!tournament.simulateEnabled) {
      return res.json({ available: false, reason: 'desativado', etapa: null });
    }

    const { date, hour } = nowInTimezone(TIMEZONE);

    const etapa = await prisma.round.findFirst({
      where: { tournamentId: tournament.id, group, date },
      select: { id: true, number: true, date: true, status: true },
    });

    if (!etapa) {
      return res.json({ available: false, reason: 'sem_etapa_hoje', etapa: null });
    }
    if (etapa.status === 'COMPLETED') {
      return res.json({ available: false, reason: 'etapa_concluida', etapa });
    }
    if (!isWithinWindow(hour, WINDOW_START, WINDOW_END)) {
      return res.json({ available: false, reason: 'fora_da_janela', etapa });
    }
    return res.json({ available: true, reason: null, etapa });
  } catch (err) {
    console.error('Error in /simulacao/availability:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
