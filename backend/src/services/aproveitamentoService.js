const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Ordena um array de entradas de aproveitamento.
 * - rate desc; tiebreaker = total absoluto de vitórias (won) desc.
 * - rate === null (denominador 0) vai ao final, ordenado alfabeticamente.
 * Atribui `position` 1-indexed após ordenar.
 */
function rankByRate(entries) {
  const withRate = entries.filter((e) => e.rate !== null);
  const withoutRate = entries.filter((e) => e.rate === null);

  withRate.sort((a, b) => {
    if (b.rate !== a.rate) return b.rate - a.rate;
    if (b.won !== a.won) return b.won - a.won;
    return a.name.localeCompare(b.name, 'pt-BR');
  });
  withoutRate.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return [...withRate, ...withoutRate].map((e, i) => ({ ...e, position: i + 1 }));
}

/**
 * Calcula o ranking por aproveitamento (% de vitórias) em 3 dimensões:
 * partidas, sets e games. Considera apenas rounds COMPLETED do grupo.
 *
 * @returns {{ partidas: Array, sets: Array, games: Array }}
 *   Cada entrada: { participantId, name, won, played, rate, position }.
 *   rate = won/played (0..1), ou null se played === 0.
 */
async function computeAproveitamento(group, tournamentId) {
  const participants = await prisma.participant.findMany({
    where: { group, active: true, tournamentId },
    include: {
      results: {
        include: { round: true },
        where: { round: { group, status: 'COMPLETED', tournamentId } },
      },
    },
  });

  // Todas as partidas (MatchResult) das etapas COMPLETED do grupo,
  // indexadas por roundId para cruzar com o pairId de cada atleta.
  const matchResults = await prisma.matchResult.findMany({
    where: { round: { group, status: 'COMPLETED', tournamentId } },
  });
  const matchesByRound = new Map();
  for (const m of matchResults) {
    if (!matchesByRound.has(m.roundId)) matchesByRound.set(m.roundId, []);
    matchesByRound.get(m.roundId).push(m);
  }

  const partidas = [];
  const sets = [];
  const games = [];

  for (const p of participants) {
    // --- Partidas: cruza RoundResult.pairId com MatchResult.pairAId/pairBId ---
    let partidasPlayed = 0;
    let partidasWon = 0;
    for (const r of p.results) {
      if (!r.pairId) continue;
      const roundMatches = matchesByRound.get(r.roundId) || [];
      for (const m of roundMatches) {
        const isA = m.pairAId === r.pairId;
        const isB = m.pairBId === r.pairId;
        if (!isA && !isB) continue;
        partidasPlayed += 1;
        const myScore = isA ? m.scoreA : m.scoreB;
        const oppScore = isA ? m.scoreB : m.scoreA;
        if (myScore > oppScore) partidasWon += 1;
      }
    }

    // --- Sets e Games: agregados dos RoundResult das etapas COMPLETED ---
    let setsWon = 0;
    let setsLost = 0;
    let gamesWon = 0;
    let gamesLost = 0;
    for (const r of p.results) {
      setsWon += r.setsWon;
      setsLost += r.setsLost;
      gamesWon += r.gamesWon;
      gamesLost += r.gamesLost;
    }
    const setsPlayed = setsWon + setsLost;
    const gamesPlayed = gamesWon + gamesLost;

    partidas.push({
      participantId: p.id,
      name: p.name,
      won: partidasWon,
      played: partidasPlayed,
      rate: partidasPlayed > 0 ? partidasWon / partidasPlayed : null,
    });
    sets.push({
      participantId: p.id,
      name: p.name,
      won: setsWon,
      played: setsPlayed,
      rate: setsPlayed > 0 ? setsWon / setsPlayed : null,
    });
    games.push({
      participantId: p.id,
      name: p.name,
      won: gamesWon,
      played: gamesPlayed,
      rate: gamesPlayed > 0 ? gamesWon / gamesPlayed : null,
    });
  }

  return {
    partidas: rankByRate(partidas),
    sets: rankByRate(sets),
    games: rankByRate(games),
  };
}

module.exports = { computeAproveitamento, rankByRate };
