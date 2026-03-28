const express = require('express');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const requireMaster = require('../middleware/requireMaster');
const { sendInviteEmail } = require('../services/emailService');

const router = express.Router();
const prisma = new PrismaClient();

function appBaseUrl() {
  return process.env.APP_URL || 'http://localhost:5173';
}

function generateInviteToken() {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

// GET /api/admin/users — listar todos os usuários (master only)
router.get('/', requireMaster, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/admin/users — convidar novo usuário (master only)
router.post('/', requireMaster, async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email) return res.status(400).json({ error: 'E-mail é obrigatório' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'E-mail já cadastrado' });

    const { raw, hash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72h

    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        role: 'ADMIN',
        status: 'PENDING',
        inviteTokenHash: hash,
        inviteExpiresAt: expiresAt,
      },
    });

    const inviteUrl = `${appBaseUrl()}/admin/set-password?token=${raw}`;
    await sendInviteEmail({ to: email, name: user.name, inviteUrl });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/admin/users/:id/resend-invite — reenviar convite (master only)
router.post('/:id/resend-invite', requireMaster, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
    if (user.status !== 'PENDING') {
      return res.status(400).json({ error: 'Reenvio só é possível para usuários com status pendente' });
    }

    const { raw, hash } = generateInviteToken();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { inviteTokenHash: hash, inviteExpiresAt: expiresAt },
    });

    const inviteUrl = `${appBaseUrl()}/admin/set-password?token=${raw}`;
    await sendInviteEmail({ to: user.email, name: user.name, inviteUrl });

    res.json({ message: 'Convite reenviado com sucesso' });
  } catch (error) {
    console.error('Error resending invite:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PATCH /api/admin/users/:id/status — ativar ou desativar (master only)
router.patch('/:id/status', requireMaster, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['ACTIVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Status deve ser ACTIVE ou INACTIVE' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    // Master não pode desativar a si mesmo
    if (user.role === 'MASTER') {
      return res.status(403).json({ error: 'O usuário master não pode ser desativado' });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
