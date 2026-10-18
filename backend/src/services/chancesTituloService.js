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

// RNG determinístico (mulberry32) para simulações reproduzíveis
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Estima P(campeã) e P(troféu) por atleta via Monte Carlo com modelo UNIFORME.
 * @param {{id,scores:number[],presentCompleted:number,penalty:number}[]} athletes
 * @param {object} cfg { totalRounds, remaining, discardStartsAfter, bonusValue, pointsTable, trophyPositions, iterations, seed }
 */
function monteCarloProbabilities(athletes, cfg) {
  const rng = mulberry32(cfg.seed || 1);
  const table = cfg.pointsTable;
  const titleWins = new Map(athletes.map((a) => [a.id, 0]));
  const trophyWins = new Map(athletes.map((a) => [a.id, 0]));
  const N = cfg.iterations;

  for (let it = 0; it < N; it++) {
    const finals = athletes.map((a) => {
      const future = [];
      for (let r = 0; r < cfg.remaining; r++) {
        future.push(table[Math.floor(rng() * table.length)]);
      }
      const scores = a.scores.concat(future);
      const presentAll = a.presentCompleted + cfg.remaining === cfg.totalRounds;
      const pts = projectFinalPoints(scores, {
        totalRounds: cfg.totalRounds,
        completedCount: cfg.totalRounds,
        discardStartsAfter: cfg.discardStartsAfter,
        bonusValue: cfg.bonusValue,
        presentAllRounds: presentAll,
        penalty: a.penalty,
      });
      return { id: a.id, pts, tie: rng() };
    });
    finals.sort((x, y) => (y.pts - x.pts) || (y.tie - x.tie));
    titleWins.set(finals[0].id, titleWins.get(finals[0].id) + 1);
    for (let i = 0; i < Math.min(cfg.trophyPositions, finals.length); i++) {
      trophyWins.set(finals[i].id, trophyWins.get(finals[i].id) + 1);
    }
  }

  return athletes.map((a) => ({
    id: a.id,
    probTitulo: titleWins.get(a.id) / N,
    probTrofeu: trophyWins.get(a.id) / N,
  }));
}

/**
 * Monta 1-2 frases de template a partir dos fatos já calculados.
 * @param {object} a atleta { name, titulo, trofeu, currentPoints, maxPoints }
 * @param {object} ctx { leaderName, leaderPoints }
 */
function buildCondicoes(a, ctx) {
  if (a.titulo === 'garantido') return ['Título já garantido matematicamente.'];
  if (a.trofeu === 'garantido' && (a.titulo === 'fora' || a.titulo === 'depende_desempate')) {
    const base = ['Troféu já garantido.'];
    if (a.titulo === 'depende_desempate') base.push('O título ainda depende de critérios de desempate.');
    return base;
  }
  if (a.titulo === 'fora' && a.trofeu === 'fora') {
    return ['Sem chance matemática de troféu nesta temporada.'];
  }
  const out = [];
  if (a.titulo === 'vivo' && ctx.leaderName) {
    out.push(`Você tem ${a.currentPoints} pts. No melhor caso chega a ${a.maxPoints} pts.`);
    out.push(`Para alcançar ${ctx.leaderName} (${ctx.leaderPoints} pts) e ser campeã, precisa pontuar o máximo e torcer por tropeços da líder.`);
  } else if (a.titulo === 'depende_desempate') {
    out.push(`No melhor caso você empata na liderança (${a.maxPoints} pts); o título sairia em critério de desempate.`);
  }
  if (a.trofeu === 'vivo') {
    out.push(`Para entrar na zona de troféu, pontue o máximo nas etapas restantes.`);
  } else if (a.trofeu === 'depende_desempate' && out.length === 0) {
    out.push('A vaga de troféu depende de critérios de desempate.');
  }
  return out.length ? out : ['Situação em aberto.'];
}

module.exports = { projectFinalPoints, deriveStatuses, monteCarloProbabilities, buildCondicoes };
