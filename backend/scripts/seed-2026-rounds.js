/**
 * Cadastra as datas das 9 etapas do torneio feminino 2026.
 * Uso: node scripts/seed-2026-rounds.js
 * (a partir da pasta backend, ou com NODE_PATH)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ETAPAS_2026 = [
  { number: 1, date: '2026-03-15' },  // 15 de março
  { number: 2, date: '2026-04-19' },  // 19 de abril
  { number: 3, date: '2026-05-17' },  // 17 de maio
  { number: 4, date: '2026-06-21' },  // 21 de junho
  { number: 5, date: '2026-07-19' },  // 19 de julho
  { number: 6, date: '2026-08-16' },  // 16 de agosto
  { number: 7, date: '2026-09-20' },  // 20 de setembro
  { number: 8, date: '2026-10-18' },  // 18 de outubro
  { number: 9, date: '2026-11-29' },  // 29 de novembro
];

async function main() {
  const tournament = await prisma.tournament.findUnique({
    where: { slug: '2026' },
  });

  if (!tournament) {
    console.error('Torneio 2026 não encontrado. Execute o seed primeiro: npm run seed');
    process.exit(1);
  }

  for (const { number, date } of ETAPAS_2026) {
    await prisma.round.upsert({
      where: {
        tournamentId_number_group: {
          tournamentId: tournament.id,
          number,
          group: 'F',
        },
      },
      create: {
        tournamentId: tournament.id,
        number,
        date,
        status: 'SCHEDULED',
        group: 'F',
      },
      update: { date },
    });
    console.log(`${number}ª Etapa: ${date}`);
  }

  console.log('\n9 etapas do torneio 2026 (feminino) cadastradas.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
