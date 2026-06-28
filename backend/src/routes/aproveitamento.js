const express = require('express');
const { computeAproveitamento } = require('../services/aproveitamentoService');

const router = express.Router({ mergeParams: true });

// GET /?group=F - ranking por aproveitamento (público, sem auth)
router.get('/', async (req, res) => {
  try {
    const group = (req.query.group || 'F').toUpperCase();
    if (!['F', 'M'].includes(group)) {
      return res.status(400).json({ error: 'group deve ser F ou M' });
    }
    const data = await computeAproveitamento(group, req.tournament.id);
    res.json(data);
  } catch (error) {
    console.error('Error computing aproveitamento:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
