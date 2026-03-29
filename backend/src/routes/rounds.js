const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');
const authMiddleware = require('../middleware/auth');
const { recalculateStandings, getPointsForResult, getStandings } = require('../services/standingsService');

const router = express.Router({ mergeParams: true });
const prisma = new PrismaClient();

/**
 * Double-loss (double-elimination) position algorithm.
 * games: [{pairAIndex, pairBIndex, scoreA, scoreB}] in order.
 * Returns positionMap[pairIndex] = position (1 = best).
 */
function computeDoubleLossPositions(n, games) {
  const losses = new Array(n).fill(0);
  const eliminationOrder = []; // pair indices added when they get their 2nd loss

  for (const { pairAIndex: a, pairBIndex: b, scoreA, scoreB } of games) {
    if (a == null || b == null || scoreA === scoreB) continue;
    const loser = scoreA < scoreB ? a : b;
    losses[loser]++;
    if (losses[loser] >= 2 && !eliminationOrder.includes(loser)) {
      eliminationOrder.push(loser);
    }
  }

  // Pairs never eliminated (0 or 1 loss) are winners
  const winners = Array.from({ length: n }, (_, i) => i).filter(
    (i) => !eliminationOrder.includes(i)
  );

  const positionMap = new Array(n).fill(null);
  let pos = 1;
  winners.forEach((i) => { positionMap[i] = pos++; });
  // Last eliminated = 2nd place; first eliminated = worst
  for (let i = eliminationOrder.length - 1; i >= 0; i--) {
    positionMap[eliminationOrder[i]] = pos++;
  }
  return positionMap;
}

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

