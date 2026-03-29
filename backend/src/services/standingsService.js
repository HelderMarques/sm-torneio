const { PrismaClient } = require('@prisma/client');
const { loadSettings } = require('../utils/settings');

const prisma = new PrismaClient();

function getPointsForResult(result, settings) {
  const POINTS_BY_POSITION = {
    1: settings.int('points_1st_place'),
    2: settings.int('points_2nd_place'),
    3: settings.int('points_3rd_place'),
    4: settings.int('points_4th_place'),
    5: settings.int('points_5th_place'),
    6: settings.int('points_6th_place'),
    7: settings.int('points_7th_place'),
  };
  if (!result.present) {
    if (result.absentReason === 'SORTEIO') return settings.int('points_sit_out_drawn');
    if (result.absentReason === 'SORTEIO_VOLUNTARIA') return settings.int('points_sit_out_volunteer');
    return 0; // FALTA
  }
  return POINTS_BY_POSITION[result.position] || 0;
}

async function recalculateStandings(group, tournamentId) {
  const [tournament, settings] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    loadSettings(),
  ]);
  if (!tournament) throw new Error('Torneio não encontrado');

  const TOTAL_ROUNDS = tournament.totalRounds;
  const DISCARD_STARTS_AT = settings.int('discard_starts_after_round');
  const FULL_ATTENDANCE_BONUS = settings.int('bonus_full_attendance');

  const participants = await prisma.participant.findMany({
    where: { group, active: true, tournamentId },
    include: {
      results: {
        include: { round: true },
        where: {
          round: { group, status: 'COMPLETED', tournamentId },
        },
      },
    },
  });

  const completedRounds = await prisma.round.findMany({
    where: { group, status: 'COMPLETED', tournamentId },
  });
  const completedCount = completedRounds.length;

  const standingsData = participants.map((p) => {
    const results = p.results;

    // Collect per-round points
    const roundPoints = results.map((r) => getPointsForResult(r, settings));

    // Raw total
    const pointsRaw = roundPoints.reduce((sum, pts) => sum + pts, 0);

    // Discard: active from configured round, remove lowest positive score
    let pointsDiscard = 0;
    if (completedCount >= DISCARD_STARTS_AT) {
      const positivePoints = roundPoints.filter((p) => p > 0);
      if (positivePoints.length > 0) {
        pointsDiscard = Math.min(...positivePoints);
      }
    }

    // Uniform penalties (sum of all)
    const pointsPenalty = results.reduce((sum, r) => sum + Math.abs(r.uniformPenalty), 0);

    // Attendance bonus: +bonus if participated in ALL rounds
    const roundsPresent = results.filter(
      (r) => r.present || r.absentReason === 'SORTEIO' || r.absentReason === 'SORTEIO_VOLUNTARIA'
    ).length;
    const pointsBonus = completedCount === TOTAL_ROUNDS && roundsPresent === TOTAL_ROUNDS ? FULL_ATTENDANCE_BONUS : 0;

    // Valid points
    const pointsValid = pointsRaw - pointsDiscard + pointsBonus - pointsPenalty;

    // Position counts
    const positionCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    results.forEach((r) => {
      if (r.present && r.position && positionCounts[r.position] !== undefined) {
        positionCounts[r.position]++;
      }
    });

    // Sets and games
    const setsWon = results.reduce((sum, r) => sum + r.setsWon, 0);
    const setsLost = results.reduce((sum, r) => sum + r.setsLost, 0);
    const gamesWon = results.reduce((sum, r) => sum + r.gamesWon, 0);
    const gamesLost = results.reduce((sum, r) => sum + r.gamesLost, 0);

    return {
      participantId: p.id,
      participantName: p.name,
      tournamentId,
      seasonYear: tournament.year,
      pointsRaw,
      pointsDiscard,
      pointsBonus,
      pointsPenalty,
      pointsValid,
      roundsPlayed: results.filter((r) => r.present).length,
      firstPlaces: positionCounts[1],
      secondPlaces: positionCounts[2],
      thirdPlaces: positionCounts[3],
      fourthPlaces: positionCounts[4],
      fifthPlaces: positionCounts[5],
      sixthPlaces: positionCounts[6],
      seventhPlaces: positionCounts[7],
      setsWon,
      setsLost,
      gamesWon,
      gamesLost,
    };
  });

  // Sort by tiebreaker rules
  standingsData.sort((a, b) => {
    if (b.pointsValid !== a.pointsValid) return b.pointsValid - a.pointsValid;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    const saldoSetsA = a.setsWon - a.setsLost;
    const saldoSetsB = b.setsWon - b.setsLost;
    if (saldoSetsB !== saldoSetsA) return saldoSetsB - saldoSetsA;
    const saldoGamesA = a.gamesWon - a.gamesLost;
    const saldoGamesB = b.gamesWon - b.gamesLost;
    if (saldoGamesB !== saldoGamesA) return saldoGamesB - saldoGamesA;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return 0;
  });

  // Upsert standings in DB
  for (const s of standingsData) {
    await prisma.standing.upsert({
      where: {
        participantId_tournamentId: {
          participantId: s.participantId,
          tournamentId: s.tournamentId,
        },
      },
      update: {
        seasonYear: s.seasonYear,
        pointsRaw: s.pointsRaw,
        pointsDiscard: s.pointsDiscard,
        pointsBonus: s.pointsBonus,
        pointsPenalty: s.pointsPenalty,
        pointsValid: s.pointsValid,
        roundsPlayed: s.roundsPlayed,
        firstPlaces: s.firstPlaces,
        secondPlaces: s.secondPlaces,
        thirdPlaces: s.thirdPlaces,
        fourthPlaces: s.fourthPlaces,
        fifthPlaces: s.fifthPlaces,
        sixthPlaces: s.sixthPlaces,
        seventhPlaces: s.seventhPlaces,
        setsWon: s.setsWon,
        setsLost: s.setsLost,
        gamesWon: s.gamesWon,
        gamesLost: s.gamesLost,
      },
      create: {
        participantId: s.participantId,
        tournamentId: s.tournamentId,
        seasonYear: s.seasonYear,
        pointsRaw: s.pointsRaw,
        pointsDiscard: s.pointsDiscard,
        pointsBonus: s.pointsBonus,
        pointsPenalty: s.pointsPenalty,
        pointsValid: s.pointsValid,
        roundsPlayed: s.roundsPlayed,
        firstPlaces: s.firstPlaces,
        secondPlaces: s.secondPlaces,
        thirdPlaces: s.thirdPlaces,
        fourthPlaces: s.fourthPlaces,
        fifthPlaces: s.fifthPlaces,
        sixthPlaces: s.sixthPlaces,
        seventhPlaces: s.seventhPlaces,
        setsWon: s.setsWon,
        setsLost: s.setsLost,
        gamesWon: s.gamesWon,
        gamesLost: s.gamesLost,
      },
    });
  }

  return standingsData;
}

