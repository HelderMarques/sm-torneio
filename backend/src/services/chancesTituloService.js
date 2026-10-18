// backend/src/services/chancesTituloService.js

/**
 * Projeta a pontuação final de uma atleta aplicando as mesmas regras do
 * standingsService (descarte do menor positivo, bônus de presença total).
 * @param {number[]} perRoundPoints pontos por etapa (reais + projetados)
 * @param {object} opts { totalRounds, completedCount, discardStartsAfter, bonusValue, presentAllRounds, penalty }
 */
function projectFinalPoints(perRoundPoints, opts) {
  const raw = perRoundPoints.reduce((a, b) => a + b, 0);
  let discard = 0;
  if (opts.completedCount >= opts.discardStartsAfter) {
    const positives = perRoundPoints.filter((p) => p > 0);
    if (positives.length > 0) discard = Math.min(...positives);
  }
  const bonus = opts.completedCount === opts.totalRounds && opts.presentAllRounds ? opts.bonusValue : 0;
  return raw - discard + bonus - (opts.penalty || 0);
}

module.exports = { projectFinalPoints };
