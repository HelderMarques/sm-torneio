/**
 * Cria o torneio 2025 e insere a classificação final do PDF (Resultado Final S&M Feminino 2025).
 * Uso: node scripts/seed-2025-from-pdf.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Dados extraídos do PDF "RESULTADO FINAL S&M FEMININO 2025" (Classificação Geral Feminino)
const STANDINGS_2025 = [
  { name: 'Giovana', pointsValid: 510, pointsRaw: 530, pointsPenalty: 0, pointsDiscard: 40, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 2, secondPlaces: 1, thirdPlaces: 2, fourthPlaces: 1, fifthPlaces: 1, sixthPlaces: 0, seventhPlaces: 0, setsWon: 16, setsLost: 9, gamesWon: 100, gamesLost: 87 },
  { name: 'Kátia', pointsValid: 500, pointsRaw: 520, pointsPenalty: 0, pointsDiscard: 40, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 2, secondPlaces: 1, thirdPlaces: 1, fourthPlaces: 1, fifthPlaces: 1, sixthPlaces: 1, seventhPlaces: 0, setsWon: 16, setsLost: 8, gamesWon: 102, gamesLost: 81 },
  { name: 'Sandra', pointsValid: 490, pointsRaw: 540, pointsPenalty: 0, pointsDiscard: 70, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 1, secondPlaces: 2, thirdPlaces: 0, fourthPlaces: 4, fifthPlaces: 0, sixthPlaces: 0, seventhPlaces: 0, setsWon: 13, setsLost: 10, gamesWon: 88, gamesLost: 81 },
  { name: 'Mariana', pointsValid: 480, pointsRaw: 520, pointsPenalty: 0, pointsDiscard: 60, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 2, secondPlaces: 1, thirdPlaces: 0, fourthPlaces: 4, fifthPlaces: 0, sixthPlaces: 0, seventhPlaces: 0, setsWon: 13, setsLost: 9, gamesWon: 92, gamesLost: 66 },
  { name: 'Rose', pointsValid: 400, pointsRaw: 420, pointsPenalty: 0, pointsDiscard: 40, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 2, secondPlaces: 1, thirdPlaces: 1, fourthPlaces: 1, fifthPlaces: 2, sixthPlaces: 0, seventhPlaces: 0, setsWon: 8, setsLost: 14, gamesWon: 69, gamesLost: 85 },
  { name: 'Adriane', pointsValid: 390, pointsRaw: 440, pointsPenalty: 0, pointsDiscard: 50, pointsBonus: 0, roundsPlayed: 6, firstPlaces: 1, secondPlaces: 0, thirdPlaces: 3, fourthPlaces: 1, fifthPlaces: 0, sixthPlaces: 1, seventhPlaces: 0, setsWon: 12, setsLost: 7, gamesWon: 75, gamesLost: 69 },
  { name: 'Ana', pointsValid: 390, pointsRaw: 420, pointsPenalty: 0, pointsDiscard: 50, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 1, secondPlaces: 1, thirdPlaces: 2, fourthPlaces: 0, fifthPlaces: 0, sixthPlaces: 3, seventhPlaces: 0, setsWon: 9, setsLost: 12, gamesWon: 77, gamesLost: 82 },
  { name: 'Núbia', pointsValid: 380, pointsRaw: 430, pointsPenalty: 0, pointsDiscard: 50, pointsBonus: 0, roundsPlayed: 5, firstPlaces: 3, secondPlaces: 1, thirdPlaces: 0, fourthPlaces: 1, fifthPlaces: 0, sixthPlaces: 0, seventhPlaces: 0, setsWon: 15, setsLost: 5, gamesWon: 86, gamesLost: 60 },
  { name: 'Cristina', pointsValid: 370, pointsRaw: 400, pointsPenalty: 0, pointsDiscard: 30, pointsBonus: 0, roundsPlayed: 6, firstPlaces: 2, secondPlaces: 0, thirdPlaces: 1, fourthPlaces: 1, fifthPlaces: 1, sixthPlaces: 1, seventhPlaces: 0, setsWon: 8, setsLost: 6, gamesWon: 51, gamesLost: 51 },
  { name: 'Letícia', pointsValid: 360, pointsRaw: 400, pointsPenalty: 0, pointsDiscard: 40, pointsBonus: 0, roundsPlayed: 6, firstPlaces: 2, secondPlaces: 2, thirdPlaces: 1, fourthPlaces: 0, fifthPlaces: 1, sixthPlaces: 0, seventhPlaces: 0, setsWon: 10, setsLost: 12, gamesWon: 78, gamesLost: 82 },
  { name: 'Jeovana', pointsValid: 360, pointsRaw: 380, pointsPenalty: 0, pointsDiscard: 40, pointsBonus: 20, roundsPlayed: 7, firstPlaces: 1, secondPlaces: 1, thirdPlaces: 0, fourthPlaces: 3, fifthPlaces: 0, sixthPlaces: 2, seventhPlaces: 0, setsWon: 5, setsLost: 14, gamesWon: 57, gamesLost: 80 },
  { name: 'Marcela', pointsValid: 310, pointsRaw: 340, pointsPenalty: 0, pointsDiscard: 30, pointsBonus: 0, roundsPlayed: 6, firstPlaces: 3, secondPlaces: 1, thirdPlaces: 0, fourthPlaces: 1, fifthPlaces: 0, sixthPlaces: 3, seventhPlaces: 0, setsWon: 8, setsLost: 10, gamesWon: 38, gamesLost: 57 },
  { name: 'Valéria', pointsValid: 240, pointsRaw: 300, pointsPenalty: 0, pointsDiscard: 60, pointsBonus: 0, roundsPlayed: 4, firstPlaces: 2, secondPlaces: 0, thirdPlaces: 1, fourthPlaces: 0, fifthPlaces: 5, sixthPlaces: 0, seventhPlaces: 0, setsWon: 4, setsLost: 3, gamesWon: 31, gamesLost: 27 },
  { name: 'Camille', pointsValid: 220, pointsRaw: 260, pointsPenalty: 0, pointsDiscard: 40, pointsBonus: 0, roundsPlayed: 5, firstPlaces: 1, secondPlaces: 1, thirdPlaces: 1, fourthPlaces: 0, fifthPlaces: 2, sixthPlaces: 0, seventhPlaces: 0, setsWon: 3, setsLost: 10, gamesWon: 36, gamesLost: 58 },
];

async function main() {
  let tournament = await prisma.tournament.findUnique({ where: { slug: '2025' } });

  if (!tournament) {
    tournament = await prisma.tournament.create({
      data: {
        name: 'Secos & Molhados 2025',
        slug: '2025',
        year: 2025,
        totalRounds: 9,
        status: 'ARCHIVED',
      },
    });
    console.log('Torneio 2025 criado (arquivado).');
  }

  const existingRounds = await prisma.round.count({ where: { tournamentId: tournament.id } });
  if (existingRounds === 0) {
    const dates2025 = ['2025-03-15', '2025-04-19', '2025-05-17', '2025-06-21', '2025-07-19', '2025-08-16', '2025-09-20', '2025-10-18', '2025-11-29'];
    for (let i = 0; i < 9; i++) {
      await prisma.round.create({
        data: {
          number: i + 1,
          date: dates2025[i],
          status: 'COMPLETED',
          group: 'F',
          tournamentId: tournament.id,
        },
      });
    }
    console.log('9 etapas 2025 criadas (realizadas).');
  }

  const existingParticipants = await prisma.participant.findMany({
    where: { tournamentId: tournament.id, group: 'F' },
  });
  const byName = new Map(existingParticipants.map((p) => [p.name, p]));

  const participants = [];
  for (const row of STANDINGS_2025) {
    let p = byName.get(row.name);
    if (!p) {
      p = await prisma.participant.create({
        data: { name: row.name, group: 'F', tournamentId: tournament.id },
      });
      console.log('Participante cadastrada:', row.name);
    }
    participants.push({ ...p, ...row });
  }

  for (const row of participants) {
    await prisma.standing.upsert({
      where: {
        participantId_tournamentId: {
          participantId: row.id,
          tournamentId: tournament.id,
        },
      },
      create: {
        participantId: row.id,
        tournamentId: tournament.id,
        seasonYear: 2025,
        pointsRaw: row.pointsRaw,
        pointsDiscard: row.pointsDiscard,
        pointsBonus: row.pointsBonus,
        pointsPenalty: row.pointsPenalty,
        pointsValid: row.pointsValid,
        roundsPlayed: row.roundsPlayed,
        firstPlaces: row.firstPlaces,
        secondPlaces: row.secondPlaces,
        thirdPlaces: row.thirdPlaces,
        fourthPlaces: row.fourthPlaces,
        fifthPlaces: row.fifthPlaces,
        sixthPlaces: row.sixthPlaces,
        seventhPlaces: row.seventhPlaces,
        setsWon: row.setsWon,
        setsLost: row.setsLost,
        gamesWon: row.gamesWon,
        gamesLost: row.gamesLost,
      },
      update: {
        seasonYear: 2025,
        pointsRaw: row.pointsRaw,
        pointsDiscard: row.pointsDiscard,
        pointsBonus: row.pointsBonus,
        pointsPenalty: row.pointsPenalty,
        pointsValid: row.pointsValid,
        roundsPlayed: row.roundsPlayed,
        firstPlaces: row.firstPlaces,
        secondPlaces: row.secondPlaces,
        thirdPlaces: row.thirdPlaces,
        fourthPlaces: row.fourthPlaces,
        fifthPlaces: row.fifthPlaces,
        sixthPlaces: row.sixthPlaces,
        seventhPlaces: row.seventhPlaces,
        setsWon: row.setsWon,
        setsLost: row.setsLost,
        gamesWon: row.gamesWon,
        gamesLost: row.gamesLost,
      },
    });
  }

  console.log('Classificação 2025 (14 participantes) inserida a partir do PDF.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