async function getStandings(group, tournamentId) {
  let standings = await prisma.standing.findMany({
    where: { tournamentId },
    include: {
      participant: true,
    },
  });

  // Filter by group
  let filtered = standings.filter((s) => s.participant.group === group);

  // Se há participantes mas menos standings do que participantes ativos, recalcular para exibir ranking completo
  const participantCount = await prisma.participant.count({
    where: { group, active: true, tournamentId },
  });
  if (participantCount > 0 && filtered.length < participantCount) {
    await recalculateStandings(group, tournamentId);
    standings = await prisma.standing.findMany({
      where: { tournamentId },
      include: { participant: true },
    });
    filtered = standings.filter((s) => s.participant.group === group);
  }

  // Sort by tiebreaker rules
  filtered.sort((a, b) => {
    if (b.pointsValid !== a.pointsValid) return b.pointsValid - a.pointsValid;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    const saldoSetsA = a.setsWon - a.setsLost;
    const saldoSetsB = b.setsWon - b.setsLost;
    if (saldoSetsB !== saldoSetsA) return saldoSetsB - saldoSetsA;
    const saldoGamesA = a.gamesWon - a.gamesLost;
    const saldoGamesB = b.gamesWon - b.gamesLost;
    if (saldoGamesB !== saldoGamesA) return saldoGamesB - saldoGamesA;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return 0;
  });

  return filtered.map((s, index) => ({
    position: index + 1,
    participantId: s.participantId,
    name: s.participant.name,
    group: s.participant.group,
    pointsValid: s.pointsValid,
    pointsRaw: s.pointsRaw,
    pointsDiscard: s.pointsDiscard,
    pointsBonus: s.pointsBonus,
    pointsPenalty: s.pointsPenalty,
    roundsPlayed: s.roundsPlayed,
    firstPlaces: s.firstPlaces,
    secondPlaces: s.secondPlaces,
    thirdPlaces: s.thirdPlaces,
    fourthPlaces: s.fourthPlaces,
    fifthPlaces: s.fifthPlaces,
    sixthPlaces: s.sixthPlaces,
    seventhPlaces: s.seventhPlaces,
    setsWon: s.setsWon,
    setsLost: s.setsLost,
    saldoSets: s.setsWon - s.setsLost,
    gamesWon: s.gamesWon,
    gamesLost: s.gamesLost,
    saldoGames: s.gamesWon - s.gamesLost,
  }));
}

