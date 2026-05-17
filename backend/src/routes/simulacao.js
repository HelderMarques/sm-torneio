const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { nowInTimezone, isWithinWindow } = require('../utils/timeWindow');

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

// Janela horária no dia da etapa (America/Sao_Paulo).
// Atualmente: dia inteiro (00:00–23:59). Para restringir, ajustar:
//   WINDOW_START=7, WINDOW_END=19 → das 7h às 19h (exclusive).
const WINDOW_START = 0;
const WINDOW_END = 24;
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
    // Janela horária desativada — controle único é o toggle simulateEnabled.
    // Para reativar: usar `if (!isWithinWindow(hour, WINDOW_START, WINDOW_END))`
    return res.json({ available: true, reason: null, etapa });
  } catch (err) {
    console.error('Error in /simulacao/availability:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const { buildSimulatedResults } = require('../services/simulationMapper');
const { simulateStandings } = require('../services/standingsService');
const { generateInsight } = require('../services/insightService');

/**
 * POST /simular
 * Body: { viewerParticipantId, group, absentees, duplas }
 * Retorna: { standings, viewer: {...}, insight: null|string }
 */
router.post('/simular', async (req, res) => {
  try {
    const { viewerParticipantId, group, absentees, duplas } = req.body || {};
    const grp = (group || 'F').toUpperCase();
    if (!['F', 'M'].includes(grp)) return res.status(400).json({ error: 'group deve ser F ou M' });
    if (!viewerParticipantId) return res.status(400).json({ error: 'viewerParticipantId é obrigatório' });
    if (!Array.isArray(duplas) || duplas.length < 2) {
      return res.status(400).json({ error: 'pelo menos 2 duplas são necessárias' });
    }

    // Revalida disponibilidade (toggle + etapa do dia)
    const tournament = req.tournament;
    if (!tournament.simulateEnabled) return res.status(403).json({ error: 'Simulação desativada' });
    const { date } = nowInTimezone(TIMEZONE);
    const etapa = await prisma.round.findFirst({
      where: { tournamentId: tournament.id, group: grp, date },
    });
    if (!etapa || etapa.status === 'COMPLETED') {
      return res.status(403).json({ error: 'Simulação fora da janela permitida' });
    }

    // Confirma viewer
    const viewer = await prisma.participant.findFirst({
      where: { id: viewerParticipantId, tournamentId: tournament.id, group: grp, active: true },
    });
    if (!viewer) return res.status(400).json({ error: 'Atleta selecionada (viewer) não encontrada' });

    // Posições únicas por dupla (Etapa F com 1 quadra → posições 1-5 distintas)
    const positions = duplas.map((d) => d.position);
    const dups = positions.filter((p, i) => positions.indexOf(p) !== i);
    if (dups.length > 0) return res.status(400).json({ error: 'Cada posição só pode ter uma dupla' });

    // Whitelist: todos os IDs em duplas e absentees devem pertencer a atletas
    // ativas do mesmo torneio e grupo.
    const incomingIds = new Set();
    for (const d of duplas) {
      if (d.playerAId) incomingIds.add(d.playerAId);
      if (d.playerBId) incomingIds.add(d.playerBId);
    }
    for (const a of absentees || []) {
      if (a.participantId) incomingIds.add(a.participantId);
    }
    if (incomingIds.size > 0) {
      const validIds = await prisma.participant.findMany({
        where: {
          id: { in: Array.from(incomingIds) },
          tournamentId: tournament.id,
          group: grp,
          active: true,
        },
        select: { id: true },
      });
      const validSet = new Set(validIds.map((p) => p.id));
      const invalid = Array.from(incomingIds).filter((id) => !validSet.has(id));
      if (invalid.length > 0) {
        return res.status(400).json({
          error: `IDs de atleta inválidos ou não-ativas no grupo ${grp}: ${invalid.join(', ')}`,
        });
      }
    }

    // Monta simulatedResults
    let simulatedResults;
    try {
      simulatedResults = buildSimulatedResults({ absentees, duplas });
    } catch (err) {
      return res.status(err.code === 400 ? 400 : 500).json({ error: err.message });
    }

    // Atletas ativas não listadas viram FALTA automática
    const allActive = await prisma.participant.findMany({
      where: { tournamentId: tournament.id, group: grp, active: true },
      select: { id: true },
    });
    const present = new Set(simulatedResults.map((r) => r.participantId));
    for (const p of allActive) {
      if (!present.has(p.id)) {
        simulatedResults.push({
          participantId: p.id, present: false, absentReason: 'FALTA',
          position: null, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0, uniformPenalty: 0,
        });
      }
    }

    // Simula
    const standings = await simulateStandings(grp, tournament.id, simulatedResults);

    // Encontra a viewer no resultado
    const viewerStanding = standings.find((s) => s.participantId === viewerParticipantId);

    // Gera insight (não bloqueia em caso de erro)
    let insight = null;
    if (viewerStanding) {
      try {
        insight = await generateInsight({
          viewer: {
            name: viewerStanding.name,
            oldPosition: viewerStanding.oldPosition,
            newPosition: viewerStanding.position,
            delta: viewerStanding.positionDelta,
            oldPoints: viewerStanding.oldPointsValid,
            newPoints: viewerStanding.pointsValid,
          },
          simulatedStandings: standings,
        });
      } catch (err) {
        console.error('[POST /simular] Erro no insight:', err.message);
      }
    }

    res.json({
      standings,
      viewer: viewerStanding ? {
        participantId: viewerStanding.participantId,
        name: viewerStanding.name,
        oldPosition: viewerStanding.oldPosition,
        newPosition: viewerStanding.position,
        delta: viewerStanding.positionDelta,
        oldPoints: viewerStanding.oldPointsValid,
        newPoints: viewerStanding.pointsValid,
      } : null,
      insight,
    });
  } catch (err) {
    console.error('Error in /simulacao/simular:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
