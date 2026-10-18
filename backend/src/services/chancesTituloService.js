// backend/src/services/chancesTituloService.js
const { PrismaClient } = require('@prisma/client');
const { loadSettings } = require('../utils/settings');
const { getPointsForResult, getStandings } = require('./standingsService');

const prisma = new PrismaClient();

function ordinal(n) {
  return ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th'][n];
}


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
 * Monta 1-2 frases de template sobre a chance de TÍTULO (ser campeã).
 * A regra de troféu foi removida do produto — este texto é só de título.
 * @param {object} a atleta { participantId, name, titulo, currentPoints, maxPoints }
 * @param {object} ctx { leaderName, leaderPoints, leaderId }
 */
function buildCondicoes(a, ctx) {
  if (a.titulo === 'garantido') return ['Título já garantido matematicamente.'];

  const isLeader = ctx.leaderId && a.participantId === ctx.leaderId;
  if (a.titulo === 'vivo' && isLeader) {
    return [
      `Você lidera com ${a.currentPoints} pts (no melhor caso, ${a.maxPoints} pts).`,
      `O título ainda não está garantido: outras atletas podem te ultrapassar, então mantenha o desempenho nas etapas restantes.`,
    ];
  }
  if (a.titulo === 'vivo' && ctx.leaderName) {
    return [
      `Você tem ${a.currentPoints} pts. No melhor caso chega a ${a.maxPoints} pts.`,
      `Para alcançar ${ctx.leaderName} (${ctx.leaderPoints} pts) e ser campeã, você precisa pontuar o máximo na última etapa.`,
    ];
  }
  if (a.titulo === 'depende_desempate') {
    return [`No melhor caso você empata na liderança (${a.maxPoints} pts); o título sairia em critério de desempate.`];
  }
  // titulo === 'fora'
  return ['Sem chance matemática de título nesta temporada.'];
}

/**
 * Com 1 etapa restante, descreve "o que NÃO pode acontecer" para um contender A
 * (que no melhor caso chega a `a.ceil`) ainda poder ser campeã: para cada atleta
 * que consegue terminar à frente de A mesmo A vencendo, a melhor colocação que ele
 * pode ter sem ultrapassar A (ou "precisa faltar" quando até o último lugar o mantém
 * à frente, por conta do bônus de presença/descarte). Tudo via projectFinalPoints.
 * @param {{name:string, ceil:number}} a contender (melhor caso = ceil)
 * @param {{name:string, scores:number[], presentAllCompleted:boolean, penalty:number}[]} others
 * @param {object} cfg { pointsTable, totalRounds, discardStartsAfter, bonusValue }
 * @returns {{name:string, position:number|null}[]} por bloqueador: posição mínima
 *   que ele pode ter sem ultrapassar A (2..7), ou null = precisa faltar. Vazio se ninguém bloqueia.
 */
function describeBlockers(a, others, cfg) {
  const aBest = a.ceil;
  const finalWith = (o, points, present) =>
    projectFinalPoints(o.scores.concat([points]), {
      totalRounds: cfg.totalRounds,
      completedCount: cfg.totalRounds,
      discardStartsAfter: cfg.discardStartsAfter,
      bonusValue: cfg.bonusValue,
      presentAllRounds: present && o.presentAllCompleted,
      penalty: o.penalty,
    });

  const items = [];
  for (const o of others) {
    // Se nem vencendo a etapa o ultrapassa A, não é bloqueador.
    if (finalWith(o, cfg.pointsTable[0], true) <= aBest) continue;
    // Melhor colocação (mais pontos) em que o fica <= A.
    let okIdx = -1;
    for (let i = 0; i < cfg.pointsTable.length; i++) {
      if (finalWith(o, cfg.pointsTable[i], true) <= aBest) { okIdx = i; break; }
    }
    items.push({ name: o.name, position: okIdx === -1 ? null : okIdx + 1 });
  }
  return items;
}