/**
 * Simula o efeito de uma nova etapa sobre a classificação,
 * sem gravar nada na base. Recebe resultados "virtuais" para cada participante.
 */
async function simulateStandings(group, tournamentId, simulatedResults) {
  const [tournament, settings] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    loadSettings(),
  ]);
  if (!tournament) throw new Error('Torneio não encontrado');

  const TOTAL_ROUNDS = tournament.totalRounds;
  const DISCARD_STARTS_AT = settings.int('discard_starts_after_round');
  const FULL_ATTENDANCE_BONUS = settings.int('bonus_full_attendance');

  const participants = await prisma.participant.findMany({
    where: { group, active: true, tournamentId },
    include: {
      results: {
        include: { round: true },
        where: {
          round: { group, status: 'COMPLETED', tournamentId },
        },
      },
    },
  });

  const completedRounds = await prisma.round.findMany({
    where: { group, status: 'COMPLETED', tournamentId },
  });
  const completedCount = completedRounds.length;
  const hasSimulated = Array.isArray(simulatedResults) && simulatedResults.length > 0;
  const completedCountWithSim = hasSimulated ? completedCount + 1 : completedCount;

  const simulatedByParticipant = {};
  if (hasSimulated) {
    for (const r of simulatedResults) {
      if (!r.participantId) continue;
      simulatedByParticipant[r.participantId] = {
        present: r.present !== false,
        absentReason: r.absentReason || 'NONE',
        position: r.position || null,
        uniformPenalty: r.uniformPenalty || 0,
        setsWon: r.setsWon || 0,
        setsLost: r.setsLost || 0,
        gamesWon: r.gamesWon || 0,
        gamesLost: r.gamesLost || 0,
      };
    }
  }

  const standingsData = participants.map((p) => {
    const baseResults = p.results;
    const extra = simulatedByParticipant[p.id] ? [simulatedByParticipant[p.id]] : [];
    const results = [...baseResults, ...extra];

    const roundPoints = results.map((r) => getPointsForResult(r, settings));
    const pointsRaw = roundPoints.reduce((sum, pts) => sum + pts, 0);

    let pointsDiscard = 0;
    if (completedCountWithSim >= DISCARD_STARTS_AT) {
      const positivePoints = roundPoints.filter((pts) => pts > 0);
      if (positivePoints.length > 0) {
        pointsDiscard = Math.min(...positivePoints);
      }
    }

    const pointsPenalty = results.reduce((sum, r) => sum + Math.abs(r.uniformPenalty), 0);

    const roundsPresent = results.filter(
      (r) => r.present || r.absentReason === 'SORTEIO' || r.absentReason === 'SORTEIO_VOLUNTARIA'
    ).length;
    const pointsBonus =
      completedCountWithSim === TOTAL_ROUNDS && roundsPresent === TOTAL_ROUNDS ? FULL_ATTENDANCE_BONUS : 0;

    const pointsValid = pointsRaw - pointsDiscard + pointsBonus - pointsPenalty;

    const positionCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
    results.forEach((r) => {
      if (r.present && r.position && positionCounts[r.position] !== undefined) {
        positionCounts[r.position]++;
      }
    });

    const setsWon = results.reduce((sum, r) => sum + r.setsWon, 0);
    const setsLost = results.reduce((sum, r) => sum + r.setsLost, 0);
    const gamesWon = results.reduce((sum, r) => sum + r.gamesWon, 0);
    const gamesLost = results.reduce((sum, r) => sum + r.gamesLost, 0);

    return {
      participantId: p.id,
      participantName: p.name,
      tournamentId,
      seasonYear: tournament.year,
      pointsRaw,
      pointsDiscard,
      pointsBonus,
      pointsPenalty,
      pointsValid,
      roundsPlayed: results.filter((r) => r.present).length,
      firstPlaces: positionCounts[1],
      secondPlaces: positionCounts[2],
      thirdPlaces: positionCounts[3],
      fourthPlaces: positionCounts[4],
      fifthPlaces: positionCounts[5],
      sixthPlaces: positionCounts[6],
      seventhPlaces: positionCounts[7],
      setsWon,
      setsLost,
      gamesWon,
      gamesLost,
    };
  });

  standingsData.sort((a, b) => {
    if (b.pointsValid !== a.pointsValid) return b.pointsValid - a.pointsValid;
    if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
    const saldoSetsA = a.setsWon - a.setsLost;
    const saldoSetsB = b.setsWon - b.setsLost;
    if (saldoSetsB !== saldoSetsA) return saldoSetsB - saldoSetsA;
    const saldoGamesA = a.gamesWon - a.gamesLost;
    const saldoGamesB = b.gamesWon - b.gamesLost;
    if (saldoGamesB !== saldoGamesA) return saldoGamesB - saldoGamesA;
    if (b.setsWon !== a.setsWon) return b.setsWon - a.setsWon;
    if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
    return 0;
  });

  const currentStandings = await getStandings(group, tournamentId);
  const currentById = new Map(currentStandings.map((s) => [s.participantId, s]));

  return standingsData.map((s, index) => {
    const old = currentById.get(s.participantId);
    const newPosition = index + 1;
    const oldPosition = old ? old.position : null;
    const positionDelta = oldPosition ? oldPosition - newPosition : 0;

    return {
      position: newPosition,
      oldPosition,
      positionDelta,
      participantId: s.participantId,
      name: s.participantName,
      group,
      pointsValid: s.pointsValid,
      oldPointsValid: old ? old.pointsValid : null,
      pointsRaw: s.pointsRaw,
      pointsDiscard: s.pointsDiscard,
      pointsBonus: s.pointsBonus,
      pointsPenalty: s.pointsPenalty,
      roundsPlayed: s.roundsPlayed,
      firstPlaces: s.firstPlaces,
      secondPlaces: s.secondPlaces,
      thirdPlaces: s.thirdPlaces,
      fourthPlaces: s.fourthPlaces,
      fifthPlaces: s.fifthPlaces,
      sixthPlaces: s.sixthPlaces,
      seventhPlaces: s.seventhPlaces,
      setsWon: s.setsWon,
      setsLost: s.setsLost,
      saldoSets: s.setsWon - s.setsLost,
      gamesWon: s.gamesWon,
      gamesLost: s.gamesLost,
      saldoGames: s.gamesWon - s.gamesLost,
    };
  });
}

module.exports = {
  recalculateStandings,
  getStandings,
  getPointsForResult,
  simulateStandings,
};
