/**
 * Bootstrap: cria admin e torneios iniciais apenas se a base não tiver utilizadores.
 * Útil para Railway/produção na primeira vez (não precisa correr seed via SSH).
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log('Bootstrap: base já tem utilizadores, nada a fazer.');
    return;
  }

  console.log('Bootstrap: base vazia, a criar admin e torneios iniciais...');

  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      email: 'admin@smtorneio.com',
      password: hashedPassword,
      name: 'Administrador',
    },
  });
  console.log('Admin criado: admin@smtorneio.com / admin123');

  await prisma.tournament.createMany({
    data: [
      { name: 'Torneio Demo', slug: 'demo', year: 2025, totalRounds: 9, status: 'ACTIVE' },
      { name: 'Secos & Molhados 2026', slug: '2026', year: 2026, totalRounds: 9, status: 'ACTIVE' },
    ],
  });
  console.log('Torneios iniciais criados: Demo + 2026');

  console.log('Bootstrap concluído.');
}

main()
  .catch((e) => {
    console.error('Bootstrap error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