/** Junta nomes de forma natural: "A", "A e B", "A, B e C". */
function joinNames(names) {
  if (names.length <= 1) return names[0] || '';
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/**
 * Monta uma frase natural dos bloqueadores, agrupando por tipo (evita repetição).
 * @param {{name:string, position:number|null}[]} items de describeBlockers
 * @returns {string|null} frase única ou null se não houver bloqueador
 */
function formatBlockers(items) {
  if (!items || !items.length) return null;
  const falta = items.filter((i) => i.position === null).map((i) => i.name);
  const naoVence = items.filter((i) => i.position === 2).map((i) => i.name);
  const posic = items.filter((i) => i.position && i.position > 2);

  const clauses = [];
  if (falta.length) {
    const pl = falta.length > 1;
    clauses.push(`${joinNames(falta)} ${pl ? 'precisam' : 'precisa'} faltar a última etapa (mesmo terminando em último, ${pl ? 'ficam' : 'fica'} à sua frente)`);
  }
  if (naoVence.length) {
    const pl = naoVence.length > 1;
    clauses.push(`${joinNames(naoVence)} não ${pl ? 'podem' : 'pode'} vencer a última etapa`);
  }
  for (const p of posic) {
    clauses.push(`${p.name} precisa terminar em ${p.position}º ou pior`);
  }
  return `Para você ter chance do título, ${clauses.join('; ')}.`;
}

/**
 * Com 1 etapa restante, menor colocação (pior posição) que garante o título à líder:
 * o menor nº de pontos cujo resultado final supera ESTRITAMENTE o melhor caso de
 * todas as demais (empate não decreta — iria a desempate).
 * @param {{scores:number[], presentAllCompleted:boolean, penalty:number}} leader
 * @param {number} maxOtherCeil maior "melhor caso" entre as demais atletas
 * @param {object} cfg { pointsTable, totalRounds, discardStartsAfter, bonusValue }
 * @returns {number|null} posição (1..7) mínima para ser campeã; null se nem vencendo garante
 */
function leaderClinchPosition(leader, maxOtherCeil, cfg) {
  const finalWith = (points) =>
    projectFinalPoints(leader.scores.concat([points]), {
      totalRounds: cfg.totalRounds,
      completedCount: cfg.totalRounds,
      discardStartsAfter: cfg.discardStartsAfter,
      bonusValue: cfg.bonusValue,
      presentAllRounds: leader.presentAllCompleted,
      penalty: leader.penalty,
    });
  // do pior (último) ao melhor (1º): a primeira posição que ainda garante é o mínimo exigido
  for (let i = cfg.pointsTable.length - 1; i >= 0; i--) {
    if (finalWith(cfg.pointsTable[i]) > maxOtherCeil) return i + 1;
  }
  return null; // nem vencendo garante
}

/** Reúne dados do banco, projeta piso/teto, deriva status, estima probabilidade. */
async function computeChances(group, tournamentId) {
  const [tournament, settings, standings] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    loadSettings(),
    getStandings(group, tournamentId),
  ]);
  if (!tournament) throw new Error('Torneio não encontrado');

  const totalRounds = tournament.totalRounds;
  const discardStartsAfter = settings.int('discard_starts_after_round');
  const bonusValue = settings.int('bonus_full_attendance');
  const trophyPositions = settings.int(group === 'M' ? 'trophy_positions_masculino' : 'trophy_positions_feminino');
  const pointsTable = [1, 2, 3, 4, 5, 6, 7].map((n) => settings.int(`points_${ordinal(n)}_place`));

  const completedRounds = await prisma.round.findMany({
    where: { group, status: 'COMPLETED', tournamentId },
  });
  const completedCount = completedRounds.length;
  const remaining = totalRounds - completedCount;

  const participants = await prisma.participant.findMany({
    where: { group, active: true, tournamentId },
    include: {
      results: { include: { round: true }, where: { round: { group, status: 'COMPLETED', tournamentId } } },
    },
  });

  const base = participants.map((p) => {
    const scores = p.results.map((r) => getPointsForResult(r, settings));
    const presentCompleted = p.results.filter(
      (r) => r.present || r.absentReason === 'SORTEIO' || r.absentReason === 'SORTEIO_VOLUNTARIA'
    ).length;
    const penalty = p.results.reduce((s, r) => s + Math.abs(r.uniformPenalty), 0);
    const presentAllCompleted = presentCompleted === completedCount;
    return { id: p.id, name: p.name, scores, presentCompleted, penalty, presentAllCompleted };
  });

  const withBounds = base.map((a) => {
    const floor = projectFinalPoints(a.scores.concat(Array(remaining).fill(0)), {
      totalRounds, completedCount: totalRounds, discardStartsAfter, bonusValue,
      presentAllRounds: false, penalty: a.penalty,
    });
    const ceil = projectFinalPoints(a.scores.concat(Array(remaining).fill(pointsTable[0])), {
      totalRounds, completedCount: totalRounds, discardStartsAfter, bonusValue,
      presentAllRounds: a.presentAllCompleted, penalty: a.penalty,
    });
    return { ...a, floor, ceil };
  });

  const statuses = deriveStatuses(withBounds.map((a) => ({ id: a.id, floor: a.floor, ceil: a.ceil })), trophyPositions);
  const statusById = new Map(statuses.map((s) => [s.id, s]));

  const probs = monteCarloProbabilities(
    base.map((a) => ({ id: a.id, scores: a.scores, presentCompleted: a.presentCompleted, penalty: a.penalty })),
    { totalRounds, remaining, discardStartsAfter, bonusValue, pointsTable, trophyPositions, iterations: 20000, seed: 12345 }
  );
  const probById = new Map(probs.map((p) => [p.id, p]));

  const posById = new Map(standings.map((s) => [s.participantId, s.position]));
  const ptsById = new Map(standings.map((s) => [s.participantId, s.pointsValid]));
  const leader = standings[0] || null;

  const athletes = withBounds
    .map((a) => {
      const st = statusById.get(a.id);
      const pr = probById.get(a.id);
      const item = {
        participantId: a.id,
        name: a.name,
        currentPosition: posById.get(a.id) ?? null,
        currentPoints: ptsById.get(a.id) ?? a.floor,
        maxPoints: a.ceil,
        titulo: st.titulo,
        trofeu: st.trofeu,
        probTitulo: pr.probTitulo,
        probTrofeu: pr.probTrofeu,
      };
      item.condicoes = buildCondicoes(item, {
        leaderName: leader ? leader.name : null,
        leaderPoints: leader ? leader.pointsValid : null,
        leaderId: leader ? leader.participantId : null,
      });

      // "O que não pode acontecer" — só com 1 etapa restante, para quem persegue
      // o título (não a líder). Determinístico pelo regulamento.
      const isLeader = leader && item.participantId === leader.participantId;
      if (remaining === 1 && !isLeader && (item.titulo === 'vivo' || item.titulo === 'depende_desempate')) {
        const blockers = describeBlockers(
          { name: a.name, ceil: a.ceil },
          withBounds
            .filter((o) => o.id !== a.id)
            .map((o) => ({ name: o.name, scores: o.scores, presentAllCompleted: o.presentAllCompleted, penalty: o.penalty })),
          { pointsTable, totalRounds, discardStartsAfter, bonusValue }
        );
        const frase = formatBlockers(blockers);
        if (frase) {
          item.condicoes = item.condicoes.concat([frase]);
        }
      } else if (remaining === 1 && isLeader && item.titulo === 'vivo') {
        const otherCeils = withBounds.filter((o) => o.id !== a.id).map((o) => o.ceil);
        const maxOtherCeil = otherCeils.length ? Math.max(...otherCeils) : -Infinity;
        const pos = leaderClinchPosition(
          { scores: a.scores, presentAllCompleted: a.presentAllCompleted, penalty: a.penalty },
          maxOtherCeil,
          { pointsTable, totalRounds, discardStartsAfter, bonusValue }
        );
        let frase;
        if (pos === null) {
          frase = 'Nem vencendo a última etapa dá para garantir o título ainda — vai depender dos outros resultados.';
        } else if (pos === 1) {
          frase = 'Para garantir o título matematicamente, você precisa vencer a última etapa.';
        } else {
          frase = `Terminando em ${pos}º lugar ou melhor na última etapa, você é campeã matematicamente.`;
        }
        item.condicoes = item.condicoes.concat([frase]);
      }
      return item;
    })
    .sort((x, y) => (x.currentPosition ?? 999) - (y.currentPosition ?? 999));

  const { generateChancesText } = require('./insightService');
  await Promise.all(
    athletes.map(async (a) => {
      const ai = await generateChancesText({ name: a.name, facts: a.condicoes });
      a.resumo = ai || a.condicoes.join(' '); // fallback = template puro
    })
  );

  return { group, totalRounds, remaining, trophyPositions, athletes };
}

module.exports = { projectFinalPoints, deriveStatuses, monteCarloProbabilities, buildCondicoes, describeBlockers, formatBlockers, leaderClinchPosition, computeChances };
