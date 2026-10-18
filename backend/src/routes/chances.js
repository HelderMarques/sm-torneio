const express = require('express');
const { computeChances } = require('../services/chancesTituloService');

const router = express.Router({ mergeParams: true });

// GET /?group=F - chances de título e troféu (público)
router.get('/', async (req, res) => {
  try {
    const group = (req.query.group || 'F').toUpperCase();
    if (!['F', 'M'].includes(group)) {
      return res.status(400).json({ error: 'group deve ser F ou M' });
    }
    const data = await computeChances(group, req.tournament.id);
    res.json(data);
  } catch (error) {
    console.error('Error computing chances:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
