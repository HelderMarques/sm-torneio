const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    if (user.status === 'INACTIVE') {
      return res.status(403).json({ error: 'Usuário desativado. Contate o administrador.' });
    }
    if (user.status === 'PENDING') {
      return res.status(403).json({ error: 'Acesso pendente. Defina sua senha pelo link de convite.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({
      user: {
        id: decoded.userId,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      },
    });
  } catch {
    res.status(401).json({ error: 'Token inválido' });
  }
});

// GET /api/auth/invite/:token — valida token de convite e retorna o e-mail
router.get('/invite/:token', async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.params.token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { inviteTokenHash: tokenHash, status: 'PENDING' },
    });
    if (!user) return res.status(404).json({ error: 'Convite não encontrado ou já utilizado.' });
    if (user.inviteExpiresAt && new Date() > user.inviteExpiresAt) {
      return res.status(410).json({ error: 'Convite expirado. Solicite um novo convite.' });
    }
    res.json({ email: user.email, name: user.name });
  } catch (error) {
    console.error('Invite validation error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/auth/set-password — convidado define sua senha
router.post('/set-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token e senha são obrigatórios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await prisma.user.findFirst({
      where: { inviteTokenHash: tokenHash, status: 'PENDING' },
    });
    if (!user) return res.status(404).json({ error: 'Convite não encontrado ou já utilizado.' });
    if (user.inviteExpiresAt && new Date() > user.inviteExpiresAt) {
      return res.status(410).json({ error: 'Convite expirado. Solicite um novo convite.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: passwordHash,
        status: 'ACTIVE',
        inviteTokenHash: null,
        inviteExpiresAt: null,
        lastLoginAt: new Date(),
      },
    });

    res.json({ message: 'Senha definida com sucesso. Você já pode fazer login.' });
  } catch (error) {
    console.error('Set-password error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