// GET /next/possible-pairs/:participantId - possíveis duplas do participante na próxima etapa
router.get('/next/possible-pairs/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const tournamentId = req.tournament.id;

    const participant = await prisma.participant.findFirst({
      where: { id: participantId, tournamentId },
    });
    if (!participant) return res.status(404).json({ error: 'Participante não encontrado' });

    const group = participant.group;
    const today = new Date().toISOString().slice(0, 10);

    // Próxima etapa agendada do grupo
    const nextRound = await prisma.round.findFirst({
      where: { tournamentId, group, date: { gte: today }, status: { not: 'COMPLETED' } },
      orderBy: { date: 'asc' },
    });

    if (!nextRound) return res.json({ noNextRound: true });

    // Quantas etapas já foram concluídas
    const completedCount = await prisma.round.count({
      where: { tournamentId, group, status: 'COMPLETED' },
    });

    // Classificação atual (já ordenada pelos critérios de desempate)
    const standings = await getStandings(group, tournamentId);
    const n = standings.length;

    const roundInfo = { id: nextRound.id, number: nextRound.number, date: nextRound.date };

    // 1ª etapa: sorteio completamente livre
    if (completedCount === 0) {
      return res.json({
        nextRound: roundInfo,
        firstRound: true,
        participantList: null,
        possiblePartners: standings
          .filter((s) => s.participantId !== participantId)
          .map((s) => ({ participantId: s.participantId, name: s.name, position: s.position })),
        isOdd: n % 2 !== 0,
        totalParticipants: n,
      });
    }

    // Divide em lista A (metade melhor) e lista B (metade pior — sempre a maior se ímpar)
    const halfA = Math.floor(n / 2);
    const listA = standings.slice(0, halfA);
    const listB = standings.slice(halfA);

    const inListA = listA.some((s) => s.participantId === participantId);
    const participantListLabel = inListA ? 'A' : 'B';
    const oppositeList = inListA ? listB : listA;

    // Parceiros já jogados na temporada
    const pastResults = await prisma.roundResult.findMany({
      where: {
        participantId,
        pairId: { not: null },
        round: { tournamentId, group, status: 'COMPLETED' },
      },
      select: { pairId: true, roundId: true },
    });

    const pastPartnerIds = new Set();
    for (const { pairId, roundId } of pastResults) {
      const partners = await prisma.roundResult.findMany({
        where: { roundId, pairId, participantId: { not: participantId } },
        select: { participantId: true },
      });
      partners.forEach((p) => pastPartnerIds.add(p.participantId));
    }

    const possiblePartners = oppositeList
      .filter((s) => !pastPartnerIds.has(s.participantId))
      .map((s) => ({ participantId: s.participantId, name: s.name, position: s.position }));

    res.json({
      nextRound: roundInfo,
      firstRound: false,
      participantList: participantListLabel,
      possiblePartners,
      allExhausted: possiblePartners.length === 0,
      isOdd: n % 2 !== 0,
      totalParticipants: n,
    });
  } catch (error) {
    console.error('Error fetching possible pairs:', error);
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
        matchResults: {
          orderBy: [{ courtLabel: 'asc' }, { gameOrder: 'asc' }],
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
          pairId: r.pairId || null,
          courtLabel: r.courtLabel || null,
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
      'setsWon', 'setsLost', 'gamesWon', 'gamesLost', 'pairId', 'courtLabel',
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

// GET /:id/matches - get matches with resolved pair names
router.get('/:id/matches', async (req, res) => {
  try {
    const round = await prisma.round.findFirst({
      where: { id: req.params.id, tournamentId: req.tournament.id },
      include: {
        results: { include: { participant: true } },
        matchResults: { orderBy: [{ courtLabel: 'asc' }, { gameOrder: 'asc' }] },
      },
    });
    if (!round) return res.status(404).json({ error: 'Etapa não encontrada' });

    // Build pairId -> names map
    const pairNames = {};
    for (const r of round.results) {
      if (r.pairId) {
        if (!pairNames[r.pairId]) pairNames[r.pairId] = [];
        if (r.participant?.name) pairNames[r.pairId].push(r.participant.name);
      }
    }

    const matches = round.matchResults.map((m) => ({
      ...m,
      pairANames: pairNames[m.pairAId] || [],
      pairBNames: pairNames[m.pairBId] || [],
    }));

    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /:id/matches - save match results (admin, replaces all)
router.post('/:id/matches', authMiddleware, async (req, res) => {
  try {
    const roundId = req.params.id;
    const { matches } = req.body;
    if (!Array.isArray(matches)) return res.status(400).json({ error: '"matches" deve ser um array' });

    const round = await prisma.round.findFirst({
      where: { id: roundId, tournamentId: req.tournament.id },
    });
    if (!round) return res.status(404).json({ error: 'Etapa não encontrada' });

    await prisma.matchResult.deleteMany({ where: { roundId } });
    for (const m of matches) {
      await prisma.matchResult.create({
        data: {
          roundId,
          courtLabel: m.courtLabel || null,
          pairAId: m.pairAId,
          pairBId: m.pairBId,
          scoreA: Number(m.scoreA) || 0,
          scoreB: Number(m.scoreB) || 0,
          gameOrder: Number(m.gameOrder) || 0,
        },
      });
    }

    res.status(201).json({ saved: matches.length });
  } catch (error) {
    console.error('Error saving matches:', error);
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

// POST /:id/court-results — court-centric batch result entry (admin)
// Body: { courts: [{ label, pairs:[{playerA,playerB}], games:[{pairAIndex,pairBIndex,scoreA,scoreB}] }], sorteados:[{name,type}] }
router.post('/:id/court-results', authMiddleware, async (req, res) => {
  try {
    const roundId = req.params.id;
    const { courts = [], sorteados = [] } = req.body;

    if (!Array.isArray(courts) || courts.length === 0) {
      return res.status(400).json({ error: 'Pelo menos uma quadra deve ser informada' });
    }

    const round = await prisma.round.findFirst({
      where: { id: roundId, tournamentId: req.tournament.id },
    });
    if (!round) return res.status(404).json({ error: 'Etapa não encontrada' });

    // Load active participants for this group
    const allParticipants = await prisma.participant.findMany({
      where: { tournamentId: req.tournament.id, group: round.group, active: true },
    });
    const byName = new Map(allParticipants.map((p) => [p.name.toLowerCase().trim(), p]));

    const resolve = (name) => {
      const p = byName.get(String(name).toLowerCase().trim());
      if (!p) throw Object.assign(new Error(`Participante não encontrado: "${name}"`), { code: 400 });
      return p;
    };

    const usedIds = new Set();
    const dupCheck = (p, label) => {
      if (usedIds.has(p.id)) throw Object.assign(new Error(`Participante "${p.name}" aparece mais de uma vez`), { code: 400 });
      usedIds.add(p.id);
      return p;
    };

    // Process courts
    const processedCourts = courts.map((court) => {
      if (!court.label?.trim()) throw Object.assign(new Error('Nome da quadra é obrigatório'), { code: 400 });
      const pairs = (court.pairs || []).map(({ playerA, playerB }) => {
        const pA = dupCheck(resolve(playerA));
        const pB = dupCheck(resolve(playerB));
        return { playerA: pA, playerB: pB, pairId: randomUUID() };
      });
      if (pairs.length < 2) throw Object.assign(new Error(`Quadra "${court.label}": mínimo 2 duplas`), { code: 400 });
      return { label: court.label.trim(), pairs, games: court.games || [] };
    });

    // Process sorteados
    const resolvedSorteados = (sorteados || []).map(({ name, type }) => ({
      participant: dupCheck(resolve(name)),
      absentReason: type === 'sorteio_a_pedido' ? 'SORTEIO_VOLUNTARIA' : 'SORTEIO',
    }));

    // Absent = active participants not in any court or sorteados
    const absentParticipants = allParticipants.filter((p) => !usedIds.has(p.id));

    // Build results + matches
    const allResults = [];
    const allMatches = [];

    for (const { label, pairs, games } of processedCourts) {
      const n = pairs.length;

      // Normalise game list
      const normGames = games
        .filter((g) => g.pairAIndex != null && g.pairBIndex != null && g.scoreA !== g.scoreB)
        .map((g) => ({
          pairAIndex: Number(g.pairAIndex),
          pairBIndex: Number(g.pairBIndex),
          scoreA: Number(g.scoreA) || 0,
          scoreB: Number(g.scoreB) || 0,
        }))
        .filter((g) => g.pairAIndex < n && g.pairBIndex < n);

      // Positions
      const positionMap = computeDoubleLossPositions(n, normGames);

      // Sets / games per pair
      const setsWon   = new Array(n).fill(0);
      const setsLost  = new Array(n).fill(0);
      const gamesWon  = new Array(n).fill(0);
      const gamesLost = new Array(n).fill(0);

      normGames.forEach(({ pairAIndex: a, pairBIndex: b, scoreA, scoreB }, idx) => {
        allMatches.push({
          courtLabel: label,
          pairAId: pairs[a].pairId,
          pairBId: pairs[b].pairId,
          scoreA,
          scoreB,
          gameOrder: idx + 1,
        });
        if (scoreA > scoreB) { setsWon[a]++; setsLost[b]++; }
        else                  { setsWon[b]++; setsLost[a]++; }
        gamesWon[a]  += scoreA; gamesLost[a] += scoreB;
        gamesWon[b]  += scoreB; gamesLost[b] += scoreA;
      });

      // RoundResult for each player
      pairs.forEach(({ playerA, playerB, pairId }, i) => {
        [playerA, playerB].forEach((player) => {
          const rec = {
            participantId: player.id,
            position: positionMap[i],
            pairId,
            courtLabel: label,
            present: true,
            absentReason: 'NONE',
            setsWon: setsWon[i],
            setsLost: setsLost[i],
            gamesWon: gamesWon[i],
            gamesLost: gamesLost[i],
            uniformPenalty: 0,
          };
          rec.pointsRaw = getPointsForResult(rec);
          allResults.push(rec);
        });
      });
    }

    // Sorteados
    resolvedSorteados.forEach(({ participant, absentReason }) => {
      const rec = {
        participantId: participant.id,
        position: null,
        pairId: null,
        courtLabel: null,
        present: false,
        absentReason,
        setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
        uniformPenalty: 0,
      };
      rec.pointsRaw = getPointsForResult(rec);
      allResults.push(rec);
    });

    // Absents
    absentParticipants.forEach((participant) => {
      allResults.push({
        participantId: participant.id,
        position: null,
        pairId: null,
        courtLabel: null,
        present: false,
        absentReason: 'FALTA',
        setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0,
        uniformPenalty: 0,
        pointsRaw: 0,
      });
    });

    // Persist (replace)
    await prisma.roundResult.deleteMany({ where: { roundId } });
    await prisma.matchResult.deleteMany({ where: { roundId } });

    for (const r of allResults) {
      await prisma.roundResult.create({
        data: {
          roundId,
          participantId: r.participantId,
          position: r.position,
          pointsRaw: r.pointsRaw,
          present: r.present,
          absentReason: r.absentReason,
          uniformPenalty: r.uniformPenalty,
          setsWon: r.setsWon,
          setsLost: r.setsLost,
          gamesWon: r.gamesWon,
          gamesLost: r.gamesLost,
          pairId: r.pairId,
          courtLabel: r.courtLabel,
        },
      });
    }

    for (const m of allMatches) {
      await prisma.matchResult.create({
        data: {
          roundId,
          courtLabel: m.courtLabel,
          pairAId: m.pairAId,
          pairBId: m.pairBId,
          scoreA: m.scoreA,
          scoreB: m.scoreB,
          gameOrder: m.gameOrder,
        },
      });
    }

    await prisma.round.update({ where: { id: roundId }, data: { status: 'COMPLETED' } });
    await recalculateStandings(round.group, req.tournament.id);

    const standings = await getStandings(round.group, req.tournament.id);

    res.status(201).json({
      saved: allResults.length,
      absents: absentParticipants.map((p) => p.name),
      standings,
    });
  } catch (err) {
    if (err.code === 400) return res.status(400).json({ error: err.message });
    console.error('Error in court-results:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
