const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function tournamentMiddleware(req, res, next) {
  const { tournamentSlug } = req.params;
  if (!tournamentSlug) {
    return res.status(400).json({ error: 'Slug do torneio é obrigatório' });
  }

  try {
    const tournament = await prisma.tournament.findUnique({
      where: { slug: tournamentSlug },
    });

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' });
    }

    req.tournament = tournament;
    next();
  } catch (error) {
    console.error('Tournament middleware error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

module.exports = tournamentMiddleware;
