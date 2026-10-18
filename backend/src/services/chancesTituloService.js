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

/**
 * Deriva status determinístico de título e troféu por atleta.
 * @param {{id:string, floor:number, ceil:number}[]} athletes
 * @param {number} K posições premiadas (troféu)
 * @returns {{id:string, titulo:string, trofeu:string}[]} status ∈ garantido|vivo|depende_desempate|fora
 */
function deriveStatuses(athletes, K) {
  return athletes.map((a) => {
    const others = athletes.filter((j) => j.id !== a.id);
    const beatA = others.filter((j) => j.ceil > a.floor).length;
    const maxFloorOthers = others.length ? Math.max(...others.map((j) => j.floor)) : -Infinity;
    const strictlyAbove = others.filter((j) => j.floor > a.ceil).length;
    const weaklyAbove = others.filter((j) => j.floor >= a.ceil).length;

    let titulo;
    if (beatA === 0) titulo = 'garantido';
    else if (a.ceil > maxFloorOthers) titulo = 'vivo';
    else if (a.ceil === maxFloorOthers) titulo = 'depende_desempate';
    else titulo = 'fora';

    let trofeu;
    if (beatA < K) trofeu = 'garantido';
    else if (strictlyAbove >= K) trofeu = 'fora';
    else if (weaklyAbove >= K) trofeu = 'depende_desempate';
    else trofeu = 'vivo';

    return { id: a.id, titulo, trofeu };
  });
}

module.exports = { projectFinalPoints, deriveStatuses };
