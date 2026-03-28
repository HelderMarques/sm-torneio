/**
 * Garante que o usuário master existe e está ATIVO.
 * Roda no startup do servidor. Lê as variáveis de ambiente:
 *   MASTER_EMAIL    (padrão: admin@smtorneio.com)
 *   MASTER_PASSWORD (padrão: admin123)
 *   MASTER_NAME     (padrão: Admin)
 *
 * Se o usuário já existir → apenas corrige status/role se necessário.
 * Se não existir → cria com a senha configurada.
 */

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedMasterUser() {
  const email    = process.env.MASTER_EMAIL    || 'admin@smtorneio.com';
  const password = process.env.MASTER_PASSWORD || 'admin123';
  const name     = process.env.MASTER_NAME     || 'Admin';

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      const needsFix = existing.status !== 'ACTIVE' || existing.role !== 'MASTER';
      if (needsFix) {
        await prisma.user.update({
          where: { email },
          data: { status: 'ACTIVE', role: 'MASTER' },
        });
        console.log(`[seed] Master user ${email} → status=ACTIVE role=MASTER`);
      } else {
        console.log(`[seed] Master user ${email} OK`);
      }
    } else {
      const hash = await bcrypt.hash(password, 12);
      await prisma.user.create({
        data: { email, name, password: hash, role: 'MASTER', status: 'ACTIVE' },
      });
      console.log(`[seed] Master user ${email} criado`);
    }
  } catch (err) {
    console.error('[seed] Erro ao garantir master user:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = seedMasterUser;
