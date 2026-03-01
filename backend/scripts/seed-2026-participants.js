/**
 * Cadastra as 14 participantes do torneio feminino 2026.
 * Uso: node scripts/seed-2026-participants.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PARTICIPANTES_2026 = [
  'Giovana',
  'Kátia',
  'Sandra',
  'Mariana',
  'Rose',
  'Adriane',
  'Ana',
  'Núbia',
  'Cristina',
  'Letícia',
  'Jeovana',
  'Marcela',
  'Valéria',
  'Camille',
];

function normalize(name) {
  return name.trim().toLowerCase();
}

async function main() {
  const tournament = await prisma.tournament.findUnique({
    where: { slug: '2026' },
  });

  if (!tournament) {
    console.error('Torneio 2026 não encontrado.');
    process.exit(1);
  }

  const existing = await prisma.participant.findMany({
    where: { tournamentId: tournament.id, group: 'F' },
  });
  const existingNames = new Set(existing.map((p) => normalize(p.name)));

  let created = 0;
  for (const name of PARTICIPANTES_2026) {
    if (existingNames.has(normalize(name))) {
      console.log(`Já existe: ${name}`);
      continue;
    }
    await prisma.participant.create({
      data: {
        name: name.trim(),
        group: 'F',
        tournamentId: tournament.id,
      },
    });
    console.log(`Cadastrada: ${name}`);
    created++;
  }

  console.log(`\n${created} participante(s) cadastrada(s). Total no torneio 2026 (F): ${existing.length + created}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
