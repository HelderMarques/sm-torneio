const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.roundResult.deleteMany();
  await prisma.standing.deleteMany();
  await prisma.round.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.tournament.deleteMany();
  await prisma.user.deleteMany();

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@smtorneio.com',
      password: hashedPassword,
      name: 'Administrador',
    },
  });
  console.log('Admin user created: admin@smtorneio.com / admin123');

  // Create tournaments
  const demoTournament = await prisma.tournament.create({
    data: {
      name: 'Torneio Demo',
      slug: 'demo',
      year: 2025,
      totalRounds: 9,
      status: 'ACTIVE',
    },
  });

  const tournament2026 = await prisma.tournament.create({
    data: {
      name: 'Secos & Molhados 2026',
      slug: '2026',
      year: 2026,
      totalRounds: 9,
      status: 'ACTIVE',
    },
  });
  console.log('2 tournaments created: Demo + 2026');

  // ===== DEMO TOURNAMENT (with sample data) =====

  // Female participants (14)
  const femaleNames = [
    'Ana Clara', 'Beatriz Lima', 'Carla Santos', 'Diana Oliveira',
    'Eduarda Souza', 'Fernanda Costa', 'Gabriela Martins', 'Helena Rocha',
    'Isabela Ferreira', 'Juliana Almeida', 'Karen Ribeiro', 'Larissa Gomes',
    'Mariana Silva', 'Natália Pereira',
  ];

  const femaleParticipants = [];
  for (const name of femaleNames) {
    const p = await prisma.participant.create({
      data: { name, group: 'F', tournamentId: demoTournament.id },
    });
    femaleParticipants.push(p);
  }
  console.log(`${femaleParticipants.length} female participants created (Demo)`);

  // Male participants (10)
  const maleNames = [
    'André Mendes', 'Bruno Cavalcanti', 'Carlos Eduardo', 'Daniel Barbosa',
    'Eduardo Nunes', 'Felipe Araújo', 'Gustavo Teixeira', 'Henrique Dias',
    'Igor Campos', 'João Pedro',
  ];

  const maleParticipants = [];
  for (const name of maleNames) {
    const p = await prisma.participant.create({
      data: { name, group: 'M', tournamentId: demoTournament.id },
    });
    maleParticipants.push(p);
  }
  console.log(`${maleParticipants.length} male participants created (Demo)`);

  // Create 9 rounds for each group (Demo)
  const demoRoundDates = [
    '2025-03-29', '2025-04-26', '2025-05-31', '2025-06-28',
    '2025-07-26', '2025-08-30', '2025-09-27', '2025-10-25', '2025-11-29',
  ];

  for (const group of ['F', 'M']) {
    for (let i = 0; i < 9; i++) {
      await prisma.round.create({
        data: {
          number: i + 1,
          date: demoRoundDates[i],
          status: 'SCHEDULED',
          group,
          tournamentId: demoTournament.id,
        },
      });
    }
  }
  console.log('18 rounds created for Demo (9F + 9M)');

  // Simulate results for rounds 1-3 (Female group, Demo)
  const femaleRounds = await prisma.round.findMany({
    where: { group: 'F', tournamentId: demoTournament.id },
    orderBy: { number: 'asc' },
  });

  for (let roundIdx = 0; roundIdx < 3; roundIdx++) {
    const round = femaleRounds[roundIdx];
    const shuffled = [...femaleParticipants].sort(() => Math.random() - 0.5);

    for (let i = 0; i < shuffled.length; i++) {
      let present = true;
      let absentReason = 'NONE';
      let position = null;
      let setsWon = 0;
      let setsLost = 0;
      let gamesWon = 0;
      let gamesLost = 0;

      if (i === 13) {
        present = false;
        absentReason = 'FALTA';
      } else if (i === 12) {
        present = false;
        absentReason = 'SORTEIO';
      } else {
        position = Math.min(i + 1, 7);
        present = true;
        setsWon = Math.floor(Math.random() * 4) + 1;
        setsLost = Math.floor(Math.random() * 3);
        gamesWon = setsWon * 6 + Math.floor(Math.random() * 4);
        gamesLost = setsLost * 5 + Math.floor(Math.random() * 6);
      }

      let pointsRaw = 0;
      if (!present) {
        if (absentReason === 'SORTEIO') pointsRaw = 80;
        else if (absentReason === 'SORTEIO_VOLUNTARIA') pointsRaw = 60;
      } else if (position) {
        const pointsMap = { 1: 100, 2: 80, 3: 70, 4: 60, 5: 50, 6: 40, 7: 30 };
        pointsRaw = pointsMap[position] || 0;
      }

      await prisma.roundResult.create({
        data: {
          roundId: round.id,
          participantId: shuffled[i].id,
          position,
          pointsRaw,
          present,
          absentReason,
          uniformPenalty: 0,
          setsWon,
          setsLost,
          gamesWon,
          gamesLost,
        },
      });
    }

    await prisma.round.update({
      where: { id: round.id },
      data: { status: 'COMPLETED' },
    });
  }
  console.log('3 female rounds simulated with results (Demo)');

  // Recalculate standings for Demo tournament
  const { recalculateStandings } = require('../src/services/standingsService');
  await recalculateStandings('F', demoTournament.id);
  await recalculateStandings('M', demoTournament.id);
  console.log('Standings recalculated (Demo)');

  // ===== TORNEIO 2026 — 9 etapas femininas com datas =====
  const etapas2026 = [
    { number: 1, date: '2026-03-15' }, // 15 de março
    { number: 2, date: '2026-04-19' }, // 19 de abril
    { number: 3, date: '2026-05-17' }, // 17 de maio
    { number: 4, date: '2026-06-21' }, // 21 de junho
    { number: 5, date: '2026-07-19' }, // 19 de julho
    { number: 6, date: '2026-08-16' }, // 16 de agosto
    { number: 7, date: '2026-09-20' }, // 20 de setembro
    { number: 8, date: '2026-10-18' }, // 18 de outubro
    { number: 9, date: '2026-11-29' }, // 29 de novembro
  ];
  for (const { number, date } of etapas2026) {
    await prisma.round.create({
      data: {
        number,
        date,
        status: 'SCHEDULED',
        group: 'F',
        tournamentId: tournament2026.id,
      },
    });
  }
  console.log('Torneio 2026: 9 etapas femininas cadastradas');

  console.log('\nSeed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
