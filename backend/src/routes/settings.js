const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/settings — returns all settings grouped by category
router.get('/', async (req, res) => {
  try {
    const all = await prisma.tournamentSetting.findMany({ orderBy: { id: 'asc' } });
    const grouped = {};
    for (const s of all) {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    }
    res.json(grouped);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/settings/flat — returns all settings as flat array
router.get('/flat', async (req, res) => {
  try {
    const all = await prisma.tournamentSetting.findMany({ orderBy: { id: 'asc' } });
    res.json(all);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/settings/bulk — update multiple settings at once (admin only)
router.put('/bulk', authMiddleware, async (req, res) => {
  try {
    const { settings } = req.body; // [{ key, value }]
    if (!Array.isArray(settings) || settings.length === 0) {
      return res.status(400).json({ error: 'Array de configurações obrigatório' });
    }
    const updated = await prisma.$transaction(
      settings.map(({ key, value }) =>
        prisma.tournamentSetting.update({ where: { key }, data: { value: String(value) } })
      )
    );
    res.json(updated);
  } catch (err) {
    console.error('Error bulk-updating settings:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/settings/:key — update a single setting (admin only)
router.put('/:key', authMiddleware, async (req, res) => {
  try {
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ error: 'Campo "value" obrigatório' });
    }
    const existing = await prisma.tournamentSetting.findUnique({ where: { key: req.params.key } });
    if (!existing) {
      return res.status(404).json({ error: 'Configuração não encontrada' });
    }
    const updated = await prisma.tournamentSetting.update({
      where: { key: req.params.key },
      data: { value: String(value) },
    });
    res.json(updated);
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
